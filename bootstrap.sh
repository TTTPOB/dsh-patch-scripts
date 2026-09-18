#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-}"
DEPLOYMENT="${2:-installation-0.1.5-rc.2}"
REPO="${DSH_PATCH_REPO:-TTTPOB/dsh-patch-scripts}"
REF="${DSH_PATCH_REF:-0.1.5-rc.2-3}"
BASE_URL="${DSH_PATCH_BASE_URL:-https://github.com}"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/dsh-patch-scripts"

case "$COMMAND" in
  prepare-support|doctor|test|apply) ;;
  *)
    echo "Usage: bootstrap.sh prepare-support|doctor|test|apply [deployment]" >&2
    exit 2
    ;;
esac

[[ "$(id -u)" != 0 ]] || {
  echo "ERROR: do not run dsh patch scripts as root" >&2
  exit 1
}

for command in node corepack curl tar; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $command" >&2
    exit 1
  }
done

if [[ -n "${DSH_PATCH_SOURCE_DIR:-}" ]]; then
  SOURCE_DIR="$(readlink -f "$DSH_PATCH_SOURCE_DIR")"
else
  SAFE_REF="${REF//[^A-Za-z0-9._-]/_}"
  SOURCE_DIR="$CACHE_ROOT/$SAFE_REF"
  if [[ ! -f "$SOURCE_DIR/package.json" ]]; then
    ARCHIVE_URL="${DSH_PATCH_ARCHIVE_URL:-$BASE_URL/$REPO/archive/$REF.tar.gz}"
    STAGING="$CACHE_ROOT/.staging-$SAFE_REF-$$"
    rm -rf -- "$STAGING"
    mkdir -p "$STAGING" "$CACHE_ROOT"
    curl -fsSL "$ARCHIVE_URL" | tar -xz --strip-components=1 -C "$STAGING"
    rm -rf -- "$SOURCE_DIR"
    mv -- "$STAGING" "$SOURCE_DIR"
  fi
fi

[[ -f "$SOURCE_DIR/package.json" ]] || {
  echo "ERROR: invalid patch workspace: $SOURCE_DIR" >&2
  exit 1
}

corepack pnpm@11.24.0 --dir "$SOURCE_DIR" install --frozen-lockfile
exec node "$SOURCE_DIR/src/cli.mjs" "$COMMAND" --deployment "$DEPLOYMENT"
