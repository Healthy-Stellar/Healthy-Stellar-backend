#!/bin/bash

# Database Indexing Optimization - Implementation Validation Script
# This script validates that all files are in place and properly configured

echo "🔍 Validating Database Indexing Optimization Implementation"
echo "============================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        ((FAILED++))
        return 1
    fi
}

# Function to check TypeScript compilation
check_typescript() {
    echo ""
    echo "📝 Checking TypeScript Compilation..."
    if npx tsc --noEmit "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $1 compiles successfully"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $1 has compilation errors"
        ((FAILED++))
        return 1
    fi
}

# Check core implementation files
echo "📁 Checking Core Implementation Files..."
check_file "src/migrations/1737900000000-AddPerformanceIndexes.ts"

echo ""
echo "🛠️  Checking Tool Scripts..."
check_file "scripts/benchmark-database-performance.ts"
check_file "scripts/explain-query-plans.ts"

echo ""
echo "🧪 Checking Test Files..."
check_file "test/migrations/add-performance-indexes.spec.ts"

echo ""
echo "📚 Checking Documentation..."
check_file "docs/DATABASE_INDEXING_OPTIMIZATION.md"
check_file "docs/SECURITY_CHECKLIST.md"
check_file "docs/IMPLEMENTATION_SUMMARY.md"
check_file "docs/PR_DESCRIPTION.md"
check_file "IMPLEMENTATION_COMPLETE.md"

echo ""
echo "⚙️  Checking Configuration..."
check_file "package.json"
check_file ".gitignore"

# Check package.json scripts
echo ""
echo "📦 Checking NPM Scripts..."
if grep -q "benchmark:db" package.json; then
    echo -e "${GREEN}✓${NC} benchmark:db script configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} benchmark:db script missing"
    ((FAILED++))
fi

if grep -q "explain:queries" package.json; then
    echo -e "${GREEN}✓${NC} explain:queries script configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} explain:queries script missing"
    ((FAILED++))
fi

# Check TypeScript compilation
check_typescript "src/migrations/1737900000000-AddPerformanceIndexes.ts"
check_typescript "scripts/benchmark-database-performance.ts"
check_typescript "scripts/explain-query-plans.ts"
check_typescript "test/migrations/add-performance-indexes.spec.ts"

# Check migration structure
echo ""
echo "🔍 Checking Migration Structure..."
if grep -q "export class AddPerformanceIndexes1737900000000 implements MigrationInterface" src/migrations/1737900000000-AddPerformanceIndexes.ts; then
    echo -e "${GREEN}✓${NC} Migration class properly defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Migration class not found"
    ((FAILED++))
fi

if grep -q "public async up(queryRunner: QueryRunner)" src/migrations/1737900000000-AddPerformanceIndexes.ts; then
    echo -e "${GREEN}✓${NC} Migration up() method defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Migration up() method missing"
    ((FAILED++))
fi

if grep -q "public async down(queryRunner: QueryRunner)" src/migrations/1737900000000-AddPerformanceIndexes.ts; then
    echo -e "${GREEN}✓${NC} Migration down() method defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Migration down() method missing"
    ((FAILED++))
fi

# Check for required indexes
echo ""
echo "📊 Checking Index Definitions..."
INDEXES=(
    "IDX_medical_records_patient_id"
    "IDX_access_grants_patient_grantee_expires"
    "IDX_audit_logs_user_id_timestamp"
    "IDX_audit_logs_entity_id"
)

for index in "${INDEXES[@]}"; do
    if grep -q "$index" src/migrations/1737900000000-AddPerformanceIndexes.ts; then
        echo -e "${GREEN}✓${NC} $index defined"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $index missing"
        ((FAILED++))
    fi
done

# Summary
echo ""
echo "============================================================"
echo "📊 Validation Summary"
echo "============================================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed! Implementation is complete.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the implementation: git diff"
    echo "2. Run tests: npm run test test/migrations/"
    echo "3. Deploy to staging: npm run migration:run"
    echo "4. Benchmark performance: npm run benchmark:db"
    exit 0
else
    echo -e "${RED}❌ Some validations failed. Please review the errors above.${NC}"
    exit 1
fi
