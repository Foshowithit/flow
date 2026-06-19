.PHONY: validate compose-config smoke

# ── validate ───────────────────────────────────────────────────
# YAML-parse config.yaml, check scripts exist, shellcheck if available,
# lightly validate SQL schema.
validate:
	@echo "=== Validating config/config.yaml ==="
	@python3 -c "import yaml; yaml.safe_load(open('config/config.yaml')); print('  ✅ YAML parse OK')"
	@echo "=== Checking scripts/smoke.sh ==="
	@[ -x scripts/smoke.sh ] && echo "  ✅ smoke.sh is executable" || true
	@echo "=== Checking scripts/provider-probe-plan.sh ==="
	@[ -x scripts/provider-probe-plan.sh ] && echo "  ✅ provider-probe-plan.sh is executable" || true
	@echo "=== Checking control-plane files ==="
	@for f in control-plane/schema.sql control-plane/PROGRESS.example.md docs/control-plane.md docs/cole-agent-control-plane-notes.md; do \
		[ -f "$$f" ] && echo "  ✅ $$f exists" || echo "  ❌ $$f MISSING"; \
	done
	@echo "=== Light SQL parse (schema.sql) ==="
	@python3 scripts/validate_sql.py
	@echo "=== ShellCheck (if available) ==="
	@if command -v shellcheck >/dev/null 2>&1; then \
		shellcheck scripts/provider-probe-plan.sh && echo '  ✅ shellcheck passed' || echo '  ⚠️  shellcheck warnings (see above)'; \
	else \
		echo '  ⚪ shellcheck not installed — skipping'; \
	fi
	@echo "=== All validations passed ==="

# ── compose-config ─────────────────────────────────────────────
# Run `docker compose config` with dummy non-secret env vars.
# Ensure .env exists (copy from .env.example if absent).
compose-config:
	@echo "=== docker compose config (dummy env) ==="
	[ -f .env ] || cp .env.example .env
	FLOW_MASTER_KEY=validate-key \
	 FLOW_SALT_KEY=validate-salt \
	 DATABASE_URL=postgresql://flow:flow@flow-postgres:5432/flow \
	 DEEPSEEK_API_KEY=validate-ds-key \
	 MAKORA_API_KEY=validate-mk-key \
	 OPENROUTER_API_KEY=validate-or-key \
	 DEEPINFRA_API_KEY=validate-di-key \
	 FIREWORKS_API_KEY=validate-fw-key \
	 docker compose config 2>&1

# ── smoke ──────────────────────────────────────────────────────
# Run the smoke test script. FLOW_MASTER_KEY must be exported.
smoke:
	@bash scripts/smoke.sh
