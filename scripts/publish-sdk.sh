#!/bin/bash
set -euo pipefail

echo "Publishing @medchain/sdk to npm..."

cd "$(dirname "$0")/../packages/sdk"

npm ci
npm run build
npm test
npm publish --provenance --access public

echo "Published successfully."
