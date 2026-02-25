#!/bin/bash

# SDK Generator Script
# Generates TypeScript SDK from OpenAPI specification using openapi-generator-cli
#
# Usage: npm run generate:sdk
# or:    ./scripts/generate-sdk.sh

set -e

echo "🔨 Generating SDK from OpenAPI specification..."
echo ""

# Paths
OPENAPI_SPEC="${OPENAPI_SPEC:-docs/openapi.json}"
SDK_OUTPUT_DIR="packages/sdk/src"
OPENAPI_CONFIG="openapitools.json"

# Check if OpenAPI spec exists
if [ ! -f "$OPENAPI_SPEC" ]; then
  echo "❌ OpenAPI spec not found at: $OPENAPI_SPEC"
  echo "   Please ensure the OpenAPI spec exists at: docs/openapi.json"
  exit 1
fi

echo "📄 OpenAPI Spec: $OPENAPI_SPEC"
echo "📝 Config File: $OPENAPI_CONFIG"
echo "📦 Output Directory: $SDK_OUTPUT_DIR"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$SDK_OUTPUT_DIR"

# Check if openapi-generator-cli is installed
if ! command -v openapi-generator-cli &> /dev/null; then
  echo "⚠️  openapi-generator-cli not found. Installing..."
  npm install -g @openapitools/openapi-generator-cli
fi

# Generate SDK
echo "⏳ Generating TypeScript SDK..."
echo ""

openapi-generator-cli generate \
  -i "$OPENAPI_SPEC" \
  -g typescript-axios \
  -o "$SDK_OUTPUT_DIR" \
  -c "$OPENAPI_CONFIG" \
  --skip-validate-spec \
  --additional-properties=useSingleRequestParameter=false \
  --additional-properties=npmName=@medchain/sdk \
  --additional-properties=npmVersion=1.0.0

echo ""
echo "✅ SDK generated successfully!"
echo ""
echo "📂 Generated files:"
echo "   - APIs: $SDK_OUTPUT_DIR/apis/"
echo "   - Models: $SDK_OUTPUT_DIR/models/"
echo "   - Configuration: $SDK_OUTPUT_DIR/configuration.ts"
echo "   - Index: $SDK_OUTPUT_DIR/index.ts"
echo ""
echo "📝 Next steps:"
echo "   1. Review the generated code: ls -la $SDK_OUTPUT_DIR"
echo "   2. Build the SDK: npm run build:sdk"
echo "   3. Run tests: npm run test:sdk"
echo "   4. Commit changes: git add $SDK_OUTPUT_DIR && git commit -m 'chore: regenerate SDK'"
echo ""
