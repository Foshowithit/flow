# PROGRESS — Flow Control Plane Loop State

> **Source of truth for the current orchestration loop.**  
> Updated by the orchestrator after each probe round or health check pass.  
> Git-tracked for audit trail.

---

## Current Run

| Field | Value |
|---|---|
| **Run ID** | `flow_run_<timestamp>` |
| **Run Type** | `provider_probe` / `route_health` / `eval_campaign` |
| **Status** | `running` / `paused` / `completed` / `failed` |
| **Started** | 2026-06-19T12:00:00Z |
| **Updated** | 2026-06-19T12:30:00Z |

---

## Gates

### GATE-001: Initial Provider Probe Round
**Status:** OPEN  
**Description:** Review initial probe results for Fireworks AI, DeepInfra, Makora  
**Criteria to close:**
- At least 3 successful probes per provider
- No timeout errors > 2s
- Cost per model within budget (see `estimated_cost_usd` in probe results)
**Closed by:** <name> on YYYY-MM-DD

### GATE-002: Self-Host vLLM Onboarding
**Status:** OPEN  
**Description:** Review self-hosted vLLM node health before shifting traffic  
**Criteria to close:**
- Route score > 0.90 for self-hosted lane
- Latency p95 < 2x provider baseline
- Human approval
**Closed by:** <name> on YYYY-MM-DD

---

## Probe History

| Round | Provider | Models | Status | Avg Latency (ms) | Cost (USD) | Date |
|---|---|---|---|---|---|---|
| 1 | Fireworks AI | deepseek-v4-flash | completed | 450 | 0.000015 | 2026-06-19 |
| 1 | DeepInfra | deepseek-v4-flash | completed | 520 | 0.000012 | 2026-06-19 |
| 1 | Makora | makora-default | completed | 680 | 0.000018 | 2026-06-19 |
| — | Self-hosted vLLM | — | pending | — | — | — |

---

## Route Health

| Provider | Last Score | Trend | Notes |
|---|---|---|---|
| Fireworks AI | 0.98 | → stable | Primary, healthy |
| DeepInfra | 0.95 | → stable | Fallback, healthy |
| Makora | 0.85 | ↓ degrading | Sold-out risk, monitor |
| Self-hosted vLLM | — | — | Not yet deployed |

---

## Cost Summary

| Provider | Est. Cost / 1K calls | Monthly Est. (1M calls) | Notes |
|---|---|---|---|
| Fireworks AI | $0.015 | $15.00 | Primary |
| DeepInfra | $0.012 | $12.00 | Fallback |
| Makora | $0.018 | $18.00 | Benchmark only |
| Self-hosted vLLM | — | — | Fixed HW + electric |

---

## Next Actions

- [ ] Close GATE-001 after reviewing round 1 probes
- [ ] Deploy self-hosted vLLM node
- [ ] Run route health check for self-hosted lane
- [ ] Update fallback chains based on probe evidence
