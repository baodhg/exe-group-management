#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: scripts/ef.sh <Identity|Group|JoinRequest> <dotnet-ef arguments...>"
  echo "Example: scripts/ef.sh Group migrations add AddClasses"
  exit 1
}

[[ $# -ge 2 ]] || usage
service="$1"
shift

case "$service" in
  Identity) folder="IdentityService" ;;
  Group) folder="GroupService" ;;
  JoinRequest) folder="JoinRequestService" ;;
  *) usage ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
dotnet tool restore >/dev/null

extra=()
if [[ "${1:-}" == "migrations" && "${2:-}" == "add" ]]; then
  extra=(--output-dir Data/Migrations)
fi

dotnet tool run dotnet-ef "$@" \
  --project "src/$folder/ExeGroup.$service.Repositories" \
  --startup-project "src/$folder/ExeGroup.$service.API" \
  "${extra[@]}"
