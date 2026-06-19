# Cole Agent Control Plane — Pattern Summary

> This document records the **Cole** (Agent Control Plane) pattern as applied to Flow,
> preserving institutional memory for future developers.

---

## What Is the Cole Pattern?

The **Agent Control Plane** (Cole) is a runtime observability and orchestration
pattern originally developed for Pi-based agent sessions. Its key insight: **an
agent system is only as reliable as its visibility into its own operation.**

Cole requirements:
- **Bun/TS backend** — typed, fast, single-language control plane server
- **React dashboard** — real-time UI for run state, route health, cost
- **Pi headless JSON** — agent-orchestrated probes and data collection
- **Neon/Postgres persistence** — run history, events, probe results
- **Run history** — every probe round is a `flow_run` with events
- **Pause/resume gates** — human-in-the-loop halt points

---

## How Cole Maps to Flow

| Cole Component | Flow Equivalent | Rationale |
|---|---|---|
| Bun/TS backend | LiteLLM proxy + Makefile targets | Flow uses LiteLLM for routing; control plane is docs + scripts + DB schema for now. A future Bun/TS backend could replace shell scripts. |
| React dashboard | Not implemented (future) | Dashboards could be built on top of the Postgres tables. For now, `provider_probe_results` queries fill this gap. |
| Pi headless JSON | `scripts/provider-probe-plan.sh` | The probe script is a headless agent that runs provider evaluations. Results are structured for machine consumption. |
| Neon/Postgres | Postgres tables in `control-plane/schema.sql` | Same persistence model. Neon is recommended for production (serverless Postgres with branching); local Postgres for dev. |
| Run history | `flow_runs` + `flow_run_events` | Every probe round and health check is a run with timestamped events. |
| Pause/resume gates | `PROGRESS.md` `## Gates` section | Human gates prevent automated decisions from incurring unexpected costs. |

---

## Why Cole Matters for Flow

1. **Makora cannot do this.** Makora provides inference-only; there is no
   control plane, no run history, no cost-per-model tracking, no provider
   health dashboard. Cole gives Flow a structural advantage.

2. **Self-host migration requires it.** When Flow shifts from provider routing
   to self-hosted vLLM, the control plane tables become essential for tracking
   node health, capacity, and cost.

3. **Audit trail.** Every probe, every route health check, every cost
   measurement is recorded. This satisfies compliance and debugging needs
   that a black-box inference service cannot.

4. **Human oversight.** Gates prevent automation from spending unbudgeted money
   or making bad routing decisions. This is critical during the hybrid phase
   when both paid providers and self-hosted capacity are in play.

---

## Implementation Status

| Item | Status | Notes |
|---|---|---|
| DB schema (`schema.sql`) | ✅ Scaffold | Run against your Postgres instance |
| Probe script (`provider-probe-plan.sh`) | ✅ Scaffold | Dry-run by default; `FLOW_PROBE_EXECUTE=1` enables execution |
| PROGRESS template | ✅ Scaffold | Copy to `PROGRESS.md` per loop |
| Control plane doc | ✅ Complete | `docs/control-plane.md` |
| Makefile validate | ✅ Updated | Checks files exist |
| React dashboard | 🔜 Future | Not yet started |
| Bun/TS backend | 🔜 Future | Not yet started |

---

## References

- [`docs/control-plane.md`](control-plane.md) — full control plane explanation
- [`control-plane/schema.sql`](../control-plane/schema.sql)
- [`scripts/provider-probe-plan.sh`](../scripts/provider-probe-plan.sh)
- [Service Strategy](service-strategy.md)
