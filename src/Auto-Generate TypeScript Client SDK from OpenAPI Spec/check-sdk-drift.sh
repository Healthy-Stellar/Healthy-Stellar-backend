#!/usr/bin/env bash
# scripts/check-sdk-drift.sh
# Regenerates the SDK and fails if the output differs from what's committed.
# Used in CI and as a pre-commit hook.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="$REPO_ROOT/packages/sdk"

echo "🔍 Running SDK drift detection…"
echo "   Spec:    docs/openapi.json"
echo "   Output:  packages/sdk/src/generated/"
echo ""

# Regenerate
cd "$SDK_DIR"
npm run generate -- --quiet 2>&1 || {
  echo "❌ SDK generation failed. Fix the OpenAPI spec or generator config."
  exit 1
}

# Check for differences
if git -C "$REPO_ROOT" diff --quiet packages/sdk/src/generated/; then
  echo "✅ No drift detected. SDK is in sync with the OpenAPI spec."
  exit 0
else
  echo "❌ SDK drift detected!"
  echo ""
  echo "The following files differ from what's committed:"
  git -C "$REPO_ROOT" diff --name-only packages/sdk/src/generated/
  echo ""
  echo "To fix, run:"
  echo ""
  echo "  cd packages/sdk && npm run generate"
  echo "  git add packages/sdk/src/generated"
  echo "  git commit -m 'chore(sdk): regenerate from updated OpenAPI spec'"
  echo ""
  exit 1
fi
