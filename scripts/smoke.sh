#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────
# Flow Gateway — Smoke Test
# Checks: /health, /v1/models, and a minimal chat completion.
#
# Usage:
#   export FLOW_MASTER_KEY="sk-..."    # required
#   export FLOW_BASE_URL="http://localhost:4000"   # optional, default below
#   export FLOW_TEST_MODEL="flow/deepseek-v4-flash" # optional, default below
#   bash scripts/smoke.sh
#
# Legacy env vars (still supported):
#   BASE_URL, MODEL
# ────────────────────────────────────────────────────────────────

# Support both new (FLOW_*) and legacy env var names; new takes precedence.
BASE_URL="${FLOW_BASE_URL:-${BASE_URL:-http://localhost:4000}}"
MODEL="${FLOW_TEST_MODEL:-${MODEL:-flow/deepseek-v4-flash}}"

if [ -z "${FLOW_MASTER_KEY:-}" ]; then
	echo "❌ FLOW_MASTER_KEY is not set. Export it before running."
	echo "   export FLOW_MASTER_KEY=\"sk-your-key\""
	exit 1
fi

AUTH="Authorization: Bearer $FLOW_MASTER_KEY"
PASS=0
FAIL=0

check() {
	local label="$1"
	shift
	echo -n "  ▶ $label ... "
	if "$@" >/tmp/flow-smoke-out 2>&1; then
		echo "✅"
		PASS=$((PASS + 1))
	else
		echo "❌"
		cat /tmp/flow-smoke-out
		FAIL=$((FAIL + 1))
	fi
}

echo "━━━ Flow Smoke Test ━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Base:  $BASE_URL"
echo "  Model: $MODEL"
echo ""

# 1. Health
check "GET /health" curl -sf "$BASE_URL/health"

# 2. Model list (requires master key)
check "GET /v1/models" curl -sf -H "$AUTH" "$BASE_URL/v1/models"

# 3. Chat completion (minimal)
check "POST /v1/chat/completions" curl -sf \
	-H "Content-Type: application/json" \
	-H "$AUTH" \
	-d "$(
		cat <<JSON
{
  "model": "$MODEL",
  "messages": [{"role": "user", "content": "Say OK and nothing else."}],
  "max_tokens": 10,
  "temperature": 0
}
JSON
	)" \
	"$BASE_URL/v1/chat/completions"

echo ""
echo "━━━ Results ─────────────────────────────────"
echo "  Passed: $PASS    Failed: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
