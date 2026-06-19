# Flow — Optimized Workflow Inference Gateway

> **Mission:** Do everything [Makora](https://makora.com) does end-to-end under
> the Optimized Workflow ecosystem — then **go further** with an observable
> agent/operator control plane that Makora cannot offer.
>
> 📖 **Control Plane:** See [`docs/control-plane.md`](docs/control-plane.md)
> for how Flow differentiates via provider probes, routing health, cost
> monitoring, and self-host ops.

> **Mission:** Do everything [Makora](https://makora.com) does end-to-end under
> the Optimized Workflow ecosystem. In the MVP phase, Flow is a **bridge** — a
> LiteLLM-based OpenAI-compatible proxy that routes to Fireworks AI, DeepInfra,
> and Makora. Over time, Flow will grow into fully owned inference capacity
> (self-hosted vLLM, fine-tuned adapters, bespoke routing).

## Differentiation: Observable Control Plane

Makora is a black-box inference provider. Flow is a **provider endpoint plus
an observable agent/operator control plane**:

| Makora | Flow |
|---|---|
| ✅ Unified OpenAI-compatible API | ✅ Same API |
| ❌ No provider health visibility | ✅ `provider_probe_results` table |
| ❌ No routing decision trace | ✅ `flow_run_events` with evidence |
| ❌ No cost per model | ✅ `estimated_cost_usd` in probe results |
| ❌ No pause/resume gates | ✅ Human gates in PROGRESS.md |
| ❌ No self-host lane management | ✅ Control plane tables for self-host ops |

See [`docs/control-plane.md`](docs/control-plane.md) for details.

>
> 📖 **Service strategy:** See [`docs/service-strategy.md`](docs/service-strategy.md)
> for detailed upstream positioning, what's disabled, and the self-host roadmap.
>
> 

## Philosophy

Flow replicates the Makora experience — unified OpenAI-compatible API, model
abstraction, key-based auth — while enabling incremental migration to
self-owned inference.

The `flow/` model prefix is the **only identity users see**. The upstream
provider is an implementation detail managed by routing configuration.

| Phase | Description |
|---|---|
| **Bridge** (MVP) | LiteLLM proxy routing to Fireworks AI, DeepInfra, and Makora |
| **Hybrid** (near-term) | Blend self-hosted vLLM nodes with selective provider usage |
| **Owned** (future) | Zero provider dependency — all inference on owned GPUs |

## Quickstart

### Prerequisites

- Docker & Docker Compose
- An API key from at least one primary upstream provider (Fireworks AI or
  DeepInfra)

### 1. Clone & configure

```bash
git clone <repo-url> flow
cd flow
cp .env.example .env
# Edit .env with your real API keys
```

### 2. Validate configuration

```bash
make validate       # YAML syntax + script checks
make compose-config # structural docker compose validation
```

### 3. Start

```bash
docker compose up -d
```

### 4. Verify health

```bash
curl -s http://localhost:4000/health | jq .
```

Expected: `{"status":"ok"}` (or similar LiteLLM health response)

### 5. List models

```bash
curl -s http://localhost:4000/v1/models \
  -H "Authorization: Bearer $FLOW_MASTER_KEY" | jq .
```

### 6. Chat completion

```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FLOW_MASTER_KEY" \
  -d '{
    "model": "flow/deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }' | jq .
```

### 7. Smoke test

```bash
export FLOW_MASTER_KEY="sk-..."
make smoke
```

## Model Registry

| Model ID | Upstream | Provider | Status |
|---|---|---|---|
| `flow/deepseek-v4-flash` | DeepSeek-V4 Flash | Fireworks AI (primary) | ✅ Active |
| `flow/deepseek-v4-flash-deepinfra` | DeepSeek-V4 Flash | DeepInfra (fallback) | ✅ Active |
| `flow/deepinfra-default` | Llama 3.3 70B Turbo | DeepInfra | ✅ Active |
| `flow/deepseek-v4-flash-makora` | DeepSeek-V4 Flash | Makora (tertiary) | ⚠️ Fallback only |
| `flow/makora-default` | Makora primary model | Makora | ⚠️ Benchmark only |
| `flow/self-hosted-vllm` | *placeholder* | Self-hosted vLLM | 🔜 Planned |

> **Note:** Model IDs use the `flow/` prefix for namespace clarity. Upstream
> model mappings are in `config/config.yaml`. See
> [`docs/service-strategy.md`](docs/service-strategy.md) for the full upstream
> strategy, including providers that are currently disabled (DeepSeek direct,
> OpenRouter) until accounts are topped up.

## Configuration

Edit `config/config.yaml` to:

- Add/remove models from the registry
- Adjust routing weights, fallback order, and cooldown timers
- Change the master key or database backend
- Re-enable disabled providers (DeepSeek, OpenRouter) when topped up

## Local Development

```bash
make validate       # YAML parse + script checks
make compose-config # structural Compose check (dummy env vars)
make smoke          # run smoke tests (requires FLOW_MASTER_KEY)
```

## Safety & Secrets

- **No secrets in code.** API keys live in `.env` (git-ignored). Never commit
  `.env`.
- The `.env.example` file uses obvious placeholder values; never put real keys
  there.
- Master key should be a strong random string — treat it like a root password.

## Future: Self-Hosted Backend

The `config/config.yaml` includes a commented `flow/self-hosted-vllm` entry as a
placeholder. When self-hosted capacity is ready:

1. Uncomment the model entry
2. Point `api_base` to your vLLM server
3. Configure fallback: self-hosted → Fireworks → DeepInfra
4. Optionally remove upstream provider entries

This design allows a zero-downtime migration from bridge → hybrid → owned.

## License

Proprietary — Optimized Workflow internal.
