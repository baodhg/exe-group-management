#!/usr/bin/env bash
set -euo pipefail

state_dir="$HOME/exe-group-demo"
source_dir="$state_dir/src"
log_dir="$state_dir/logs"
repository="https://github.com/baodhg/exe-group-management.git"
public_lines='^(ok |Deployed |Deploy of |Rolling back|Rolled back|No earlier|Smoke check failed|Missing )'

if [[ ! "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo "Only 'deploy <full commit sha>' is allowed." >&2
  exit 2
fi

commit="${BASH_REMATCH[1]}"
umask 022
mkdir -p "$log_dir"

exec 9> "$state_dir/deploy.lock"
if ! flock -n 9; then
  echo "Another deployment is running." >&2
  exit 3
fi

if [[ ! -d "$source_dir/.git" ]]; then
  git clone --quiet "$repository" "$source_dir"
fi

cd "$source_dir"
git fetch --quiet origin main
if ! git merge-base --is-ancestor "$commit" origin/main 2> /dev/null; then
  echo "Commit is not on main." >&2
  exit 4
fi

git checkout --quiet --detach "$commit"
log_file="$log_dir/$commit.log"
status=0
IMAGE_TAG="sha-${commit:0:12}" DEMO_STATE_DIR="$state_dir" bash scripts/demo-deploy.sh > "$log_file" 2>&1 || status=$?
grep -E "$public_lines" "$log_file" | cut -c1-200 || true
ls -1t "$log_dir" | tail -n +21 | sed "s|^|$log_dir/|" | xargs -r rm -f
exit "$status"
