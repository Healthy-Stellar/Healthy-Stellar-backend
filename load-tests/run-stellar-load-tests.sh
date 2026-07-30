#!/usr/bin/env bash
# run-stellar-load-tests.sh
#
# Convenience wrapper that runs the Stellar write load-test suite against a
# chosen target environment. Requires k6 ≥ 0.49 to be on PATH.
#
# Usage:
#   ./run-stellar-load-tests.sh                        # local defaults
#   ./run-stellar-load-tests.sh testnet <JWT>          # Stellar testnet
#   ./run-stellar-load-tests.sh staging <JWT> https://staging.example.com
#
# Arguments (all optional, positional):
#   $1  ENVIRONMENT  – one of: local | testnet | staging  (default: local)
#   $2  AUTH_TOKEN   – JWT to pass as Bearer token         (default: placeholder)
#   $3  BASE_URL     – full API base URL                   (default: http://localhost:3000)

set -euo pipefail

ENVIRONMENT="${1:-local}"
AUTH_TOKEN="${2:-testnet-jwt-placeholder}"
BASE_URL="${3:-http://localhost:3000}"
SCENARIO="${SCENARIO:-all}"   # override with: SCENARIO=smoke ./run-...

RESULTS_DIR="$(dirname "$0")/results"
mkdir -p "$RESULTS_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Stellar Write Load-Test Runner                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "  Environment : $ENVIRONMENT"
echo "  Base URL    : $BASE_URL"
echo "  Scenario    : $SCENARIO"
echo ""

# Confirm k6 is available
if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 is not installed. See https://k6.io/docs/get-started/installation/"
  exit 1
fi

run_scenario() {
  local name="$1"
  local file="$2"
  echo "──────────────────────────────────────────────────────────"
  echo "  Running: $name"
  echo "──────────────────────────────────────────────────────────"
  k6 run \
    --env BASE_URL="$BASE_URL" \
    --env AUTH_TOKEN="$AUTH_TOKEN" \
    --out "json=$RESULTS_DIR/${name}-$(date +%Y%m%d_%H%M%S).json" \
    "$file"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$SCENARIO" in
  smoke)
    run_scenario "smoke"  "$SCRIPT_DIR/stellar-write/smoke.js"
    ;;
  stress)
    run_scenario "stress" "$SCRIPT_DIR/stellar-write/stress.js"
    ;;
  soak)
    run_scenario "soak"   "$SCRIPT_DIR/stellar-write/soak.js"
    ;;
  full)
    run_scenario "full"   "$SCRIPT_DIR/stellar-write/stellar-write.test.js"
    ;;
  all|*)
    run_scenario "smoke"  "$SCRIPT_DIR/stellar-write/smoke.js"
    run_scenario "full"   "$SCRIPT_DIR/stellar-write/stellar-write.test.js"
    ;;
esac

echo ""
echo "✅  All scenarios complete. Results in: $RESULTS_DIR"