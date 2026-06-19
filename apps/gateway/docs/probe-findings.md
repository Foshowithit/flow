# Probe Findings — Makora Evidence Summary

> Findings gathered during the initial Flow MVP session on 2026-06-19.
> No secrets or credentials are recorded here.

## Confirmed Makora Capabilities

### 1. OpenAI-Compatible API

Makora exposes a standard OpenAI-compatible API at `https://inference.makora.com/v1`. All standard endpoints (`/v1/chat/completions`, `/v1/embeddings`) work with the standard OpenAI request/response schema.

### 2. Health Endpoint

`GET /health` returns a simple health check response. Confirmed working without authentication.

### 3. Model List (Authenticated)

`GET /v1/models` requires a valid API key in the `Authorization: Bearer <key>` header. Returns a list of available models with standard OpenAI model objects (`id`, `object`, `created`, `owned_by`).

### 4. Azure Backend

The API is proxied through Azure infrastructure. Evidence:
- `x-azure-ref` response headers
- `azure` present in response metadata
- Standard Azure API management patterns

### 5. Chat Completion

`POST /v1/chat/completions` with standard OpenAI format works reliably. Authentication is via Bearer token in the Authorization header.

### 6. Pi Route Test

A test completion via the `pi` session (subagent-chat-019eddae) received a valid response, confirming the route works end-to-end.

## Key Observations

| Observation | Detail |
|---|---|
| API base URL | `https://inference.makora.com/v1` |
| Auth scheme | Bearer token (standard OpenAI) |
| Framework | Likely Azure-hosted with custom middleware |
| Model prefix | Models returned by `/v1/models` use un-prefixed IDs |
| Rate limits | Not probed — assume generous but rate-limited |

## Implications for Flow

- Makora can be treated as an OpenAI-compatible upstream → trivial LiteLLM integration
- Azure backend means no direct GPU access → aligns with bridge strategy
- Flow's `flow/` prefix avoids model ID collision with Makora's native IDs
- Auth model is identical → Flow can mirror the exact developer experience
