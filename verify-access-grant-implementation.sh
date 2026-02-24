#!/bin/bash

echo "==================================="
echo "Access Grant Lifecycle Verification"
echo "==================================="
echo ""

# Check if all required files exist
echo "✓ Checking file structure..."

files=(
  "src/access-control/access-control.module.ts"
  "src/access-control/controllers/access-control.controller.ts"
  "src/access-control/services/access-control.service.ts"
  "src/access-control/services/soroban-queue.service.ts"
  "src/access-control/entities/access-grant.entity.ts"
  "src/access-control/dto/create-access-grant.dto.ts"
  "test/e2e/access-grant-lifecycle.e2e-spec.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
  fi
done

echo ""
echo "✓ Checking endpoints..."

# Check for required endpoints in controller
if grep -q "Post('grant')" src/access-control/controllers/access-control.controller.ts; then
  echo "  ✓ POST /access/grant"
else
  echo "  ✗ POST /access/grant (MISSING)"
fi

if grep -q "Delete('grant/:grantId')" src/access-control/controllers/access-control.controller.ts; then
  echo "  ✓ DELETE /access/grant/:grantId"
else
  echo "  ✗ DELETE /access/grant/:grantId (MISSING)"
fi

if grep -q "Get('grants')" src/access-control/controllers/access-control.controller.ts; then
  echo "  ✓ GET /access/grants"
else
  echo "  ✗ GET /access/grants (MISSING)"
fi

if grep -q "Get('received')" src/access-control/controllers/access-control.controller.ts; then
  echo "  ✓ GET /access/received"
else
  echo "  ✗ GET /access/received (MISSING)"
fi

echo ""
echo "✓ Checking DTO fields..."

if grep -q "granteeId: string" src/access-control/dto/create-access-grant.dto.ts; then
  echo "  ✓ granteeId field"
else
  echo "  ✗ granteeId field (MISSING)"
fi

if grep -q "recordIds: string\[\]" src/access-control/dto/create-access-grant.dto.ts; then
  echo "  ✓ recordIds field"
else
  echo "  ✗ recordIds field (MISSING)"
fi

if grep -q "accessLevel: AccessLevel" src/access-control/dto/create-access-grant.dto.ts; then
  echo "  ✓ accessLevel field"
else
  echo "  ✗ accessLevel field (MISSING)"
fi

if grep -q "expiresAt?: string" src/access-control/dto/create-access-grant.dto.ts; then
  echo "  ✓ expiresAt field"
else
  echo "  ✗ expiresAt field (MISSING)"
fi

echo ""
echo "✓ Checking AccessLevel enum..."

if grep -q "READ = 'READ'" src/access-control/entities/access-grant.entity.ts; then
  echo "  ✓ READ"
else
  echo "  ✗ READ (MISSING)"
fi

if grep -q "READ_WRITE = 'READ_WRITE'" src/access-control/entities/access-grant.entity.ts; then
  echo "  ✓ READ_WRITE"
else
  echo "  ✗ READ_WRITE (MISSING)"
fi

echo ""
echo "✓ Checking duplicate grant prevention..."

if grep -q "ConflictException" src/access-control/services/access-control.service.ts; then
  echo "  ✓ ConflictException (409) implemented"
else
  echo "  ✗ ConflictException (409) (MISSING)"
fi

echo ""
echo "✓ Checking WebSocket integration..."

if grep -q "emitAccessGranted" src/access-control/services/access-control.service.ts; then
  echo "  ✓ emitAccessGranted event"
else
  echo "  ✗ emitAccessGranted event (MISSING)"
fi

if grep -q "emitAccessRevoked" src/access-control/services/access-control.service.ts; then
  echo "  ✓ emitAccessRevoked event"
else
  echo "  ✗ emitAccessRevoked event (MISSING)"
fi

echo ""
echo "✓ Checking Soroban integration..."

if grep -q "dispatchGrant" src/access-control/services/soroban-queue.service.ts; then
  echo "  ✓ dispatchGrant method"
else
  echo "  ✗ dispatchGrant method (MISSING)"
fi

if grep -q "dispatchRevoke" src/access-control/services/soroban-queue.service.ts; then
  echo "  ✓ dispatchRevoke method"
else
  echo "  ✗ dispatchRevoke method (MISSING)"
fi

echo ""
echo "✓ Checking E2E tests..."

if grep -q "POST /access/grant" test/e2e/access-grant-lifecycle.e2e-spec.ts; then
  echo "  ✓ Grant test"
else
  echo "  ✗ Grant test (MISSING)"
fi

if grep -q "DELETE /access/grant" test/e2e/access-grant-lifecycle.e2e-spec.ts; then
  echo "  ✓ Revoke test"
else
  echo "  ✗ Revoke test (MISSING)"
fi

if grep -q "Full grant → verify → revoke cycle" test/e2e/access-grant-lifecycle.e2e-spec.ts; then
  echo "  ✓ Full lifecycle test"
else
  echo "  ✗ Full lifecycle test (MISSING)"
fi

echo ""
echo "==================================="
echo "Verification Complete!"
echo "==================================="
