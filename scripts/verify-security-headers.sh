#!/bin/bash

# Security Headers Verification Script
# This script verifies that all required security headers are properly configured

echo "🔒 Security Headers Verification"
echo "=================================="
echo ""

# Check if nmap is installed
if ! command -v nmap &> /dev/null; then
    echo "❌ nmap is not installed. Please install it first:"
    echo "   - Ubuntu/Debian: sudo apt-get install nmap"
    echo "   - macOS: brew install nmap"
    echo "   - Windows: Download from https://nmap.org/download.html"
    exit 1
fi

# Default values
HOST="${1:-localhost}"
PORT="${2:-3000}"

echo "Testing: http://$HOST:$PORT"
echo ""

# Run nmap security headers check
echo "Running nmap http-security-headers scan..."
echo "-------------------------------------------"
nmap --script http-security-headers -p $PORT $HOST

echo ""
echo "-------------------------------------------"
echo ""

# Additional curl-based verification
echo "Additional Header Verification with curl:"
echo "-------------------------------------------"

RESPONSE=$(curl -s -I "http://$HOST:$PORT/api" 2>&1)

# Check for required headers
check_header() {
    local header=$1
    local expected=$2
    
    if echo "$RESPONSE" | grep -qi "$header"; then
        echo "✅ $header: $(echo "$RESPONSE" | grep -i "$header" | head -1 | cut -d: -f2- | xargs)"
    else
        echo "❌ $header: NOT FOUND"
    fi
}

check_header "X-Frame-Options" "DENY"
check_header "X-Content-Type-Options" "nosniff"
check_header "Strict-Transport-Security" ""
check_header "Content-Security-Policy" ""
check_header "Referrer-Policy" ""
check_header "X-XSS-Protection" ""

# Check that X-Powered-By is removed
if echo "$RESPONSE" | grep -qi "X-Powered-By"; then
    echo "❌ X-Powered-By: SHOULD BE REMOVED (found: $(echo "$RESPONSE" | grep -i "X-Powered-By" | cut -d: -f2- | xargs))"
else
    echo "✅ X-Powered-By: Properly removed"
fi

echo ""
echo "-------------------------------------------"
echo "Verification complete!"
echo ""
echo "Usage: $0 [host] [port]"
echo "Example: $0 localhost 3000"
