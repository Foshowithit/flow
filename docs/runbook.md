# Runbook

## Local gateway

```bash
npm run validate:gateway
```

## Local desktop

```bash
cd apps/desktop
npm install
npm run typecheck
npm run lint
npm run build
```

## Mock chat smoke

```bash
MOCK_CHAT=true npm run smoke:desktop
```

## Recovery

- If the desktop app reports provider unavailability, verify `MOCK_CHAT=true` or a real provider key.
- If the gateway config fails, check `docker compose config` first.
- Keep secrets out of the repo and use `.env.example` as the only template.
