#!/usr/bin/env bash
set -uo pipefail

: "${IMAGE_TAG:?Set IMAGE_TAG}"

state_dir="${DEMO_STATE_DIR:?Set DEMO_STATE_DIR}"
env_file="$state_dir/demo.env"
last_good_file="$state_dir/last-good"
last_good_commit_file="$state_dir/last-good-commit"
compose=(docker compose -f docker-compose.yml -f deploy/docker-compose.demo.yml --env-file "$env_file")
database_services=(identity-service group-service join-request-service)

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file: create it with SA_PASSWORD and JWT_SIGNING_KEY first." >&2
  exit 1
fi

sample_key="$(grep -m1 '^JWT_SIGNING_KEY=' .env.example)"
if [[ -z "$sample_key" ]]; then
  echo "Missing check: .env.example has no JWT_SIGNING_KEY to compare with." >&2
  exit 1
fi

if grep -qxF "$sample_key" "$env_file"; then
  echo "Missing a real JWT_SIGNING_KEY in $env_file: it still holds the sample from .env.example." >&2
  exit 1
fi

deploy() {
  IMAGE_TAG="$1" "${compose[@]}" up -d --wait --wait-timeout 300 --no-build --pull never --remove-orphans
}

expect_status() {
  local tag="$1" expected="$2" path="$3" actual
  actual="$(IMAGE_TAG="$tag" "${compose[@]}" exec -T gateway curl -s -o /dev/null -w '%{http_code}' "http://web$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Smoke check failed: $path answered $actual, expected $expected" >&2
    return 1
  fi

  echo "ok $expected $path"
}

smoke() {
  local tag="$1" service body
  expect_status "$tag" 200 / || return 1
  expect_status "$tag" 200 /admin/semesters || return 1
  expect_status "$tag" 200 /health/live || return 1
  expect_status "$tag" 200 /swagger/index.html || return 1
  expect_status "$tag" 401 /api/v1/semesters || return 1

  body="$(IMAGE_TAG="$tag" "${compose[@]}" exec -T gateway curl -s http://web/api/v1/semesters)" || return 1
  if [[ "$body" != *'"code":"UNAUTHORIZED"'* || "$body" != *'"traceId":"'* ]]; then
    echo "Smoke check failed: 401 is not the error envelope: $body" >&2
    return 1
  fi

  for service in "${database_services[@]}"; do
    if ! IMAGE_TAG="$tag" "${compose[@]}" exec -T "$service" curl -fsS -o /dev/null http://localhost:8080/health/ready; then
      echo "Smoke check failed: $service is not ready" >&2
      return 1
    fi

    echo "ok ready $service"
  done
}

remove_old_images() {
  local keep_current="$1" keep_previous="$2" image tag
  docker image ls --filter 'reference=exe-group-demo/*' --format '{{.Repository}}:{{.Tag}}' | while read -r image; do
    tag="${image##*:}"
    if [[ "$tag" != "$keep_current" && "$tag" != "$keep_previous" ]]; then
      docker image rm "$image" > /dev/null || true
    fi
  done
}

remove_old_build_cache() {
  docker builder prune --force --filter until=168h > /dev/null || echo "Could not remove old build cache; the deploy is not affected." >&2
}

main() {
  local current_commit previous_tag previous_commit
  current_commit="$(git rev-parse HEAD)"
  if [[ -z "$current_commit" ]]; then
    echo "Missing commit: could not read the commit being deployed. The running version was not touched." >&2
    exit 1
  fi

  previous_tag=""
  if [[ -f "$last_good_file" ]]; then
    previous_tag="$(cat "$last_good_file")"
  fi

  previous_commit=""
  if [[ -f "$last_good_commit_file" ]]; then
    previous_commit="$(cat "$last_good_commit_file")"
  fi

  if [[ -z "${DEMO_SKIP_BUILD:-}" ]]; then
    if ! IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" build; then
      echo "Deploy of $IMAGE_TAG failed: the images did not build. The running version was not touched." >&2
      exit 1
    fi
  fi

  if deploy "$IMAGE_TAG" && smoke "$IMAGE_TAG"; then
    echo "$IMAGE_TAG" > "$last_good_file"
    echo "$current_commit" > "$last_good_commit_file"
    remove_old_images "$IMAGE_TAG" "$previous_tag"
    remove_old_build_cache
    echo "Deployed $IMAGE_TAG"
    exit 0
  fi

  echo "Deploy of $IMAGE_TAG failed" >&2
  IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" ps -a >&2 || true
  IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" logs --tail 40 >&2 || true

  if [[ -z "$previous_tag" ]]; then
    echo "No earlier good version to roll back to" >&2
    IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" stop || true
    exit 1
  fi

  if [[ "$previous_tag" == "$IMAGE_TAG" ]]; then
    echo "This version was the last good one, so there is nothing older to return to; left as it is." >&2
    exit 1
  fi

  echo "Rolling back to $previous_tag" >&2
  if [[ -z "$previous_commit" ]]; then
    echo "Rollback to $previous_tag failed: its commit is unknown." >&2
    exit 1
  fi

  if ! git checkout --quiet --detach "$previous_commit"; then
    echo "Rollback to $previous_tag failed: commit $previous_commit could not be checked out." >&2
    exit 1
  fi

  if deploy "$previous_tag" && smoke "$previous_tag"; then
    echo "Rolled back to $previous_tag" >&2
  else
    echo "Rollback to $previous_tag failed" >&2
  fi

  exit 1
}

main; exit $?
