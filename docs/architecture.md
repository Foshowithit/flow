# Flow Architecture

Flow is a local monorepo for Optimized Workflow with two major parts:

- `apps/gateway/` — provider gateway + control plane
- `apps/desktop/` — desktop assistant / chat surface

## Runtime model

1. The desktop app sends chat traffic to the Flow gateway.
2. The gateway routes requests to the selected upstream provider or a mock/dev fallback.
3. The control plane records probes, routing decisions, and operational notes.
4. Local developer tooling stays in the repo root, but the app packages own their own build and smoke commands.

## Transition note

The gateway scaffold still exists at the repo root during the transition.
`apps/gateway/` is the workspace copy for new work, while the root remains a stable fallback until the move is complete.
