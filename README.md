# Flow — Desktop AI Assistant

[![ci](https://github.com/Foshowithit/flow/actions/workflows/ci.yml/badge.svg)](https://github.com/Foshowithit/flow/actions/workflows/ci.yml)

**Flow** is a desktop AI assistant application built with Next.js 15, Tauri v2, and the Model Context Protocol (MCP). It provides a local-first, extensible AI chat experience with full MCP server management, tool execution, and audit logging.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   FLOW DESKTOP (Tauri v2)                      │
│  ┌─────────────┬──────────────────────┬─────────────────────┐  │
│  │ Sidebar     │     Chat Panel       │   Right Panel        │  │
│  │ (sessions,  │  messages, input,    │  MCP Panel /         │  │
│  │  navigation)│  artifacts, code     │  Knowledge / Files   │  │
│  │             │  blocks, markdown)   │  / Notes tabs        │  │
│  └─────────────┴──────────────────────┴─────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│                    API LAYER (Next.js 15)                       │
│  Sessions CRUD  │  Chat/Stream  │  Admin  │  Webhooks  │  ...  │
│  Auth: Clerk (web) / Guest mode (desktop)                       │
├────────────────────────────────────────────────────────────────┤
│                  MCP SYSTEM (Tauri Rust)                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Config│ │Perms │ │Audit │ │Cmds  │ │Proc  │ │Fixture│       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
│  7 Rust modules — 13 IPC commands                               │
└────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Tauri v2 |
| **Frontend** | Next.js 15 (App Router), React 19 |
| **Styling** | Tailwind CSS v4 |
| **Auth** | Clerk (web), Guest mode (desktop) |
| **Database** | PostgreSQL (Neon) |
| **MCP Backend** | Rust (IPC commands, config store, audit log) |
| **LLM Routing** | LiteLLM (via Gateway service) |
| **Language** | TypeScript (strict), Rust |
| **Package Manager** | npm workspaces |

## Monorepo Structure

```
flow/
├── apps/
│   ├── desktop/             # Next.js + Tauri desktop app
│   │   ├── app/             # Next.js App Router (pages, API routes)
│   │   ├── components/      # React components
│   │   │   ├── desktop/     # Desktop-specific components
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   ├── ChatMessages.tsx
│   │   │   │   ├── DesktopSidebar.tsx
│   │   │   │   ├── RightPanel.tsx
│   │   │   │   ├── McpPanel.tsx
│   │   │   │   ├── StatusBar.tsx
│   │   │   │   └── CommandPalette.tsx
│   │   │   └── ui/          # Primitive UI components
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── use-mcp.ts
│   │   │   ├── use-keyboard-shortcuts.ts
│   │   │   └── use-clerk-timeout.ts
│   │   ├── lib/             # Shared utilities & types
│   │   ├── scripts/         # Build & development scripts
│   │   └── src-tauri/       # Tauri Rust backend
│   │       ├── src/         # Rust source
│   │       │   ├── main.rs
│   │       │   ├── lib.rs
│   │       │   └── mcp/     # MCP module (7 files)
│   │       ├── fixtures/    # MCP test fixture servers
│   │       └── capabilities/ # Tauri capabilities
│   └── gateway/             # LiteLLM API gateway
│       ├── config/          # Provider routing configs
│       ├── control-plane/   # Gateway orchestration
│       └── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml           # CI pipeline
└── docs/
    └── roadmap.md
```

## Quick Start

### Prerequisites

- Node.js 22+
- Rust (latest stable)
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)
- PostgreSQL 16+ (or Neon account)

### Desktop Development

```bash
# Install dependencies
cd apps/desktop && npm install

# Run web-only dev server
npm run dev

# Run full Tauri desktop app with hot reload
npm run tauri dev

# Type-check, lint, and build
npm run validate
# or from repo root: npm run validate:desktop
```

### Full Stack (Desktop + Gateway)

```bash
# Start the LiteLLM gateway + Postgres
cd apps/gateway
cp .env.example .env        # Configure your API keys
docker compose up -d

# In another terminal, run the desktop app
cd apps/desktop && npm run dev
```

### Smoke Test

```bash
# Start the server first
cd apps/desktop && npm run dev

# In another terminal, run smoke tests
npm run smoke:desktop
```

## The MCP System

The Model Context Protocol (MCP) system is the core backend feature, fully implemented in Rust:

| Module | File | Purpose |
|---|---|---|
| `commands` | `src-tauri/src/mcp/commands.rs` | 13 IPC handlers for server config, audit, tool calls |
| `config` | `src-tauri/src/mcp/config.rs` | Config store CRUD + file persistence |
| `permissions` | `src-tauri/src/mcp/permissions.rs` | Permission store for tool call approval |
| `audit` | `src-tauri/src/mcp/audit.rs` | Structured audit log with persistence |
| `fixture` | `src-tauri/src/mcp/fixture.rs` | In-process safe fixture tools (echo, time, math) |
| `process` | `src-tauri/src/mcp/process.rs` | stdio process lifecycle management |
| `types` | `src-tauri/src/mcp/types.rs` | Shared MCP data types |

**Frontend MCP types:** `desktop/lib/mcp-types.ts`

The MCP Panel UI (1444-line component in `McpPanel.tsx`) provides:
- Server configuration CRUD
- Tool proposal approval/denial
- Permission management (allow once / deny)
- Audit log viewer
- Fixture server lifecycle

## Desktop UI Layout

Flow follows a 3-column desktop layout inspired by Claude Desktop:

```
┌──────────┬────────────────────────────┬──────────────┐
│          │                            │              │
│ SIDEBAR  │        CHAT PANEL          │ RIGHT PANEL  │
│          │                            │              │
│ Sessions │  Messages + Artifacts      │ MCP Config   │
│ Settings │  Input + Attachments       │ Knowledge     │
│ Theme    │  Code blocks w/ preview    │ Files         │
│          │                            │ Notes         │
│ Cmd+K →  │  Keyboard: Cmd+Enter send  │ Cmd+B toggle │
│ Palette  │  Cmd+Shift+E edit mode    │              │
└──────────┴────────────────────────────┴──────────────┘

┌──────────────────────────────────────────────────────────┐
│                      STATUS BAR                           │
│  Connection status  |  Model indicator  |  MCP status    │
└──────────────────────────────────────────────────────────┘
```

## CI/CD
The project uses GitHub Actions for CI with 5 validation jobs:

1. **Validate Desktop** — TypeScript type-check, ESLint, Next.js build
2. **Validate Gateway** — Gateway configuration validation
3. **Rust (Clippy + Check)** — Cargo check + clippy (warnings denied)
4. **Playwright E2E Tests** — Chromium e2e tests against live dev server
5. **Monorepo Root** — Workspace integrity + uncommitted changes check

## Building for Production

```bash
# Next.js static export + Tauri build
npm run build

# This runs:
#   1. scripts/static-export.mjs   — strips non-desktop routes
#   2. npx next build              — builds Next.js
#   3. tauri build                 — packages Tauri app
```

## Scripts

| Script | Description |
|---|---|
| `dev` | Next.js dev server (web only) |
| `tauri dev` | Full Tauri desktop dev with hot reload |
| `build` | Static export → Tauri build pipeline |
| `validate` | TypeScript check + ESLint + Next.js build |
| `smoke:desktop` | API smoke tests (requires running server) |

## License

Private — internal project.
