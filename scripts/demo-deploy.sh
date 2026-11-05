#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_TAG:?Set IMAGE_TAG}"

state_dir="${DEMO_STATE_DIR:-/var/jenkins_home/exe-group-demo}"
env_file="$state_dir/demo.env"
last_good_file="$state_dir/last-good"
compose=(docker compose -f docker-compose.yml -f docker-compose.demo.yml --env-file "$env_file")
database_services=(identity-service group-service join-request-service)

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file: create it with SA_PASSWORD and JWT_SIGNING_KEY first." >&2
  exit 1
fi

deploy() {
  IMAGE_TAG="$1" "${compose[@]}" up -d --wait --wait-timeout 300 --no-build --pull never --remove-orphans
}

status_through_web() {
  IMAGE_TAG="$1" "${compose[@]}" exec -T gateway curl -s -o /dev/null -w '%{http_code}' "http://web$2"
}

expect_status() {
  local actual
  actual="$(status_through_web "$1" "$3")"
  if [[ "$actual" != "$2" ]]; then
    echo "Smoke check failed: $3 answered $actual, expected $2" >&2
    return 1
  fi

  echo "ok $2 $3"
}

smoke() {
  local tag="$1" service body
  expect_status "$tag" 200 /
  expect_status "$tag" 200 /admin/semesters
  expect_status "$tag" 200 /health/live
  expect_status "$tag" 200 /swagger/index.html
  expect_status "$tag" 401 /api/v1/semesters

  body="$(IMAGE_TAG="$tag" "${compose[@]}" exec -T gateway curl -s http://web/api/v1/semesters)"
  if [[ "$body" != *'"code":"UNAUTHORIZED"'* || "$body" != *'"traceId":"'* ]]; then
    echo "Smoke check failed: 401 is not the error envelope: $body" >&2
    return 1
  fi

  for service in "${database_services[@]}"; do
    IMAGE_TAG="$tag" "${compose[@]}" exec -T "$service" curl -fsS -o /dev/null http://localhost:8080/health/ready
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

previous_tag=""
if [[ -f "$last_good_file" ]]; then
  previous_tag="$(cat "$last_good_file")"
fi

if [[ -z "${DEMO_SKIP_BUILD:-}" ]]; then
  "${compose[@]}" build
fi

if deploy "$IMAGE_TAG" && smoke "$IMAGE_TAG"; then
  echo "$IMAGE_TAG" > "$last_good_file"
  remove_old_images "$IMAGE_TAG" "$previous_tag"
  echo "Deployed $IMAGE_TAG"
  exit 0
fi

echo "Deploy of $IMAGE_TAG failed" >&2
IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" ps -a >&2 || true
IMAGE_TAG="$IMAGE_TAG" "${compose[@]}" logs --tail 40 >&2 || true

if [[ -n "$previous_tag" && "$previous_tag" != "$IMAGE_TAG" ]]; then
  echo "Rolling back to $previous_tag" >&2
  deploy "$previous_tag" && smoke "$previous_tag"
  echo "Rolled back to $previous_tag" >&2
else
  echo "No earlier good version to roll back to" >&2
fi

exit 1
