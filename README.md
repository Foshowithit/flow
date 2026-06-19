# Flow

Flow is being prepared as a **company-grade local monorepo** for Optimized Workflow.

## Current shape

- `apps/gateway/` — the provider / control-plane scaffold (mirrored from the current gateway root during transition)
- `apps/desktop/` — the desktop assistant app imported from the existing Flow desktop source tree
- repo root — workspace / driver layer and local company scaffolding

## Local developer path

```bash
npm run validate:gateway
npm run validate:desktop
MOCK_CHAT=true npm run smoke:desktop
```

## Notes

- No GitHub push yet.
- No secrets are committed.
- Root gateway files remain in place for now; `apps/gateway/` is the workspace copy used for new work.
- Desktop environment defaults live in `apps/desktop/.env.example`.
- Gateway defaults live in the root `.env.example`.

## Company docs

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/runbook.md`](docs/runbook.md)
- [`docs/README.md`](docs/README.md)
