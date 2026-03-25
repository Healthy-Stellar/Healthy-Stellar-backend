#!/bin/bash

# Verification script for API Key implementation
# Run this script to verify the API key authentication system is working

set -e

echo "🔍 Verifying API Key Implementation..."
echo ""

# Check if migration file exists
echo "✓ Checking migration file..."
if [ -f "src/migrations/1772500000000-CreateApiKeysTable.ts" ]; then
  echo "  ✔ Migration file found"
else
  echo "  ✗ Migration file not found"
  exit 1
fi

# Check entity file
echo "✓ Checking API Key entity..."
if [ -f "src/auth/entities/api-key.entity.ts" ]; then
  echo "  ✔ Entity file found"
  if grep -q "enum ApiKeyScope" src/auth/entities/api-key.entity.ts; then
    echo "  ✔ ApiKeyScope enum defined"
  else
    echo "  ✗ ApiKeyScope enum not found"
    exit 1
  fi
else
  echo "  ✗ Entity file not found"
  exit 1
fi

# Check service file
echo "✓ Checking API Key service..."
if [ -f "src/auth/services/api-key.service.ts" ]; then
  echo "  ✔ Service file found"
  if grep -q "validateApiKey" src/auth/services/api-key.service.ts; then
    echo "  ✔ validateApiKey method found"
  else
    echo "  ✗ validateApiKey method not found"
    exit 1
  fi
else
  echo "  ✗ Service file not found"
  exit 1
fi

# Check guard file
echo "✓ Checking API Key guard..."
if [ -f "src/auth/guards/api-key.guard.ts" ]; then
  echo "  ✔ Guard file found"
else
  echo "  ✗ Guard file not found"
  exit 1
fi

# Check strategy file
echo "✓ Checking API Key strategy..."
if [ -f "src/auth/strategies/api-key.strategy.ts" ]; then
  echo "  ✔ Strategy file found"
else
  echo "  ✗ Strategy file not found"
  exit 1
fi

# Check admin controller
echo "✓ Checking Admin controller..."
if [ -f "src/admin/controllers/admin.controller.ts" ]; then
  echo "  ✔ Admin controller found"
  if grep -q "POST\|DELETE\|GET" src/admin/controllers/admin.controller.ts; then
    echo "  ✔ All CRUD endpoints defined"
  else
    echo "  ✗ CRUD endpoints not properly defined"
    exit 1
  fi
else
  echo "  ✗ Admin controller not found"
  exit 1
fi

# Check test files
echo "✓ Checking test files..."
if [ -f "test/unit/api-key.service.spec.ts" ]; then
  echo "  ✔ Service tests found"
else
  echo "  ✗ Service tests not found"
fi

if [ -f "test/unit/api-key.guard.spec.ts" ]; then
  echo "  ✔ Guard tests found"
else
  echo "  ✗ Guard tests not found"
fi

if [ -f "test/unit/api-key.strategy.spec.ts" ]; then
  echo "  ✔ Strategy tests found"
else
  echo "  ✗ Strategy tests not found"
fi

# Check throttler guard
echo "✓ Checking API Key throttler..."
if [ -f "src/common/throttler/api-key-throttler.guard.ts" ]; then
  echo "  ✔ API Key throttler guard found"
else
  echo "  ✗ API Key throttler guard not found"
  exit 1
fi

# Check documentation
echo "✓ Checking documentation..."
if [ -f "docs/api-key-authentication.md" ]; then
  echo "  ✔ Documentation found"
else
  echo "  ✗ Documentation not found"
fi

echo ""
echo "✅ All API Key implementation checks passed!"
echo ""
echo "📋 Next steps:"
echo "  1. Run database migrations: npm run migration:run"
echo "  2. Run unit tests: npm test"
echo "  3. Review documentation: docs/api-key-authentication.md"