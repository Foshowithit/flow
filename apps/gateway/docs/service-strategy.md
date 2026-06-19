# Service Strategy — Flow Gateway

> **Version:** 2026-06-19  
> **Status:** MVP Bridge Phase  

---

## Service Positioning

Flow is a **provider identity** — not a model provider itself, but the routing
bridge that presents a unified OpenAI-compatible API to Optimized Workflow
clients. The `flow/` model prefix is the only identity users see; the upstream
provider is an implementation detail.

**Differentiator:** Flow is a **provider endpoint plus an observable
agent/operator control plane** — see [`docs/control-plane.md`](control-plane.md)
for how provider probes, routing health, cost monitoring, and self-host ops
make Flow inspectable in ways Makora cannot offer.

**Key principle:** Flow owns the user experience; providers are interchangeable
backends.

```
  User App
     │
     ▼
┌──────────────────────┐
│   Flow Gateway       │  ← provider identity
│   (LiteLLM proxy)    │  ← routing bridge
└────┬─────┬─────┬─────┘
     │     │     │
     ▼     ▼     ▼
┌──────┐ ┌──────┐ ┌────────┐
│Fire  │ │Deep  │ │ Makora │  ← interchangeable upstreams
│works │ │Infra │ │(bench) │
└──────┘ └──────┘ └────────┘
```

---

## Launch Scope

### MVP (current)

| Aspect | Detail |
|---|---|
| Gateway | LiteLLM proxy, Docker Compose stack |
| Auth | Single `FLOW_MASTER_KEY`, Bearer token |
| Models | `flow/deepseek-v4-flash`, `flow/deepinfra-default`, `flow/makora-default` |
| Routing | Usage-based with explicit fallback chains |
| Database | PostgreSQL for usage tracking (optional in MVP) |

### Near-term (weeks 1–2)

| Aspect | Detail |
|---|---|
| Self-hosted vLLM | Deploy vLLM node, add to config, test fallback |
| Monitoring | OpenTelemetry tracing, basic dashboards |
| Model diversity | Add more models via Fireworks / DeepInfra |

### Future

- Per-user API keys
- Fine-tuned adapter hosting
- Custom routing policies (latency vs cost vs capacity)

---

## Upstream Strategy

### Primary Working Upstreams

1. **Fireworks AI** — primary for `flow/deepseek-v4-flash` and future Flash-class
   models.
   - Fast inference, generous free/paid tier.
   - API base: `https://api.fireworks.ai/inference/v1`

2. **DeepInfra** — primary for Llama-class models and first fallback for Flash.
   - Self-serve, good availability, competitive pricing.
   - API base: `https://api.deepinfra.com/v1/openai`

### Tertiary / Benchmark

3. **Makora** — tertiary fallback and benchmark target. Flow aims to replicate
   Makora's exact developer experience, so Makora is the reference
   implementation.
   - **⚠️ Sold-out risk:** Makora may be capacity-constrained; do not rely on
     Makora for production traffic.
   - Use for: A/B comparison, benchmark validation, low-priority fallback.
   - API base: `https://inference.makora.com/v1`

### Disabled (until topped up)

| Provider | Reason | Re-enable when |
|---|---|---|
| DeepSeek direct | No prepaid credit remaining | Account topped up |
| OpenRouter | No prepaid credit remaining | Account topped up |

These entries are preserved as comments in `config/config.yaml` for quick
re-enablement.

### Summary Table

| Priority | Provider | Role | Status |
|---|---|---|---|
| 1° | Fireworks AI | Primary for Flash models | ✅ Working |
| 2° | DeepInfra | Primary for Llama / Flash fallback | ✅ Working |
| 3° | Makora | Tertiary fallback, benchmark | ⚠️ Sold-out risk |
| — | DeepSeek direct | Disabled | 🔴 No credit |
| — | OpenRouter | Disabled | 🔴 No credit |
| 🔜 | Self-hosted vLLM | Near-term self-hosted lane | 📋 Planned |

---

## Self-Host Plan

### Phase 1 — Near-term lane (weeks 1–2)

1. Deploy a vLLM inference server on available GPU hardware.
2. Add the vLLM endpoint to `config/config.yaml` (uncomment
   `flow/self-hosted-vllm`).
3. Configure fallback chain: self-hosted → Fireworks → DeepInfra.
4. Route high-volume or latency-sensitive models to self-hosted capacity.

### Phase 2 — Hybrid (weeks 3–6)

1. Add multiple vLLM nodes with load balancing.
2. Implement automatic failover between self-hosted and provider backends.
3. Begin fine-tuning adapters for owned models.

### Phase 3 — Owned capacity (future)

1. No provider dependency for core models.
2. All inference on owned hardware.
3. Zero-downtime migration — the API contract never changes.

---

## What Not To Do

- ❌ **Do not hardcode API keys** in config files. Use `.env` or a secrets
  manager.
- ❌ **Do not rely on Makora** for production traffic — treat it as a benchmark
  only.
- ❌ **Do not commit `.env`** to version control.
- ❌ **Do not enable DeepSeek direct or OpenRouter** until accounts are topped
  up.
- ❌ **Do not deploy to production** without configuring master key rotation and
  database-backed usage tracking.
- ❌ **Do not use `latest` tags** in production Docker images — pin versions.

---

## Week-1 Checklist

- [ ] Obtain Fireworks AI API key and add to `.env`
- [ ] Verify DeepInfra API key is active
- [ ] Run `make validate` — YAML parse and docker compose config
- [ ] Run `make compose-config` with dummy env vars
- [ ] Start stack: `docker compose up -d`
- [ ] Run smoke test: `export FLOW_MASTER_KEY=... && make smoke`
- [ ] Verify `/health` returns 200
- [ ] Verify `/v1/models` returns model list
- [ ] Verify chat completion with `flow/deepseek-v4-flash` works via Fireworks
- [ ] Verify fallback to DeepInfra (remove Fireworks key, test again)
- [ ] Review logs for warnings / errors
- [ ] Tag initial working config as a git snapshot

---

## Related Documents

- [Architecture](architecture.md) — Bridge → Hybrid → Owned progression
- [Control Plane](control-plane.md) — Observable agent/operator control plane (Flow differentiator)
- [Probe Findings](probe-findings.md) — Makora capability evidence
