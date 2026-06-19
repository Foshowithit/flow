# Flow Architecture

> **Progression:** Bridge → Hybrid → Owned Capacity

Flow replicates the full Makora experience — unified OpenAI-compatible API, model abstraction, key-based auth — while enabling incremental migration to self-owned inference.

## Phase 1: Bridge (MVP)

```
  User App
     │
     ▼
  ┌──────────────────────┐
  │   Flow Gateway       │  LiteLLM proxy, port 4000
  │   (docker compose)   │
  └────┬─────┬─────┬─────┘
       │     │     │
       ▼     ▼     ▼
  ┌─────┐ ┌─────┐ ┌──────────┐
  │Makora│ │Deep │ │OpenRouter│  Upstream API providers
  └─────┘ └─────┘ └──────────┘
```

The MVP is pure routing. Flow is an OpenAI-compatible proxy that:

- Accepts requests with a `flow/`-prefixed model name
- Translates to the upstream provider model + endpoint
- Returns standard OpenAI chat completion responses
- Handles auth via a shared `FLOW_MASTER_KEY`
- Logs/spans (future: OpenTelemetry)

**This is exactly what Makora does**, except the backend is a configurable router rather than a single provider. The user experience is identical: one API key, one base URL, any model.

## Phase 2: Hybrid

```
  User App
     │
     ▼
  ┌──────────────────────────┐
  │    Flow Gateway          │
  │  (LiteLLM + custom       │
  │   routing logic)         │
  └────┬──────────┬──────────┘
       │          │
       ▼          ▼
  ┌────────┐ ┌──────────┐
  │Own vLLM│ │ Upstream │  Mix of self-hosted & provider
  │ nodes  │ │ fallback │
  └────────┘ └──────────┘
```

Flow routes to owned vLLM nodes for high-volume or latency-sensitive models, with automatic fallback to providers when self-hosted capacity is exhausted or during maintenance.

## Phase 3: Owned Capacity

```
  User App
     │
     ▼
  ┌──────────────────────────┐
  │   Flow Gateway           │
  │   (minimal proxy)        │
  └────┬─────────────────────┘
       │
       ▼
  ┌──────────────────────────┐
  │  Self-hosted GPU Cluster │
  │  vLLM · TGI · TensorRT  │
  │  Fine-tuned adapters     │
  └──────────────────────────┘
```

No provider dependency. All inference runs on owned hardware. The gateway still presents the same API — the migration is transparent to users.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| LiteLLM as gateway | Battle-tested OpenAI proxy; model routing, key auth, DB-backed usage tracking out of the box |
| `flow/` model prefix | Avoids collisions with upstream model names; clear namespace ownership |
| Postgres backend | Usage tracking, spend limits, user management (future) |
| Health endpoint on gateway | Simplifies orchestration; no need to probe individual providers |
| Master key auth | Single key for MVP; per-user keys in hybrid phase |

## Comparison: Makora vs Flow

| Capability | Makora | Flow (Bridge) | Flow (Future) |
|---|---|---|---|
| Unified OpenAI API | ✅ | ✅ | ✅ |
| Multiple base models | ✅ | ✅ (routed) | ✅ (owned) |
| Fast inference | ✅ | Depends on provider | ✅ (self-hosted) |
| No provider dependency | ❌ (is a provider) | ❌ (routes to providers) | ✅ |
| Fine-tuned adapters | ❌ | ❌ | ✅ |
| Custom routing logic | ❌ | ✅ (LiteLLM router) | ✅ |
