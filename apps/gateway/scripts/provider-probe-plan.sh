#!/usr/bin/env bash
# ============================================================================
# provider-probe-plan.sh — Safe Provider Probe Plan (Dry-Run by Default)
# ============================================================================
# Usage:
#   ./scripts/provider-probe-plan.sh                          # dry-run only
#   FLOW_PROBE_EXECUTE=1 ./scripts/provider-probe-plan.sh     # refused — not implemented
#
# This script plans provider probes — it reads FLOW_PROVIDERS and
# FLOW_TEST_MODELS (with sensible defaults) and prints what it intends
# to probe.  It NEVER makes API calls.
#
# Safety:
#   - Default (no env var) = dry-run.  Only prints the plan.
#   - FLOW_PROBE_EXECUTE=1 prints "execution not implemented yet" and
#     exits nonzero.
#   - Does not read or print secrets.
#   - No paid API calls are made.
# ============================================================================

set -euo pipefail

PROBE_EXECUTE="${FLOW_PROBE_EXECUTE:-0}"

# ── Configuration from environment ────────────────────────────────────────
# Override with FLOW_PROVIDERS and FLOW_TEST_MODELS to test specific combos.
# Defaults match the current config.yaml model registry.
FLOW_PROVIDERS="${FLOW_PROVIDERS:-fireworks_ai deepinfra makora}"
FLOW_TEST_MODELS="${FLOW_TEST_MODELS:-deepseek-v4-flash deepseek-ai/DeepSeek-V4-Flash makora-default}"

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Functions ──────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

print_header() {
    echo ""
    echo "================================================================"
    echo "  Flow — Provider Probe Plan"
    echo "  Mode: DRY-RUN (no API calls — this script NEVER executes)"
    echo "================================================================"
    echo ""
}

print_plan() {
    local -a providers=($1)
    local -a models=($2)
    local combo_count=$(( ${#providers[@]} * ${#models[@]} ))

    echo "---------------------------------------------------------------"
    echo "  Environment overrides:"
    echo "    FLOW_PROVIDERS    = ${providers[*]}"
    echo "    FLOW_TEST_MODELS  = ${models[*]}"
    echo "  Planned probes: ${combo_count} combination(s)"
    echo "  Dry-run: YES  🔒"
    echo "  FLOW_PROBE_EXECUTE=${PROBE_EXECUTE}"
    echo "---------------------------------------------------------------"
    echo ""

    local i=0
    for prov in "${providers[@]}"; do
        for mod in "${models[@]}"; do
            i=$((i + 1))
            info "Probe #${i}:  provider=${prov}  model=${mod}"
        done
    done
}

# ── Main ───────────────────────────────────────────────────────────────────

print_header
print_plan "$FLOW_PROVIDERS" "$FLOW_TEST_MODELS"

echo ""
echo "================================================================"

if [ "$PROBE_EXECUTE" = "1" ]; then
    error "FLOW_PROBE_EXECUTE=1 is set, but execution is not implemented yet."
    echo ""
    echo "  This script is a placeholder for future API probe logic."
    echo "  To run dry-run only (safe), unset FLOW_PROBE_EXECUTE or set it to 0."
    echo "================================================================"
    exit 1
fi

success "Dry-run complete.  No API calls were made."
echo "  ▶ To view the probe plan, just re-run this script."
echo "================================================================"
