#!/usr/bin/env bash
# Pulls the backend's contract across and regenerates the client (ADR 0018).
#
#   ./scripts/sync-contract.sh           copy ../backend/contract/openapi.yaml, regenerate, typecheck
#   ./scripts/sync-contract.sh --check   CI: regenerate from the committed contract and fail if the
#                                        committed client differs, then typecheck. Copies nothing.
#
# It fails loudly (non-zero exit, a message that says what to do) when the backend file is missing,
# when the generated client is stale, or when an app no longer compiles against the contract.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mode="sync"
if [[ "${1:-}" == "--check" ]]; then
  mode="check"
elif [[ -n "${1:-}" ]]; then
  echo "usage: ./scripts/sync-contract.sh [--check]" >&2
  exit 2
fi

source_file="../backend/contract/openapi.yaml"
target_file="contract/openapi.yaml"

if [[ "$mode" == "sync" ]]; then
  if [[ ! -f "$source_file" ]]; then
    echo "sync-contract: $source_file does not exist. Open the workspace root so ../backend is beside frontend/." >&2
    exit 1
  fi
  if cmp -s "$source_file" "$target_file"; then
    echo "sync-contract: contract/openapi.yaml already matches the backend's."
  else
    cp "$source_file" "$target_file"
    echo "sync-contract: copied the backend's contract. Read ../backend/docs/CONTRACT_CHANGELOG.md for what changed."
  fi
  pnpm --filter @hakorem/api-client generate
else
  if [[ -f "$source_file" ]] && ! cmp -s "$source_file" "$target_file"; then
    echo "sync-contract: note: contract/openapi.yaml differs from ../backend/contract/openapi.yaml. Run without --check to take the backend's." >&2
  fi
  pnpm --filter @hakorem/api-client generate:check
fi

# The gate that matters: every package and app still compiles against the regenerated types.
if ! pnpm typecheck; then
  echo "sync-contract: FAILED. An app no longer compiles against the contract. Fix the type errors; never pin to an old contract." >&2
  exit 1
fi

echo "sync-contract: ok."
