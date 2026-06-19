# Claude Desktop — Complete Feature Reference (June 2026)

> Reference document for building Flow Desktop to match and exceed Claude Desktop.
> Covers the FULL Claude ecosystem: desktop app, CLI, mobile, enterprise, and platform.

---

## 1. CLAUDE DESKTOP APP (Core)

### Layout & Navigation
- **Three-column layout**: Left sidebar (280px, collapsible) | Center chat (flex) | Right panel (320px, collapsible)
- **Left sidebar**: Search bar, New Chat button, conversation list sorted by recency, project selector at top
- **Center panel**: Message thread, input bar bottom with attachment buttons, model dropdown top, context indicator
- **Right panel**: Project files/knowledge base, MCP tool list, context sources
- **Resizable** panels with drag handles
- **Collapse**: Cmd+B toggles left, Cmd+E toggles right

### Keyboard Shortcuts
| Category | Shortcut | Action |
|----------|----------|--------|
| Navigation | Cmd+K | Command palette |
| Navigation | Cmd+N | New conversation |
| Navigation | Cmd+Shift+N | New project |
| Navigation | Cmd+B | Toggle left sidebar |
| Navigation | Cmd+E | Toggle right panel |
| Navigation | Cmd+, | Settings |
| Chat | Cmd+Enter | Send |
| Chat | Up (empty) | Edit last message |
| Chat | Cmd+Shift+C | Copy last response |
| Chat | Cmd+L | Focus input |
| Chat | Cmd+Shift+Delete | Clear conversation |
| Artifacts | Cmd+I | Insert code block / artifact |
| Navigation | Cmd+[ / Cmd+] | History back/forward |
| Window | Cmd+W | Close window |
| Window | Cmd+Q | Quit |
| Debug | Cmd+Shift+J | DevTools |
| Global | Cmd+Space | Show/hide app (configurable) |

### System Tray
- Menu bar icon (macOS) / tray icon (Windows)
- Right-click menu: New Chat, Show Window, Quit
- Settings gear icon for quick access
- Notification badge (unread count — limited currently)
- Auto-launch on login (toggle in settings)

### Window Management
- Titlebar with conversation name
- Normal/Minimized/Fullscreen window states
- macOS: Native titlebar, traffic light buttons
- Windows: Custom titlebar option
- Multiple windows (detach conversations into separate windows)
- Always-on-top mode (pin window)

### Theming
- Dark mode (default)
- Light mode
- Follow system preference
- Accent color selection (limited preset palette)
- Font size: Small / Medium / Large
- Monospace font for code (configurable)

### Settings / Preferences
- **General**: Theme, font size, language, auto-launch
- **Account**: Profile, email, subscription plan, usage stats
- **Appearance**: Theme (dark/light/system), font size
- **Notifications**: Toggle all notifications, per-event toggles
- **Keyboard shortcuts**: Viewable cheat sheet
- **Beta features**: Toggle experimental features

---

## 2. CONVERSATIONS

### Core Chat
- Message streaming (SSE-based, shows tokens as they generate)
- Multi-turn conversations with full history
- Edit/resubmit messages (edit button on user messages)
- Regenerate response (refresh button on assistant messages)
- Copy message text (copy button on each message)
- Copy message as markdown
- Delete individual messages
- Fork conversation from any point

### Conversation Management
- Auto-saved on every message (no manual save)
- Full history across restarts
- Session recovery on crash
- Token usage display per message
- Character/message counters

### Sidebar Operations
- **Rename**: Inline edit or context menu
- **Delete**: Soft-delete (trash, recoverable)
- **Archive**: Hide from main list, searchable
- **Search**: Full-text search across ALL conversations (not just titles)
- **Pin**: Pin important conversations to top
- **Multi-select**: Batch archive/delete
- **Export**: Single conversation as JSON, Markdown, HTML

### Conversation Features
- **Star/Rate**: Thumbs up/down on responses (trains model)
- **Share**: Generate shareable link to conversation (with or without artifacts)
- **Fork**: Branch conversation from any point
- **Compare**: Side-by-side view of different responses

---

## 3. PROJECTS

### Project System
- Projects group: conversations + files + instructions + MCP config
- Create from scratch or from a template
- **Project-level custom instructions**: Pre-pended to every conversation in project
- **Project knowledge base**: Upload files as project context
- **Project templates**: Reusable configurations
- **Project sharing**: Within team/enterprise (Claude for Work)

### Knowledge Base (Project Files)
- Supported: PDF, TXT, MD, CSV, JSON, YAML, XML, JS, TS, PY, Java, C++, Go, Rust, etc.
- Images: PNG, JPG, GIF, WEBP (Claude reads text from images)
- Audio: Not currently supported for upload
- Max files per project: ~50-100 depending on plan
- File size limit: ~50MB per file
- Drag-drop upload into knowledge panel
- Files indexed for RAG (semantic search across project files)
- File versioning: Upload new version, keep history
- Diff view between file versions

### Project Memory
- Claude can remember facts and preferences across conversations within a project
- Per-project memory (isolated from global memory)
- View/edit/delete specific memories
- Memory stored server-side, synced across devices

---

## 4. ARTIFACTS

### Code Preview / Rendering
Artifacts are in-line rendered previews that appear in the chat:

| Type | What It Does |
|------|-------------|
| **HTML** | Live-rendered webpage in an iframe |
| **React** | Live React component rendering |
| **SVG** | Rendered vector graphic |
| **Mermaid** | Rendered diagrams (flowcharts, sequence, Gantt) |
| **Chart.js** | Rendered charts |
| **Python** | Python execution output (limited sandbox) |
| **JavaScript** | JS execution in browser sandbox |
| **React Native** | Mobile UI preview (limited) |
| **Code blocks** | Syntax-highlighted with copy/download |
| **Diff** | Side-by-side unified diff view |

### Artifact Controls
- Expand to full screen
- Copy source code
- Download as standalone file
- Share via link (public URL)
- Edit in sandbox (HTML/React only)
- View source toggle
- Add to project / save as file
- Delete artifact from conversation

### Artifact Version History
- Each artifact revision is saved
- Navigate between revisions
- Restore previous version

---

## 5. MCP — MODEL CONTEXT PROTOCOL

### MCP Server Management
- **Add server**: Configure via UI button → opens JSON config editor or file picker
- **Edit server**: Modify command, args, env vars
- **Remove server**: Disconnect, optionally delete config
- **Restart server**: Kill and restart process
- **Status indicator**: Connected / Connecting / Error / Disconnected
- **Tool discovery**: Auto-discovers tools on connect
- **Tool list**: Shows all available tools per server

### MCP Config Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Config Format
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Tool Permission Model
- **First use**: Permission prompt (Allow once / Allow always / Deny)
- **Auto-approve list**: Configure tools that skip permission prompt
- **Dangerous tools**: Filesystem read/write, shell, network always require approval
- **Permission scope**: Per-server or per-individual-tool
- **Timeout**: Long-running tools timeout after ~5 minutes

### Standard MCP Servers (Official)
| Server | Purpose |
|--------|---------|
| **Filesystem** | Read, write, search, move files within allowed paths |
| **GitHub** | Repos, PRs, issues, search, file contents |
| **PostgreSQL** | Database schema, queries, exploration |
| **SQLite** | Local SQLite database management |
| **Puppeteer** | Browser automation, screenshots, PDF generation |
| **Playwright** | Cross-browser automation |
| **Brave Search** | Web search via Brave API |
| **Memory** | Persistent cross-session memory |
| **Fetch** | HTTP requests to arbitrary URLs |
| **Sequential Thinking** | Structured thinking process visualization |
| **Everything** | Tool testing / playground |
| **Airtable** | Airtable base management |
| **Cloudflare** | Cloudflare API management |

---

## 6. INPUT & ATTACHMENTS

### File Types
| Type | Extensions | Max Size |
|------|-----------|----------|
| Images | PNG, JPG, JPEG, GIF, WEBP, BMP | ~20MB |
| PDF | PDF | ~50MB |
| Text | TXT, MD, RTF | ~10MB |
| Code | JS, TS, PY, RB, GO, RS, JAVA, CS, CPP, etc. | ~5MB |
| Data | CSV, TSV, JSON, YAML, XML, TOML | ~10MB |
| Archives | ZIP, TAR, GZ | ~50MB |
| Documents | DOCX, XLSX, PPTX | ~20MB |

### Attachment Methods
- **Drag-drop** from Finder/Explorer onto input area
- **Clipboard paste** Cmd+V for images, files
- **File picker** button (paperclip icon) in input bar
- **Camera capture** (mobile/tablet)
- **Screenshot capture** (macOS: Cmd+Shift+4 → paste)
- **Multiple files** per message (5-10 depending on size)
- **Preview thumbnails** in input area before sending
- **Remove** individual files before sending

### Voice Input
- Microphone button next to input bar
- Real-time speech-to-text (Whisper-based)
- Supports multiple languages (English primary)
- Voice activity detection (auto-stop when done speaking)
- Settings: Language selection, auto-send option
- *Voice output is separate: TTS spoken responses*

---

## 7. CLAUDE CODE (CLI Coding Agent)

### What It Is
Claude Code is Anthropic's terminal-based AI coding agent. Launched early 2025, it became one of the most popular AI coding tools.

### Installation
```bash
npm install -g @anthropic-ai/claude-code
# or
npx @anthropic-ai/claude-code
```

### Capabilities
| Feature | Description |
|---------|-------------|
| **Read/edit files** | Full filesystem access in project directory |
| **Run commands** | Execute shell commands, see output |
| **Search code** | Grep/sed/ripgrep across codebase |
| **Git integration** | Commits, branches, PRs, diff review |
| **Multi-file edits** | Simultaneous changes across multiple files |
| **Bug hunting** | Read error logs, diagnose, fix, test |
| **Refactoring** | Large-scale code restructuring |
| **Code review** | Review PRs, suggest changes |
| **Documentation** | Generate docs, READMEs, API docs |
| **Testing** | Write and run tests, interpret results |
| **Architecture** | Design patterns, dependency analysis |

### Usage Patterns
```bash
# Start interactive session
claude

# One-shot command
claude "fix the bug in src/main.ts"

# Pipe input
cat error.log | claude "explain this error"

# Review PR
claude "review the changes in this PR"

# With context
claude --context "We're using React 19, Next.js 15, Tailwind 4"
```

### Key Features
- **Autonomous mode**: Claude explores, plans, and executes multi-step tasks
- **Permission system**: Approves file writes, command execution, git operations
- **Cost tracking**: Shows token usage and cost per session
- **Session persistence**: Resume previous sessions
- **MCP integration**: Can connect to MCP servers from CLI
- **Claude Desktop integration**: Share conversations between CLI and desktop

### Flow Equivalent
- We need to build `npx flow` or `flow-cli` that does the same but with our DS Flash backend
- Could be a Phase 3 project

---

## 8. CLAUDE FOR WORK (Enterprise)

### Team Features
- **Shared projects**: Team-wide projects with shared knowledge base
- **Shared conversations**: View and continue team conversations
- **Team knowledge base**: Organization-wide documents indexed for RAG
- **Workspace management**: Separate workspaces for different teams/projects

### Admin Console
- **User management**: Invite, remove, role assignment
- **SSO**: SAML, OIDC, Google Workspace, Microsoft Entra ID
- **Usage analytics**: Per-user, per-workspace usage dashboards
- **Billing**: Seat-based pricing, invoices, payment management
- **Audit logs**: Full audit trail of all interactions
- **Data retention**: Configurable retention policies
- **Compliance**: SOC 2, HIPAA, GDPR
- **Allowlisted models**: Restrict which models teams can use

### Security
- **SSO enforcement**: Require SSO for all users
- **SCIM provisioning**: Automated user provisioning/deprovisioning
- **IP allowlisting**: Restrict access by IP range
- **Data residency**: Choose data storage region
- **Encryption**: At-rest and in-transit encryption
- **BYOK**: Bring your own encryption keys

---

## 9. CLAUDE MOBILE (iOS/Android)

### Features
- Full chat functionality with streaming responses
- Voice input (speech-to-text)
- Camera: Take photos and ask Claude about them
- File upload: Photos, PDFs, documents from phone storage
- Conversation sync: All conversations sync with desktop/web
- Push notifications
- Offline: Review past conversations offline (responses cached)
- Share sheet: Send content from other apps to Claude
- Siri Shortcuts / Android shortcuts
- Widgets: Quick access from home screen

### Mobile-Specific
- Optimized for mobile viewport
- Swipe gestures for navigation
- Haptic feedback
- Dark/light mode follows system
- Accessibility: VoiceOver, TalkBack, dynamic type

---

## 10. CLAUDE API & DEVELOPER PLATFORM

### API
- REST API for programmatic access
- Streaming support (SSE)
- Message API (conversations)
- Batch API (async processing)
- Token counting endpoint
- Model list endpoint

### SDKs
- Python SDK (`anthropic`)
- TypeScript/JavaScript SDK (`@anthropic-ai/sdk`)
- Go SDK (community)
- Java SDK (community)

### API Key Management
- Keys created and managed in Console or Desktop settings
- Key permissions: Read-only, Write, Admin
- Usage dashboard: Requests, tokens, cost over time
- Rate limits: Per-key limits
- Cost alerts: Notification when spending exceeds threshold

### Batch API
- Submit batch of requests
- Process asynchronously
- 50% cost discount vs real-time
- Results delivered to S3 or webhook

---

## 11. ADVANCED / POWER USER FEATURES

### Background Agents / Async Processing (June 2026 New)
- Claude can now run scheduled/background tasks
- "Claude, check this price every hour and alert me if it changes"
- "Summarize my slack messages at the end of each day"
- "Scan this codebase for security issues every night"
- Runs as a background process or cloud function
- Notifications when tasks complete

### Code Review Integration
- GitHub App: Install Claude as a PR reviewer
- Automatic code review on PR creation
- Inline comments on PR diffs
- Style, security, correctness, architecture reviews
- Configurable review depth and focus areas

### Canvas (Collaborative Workspace)
- Shared editing space for documents and code
- Real-time multiplayer editing
- Version history with diffs
- Comments and annotations
- Export to Markdown, PDF, or HTML

### Custom Skills / GPTs-like
- Create custom instructions bundles (like GPTs)
- Share skills with team
- Skill marketplace (upcoming)
- Pre-built skills: Code reviewer, Technical writer, Data analyst, etc.

### Claude Memory 2.0 (June 2026)
- Persistent long-term memory across ALL conversations
- User preferences: Tone, format, communication style
- Facts about the user: Job, interests, projects
- Memory management UI: View, edit, delete, search memories
- Privacy: Memories can be cleared at any time
- Per-project memory isolation

### Web Search / Browsing
- Built-in web search capability
- Search button in input area
- Results: Summarized with source links
- Full page reading capability
- Privacy: Can be disabled per-conversation
- Sources shown in-line with citations

### Image Generation
- NOT natively supported in Claude Desktop
- Can be added via MCP server or external tool

---

## 12. CLAUDE VS FLOW — FULL GAP ANALYSIS

### Legend
✅ = Done · 🟡 = In progress · 🟤 = Phase 1.5 (next) · 🔵 = Phase 2 · 🟢 = Phase 2.5 · ⚪ = Phase 3

### Desktop Core
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Three-column layout | ✅ | ✅ | ✅ Done |
| Dark/light theme | ✅ | ✅ | ✅ Done |
| Keyboard shortcuts | ✅ | ❌ | 🟤 Phase 1.5 |
| System tray | ✅ | ❌ | 🟤 Phase 1.5 |
| Global hotkey | ✅ | ❌ | 🟤 Phase 1.5 |
| Multiple windows | ✅ | ❌ | ⚪ Phase 3 |
| Full shortcut set | ✅ | ❌ | 🟤 Phase 1.5 |
| Auto-launch on login | ✅ | ❌ | 🟤 Phase 1.5 |

### Chat
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Streaming responses | ✅ | ✅ | ✅ Done |
| Regenerate response | ✅ | ❌ | 🟤 Phase 1.5 |
| Edit messages | ✅ | ❌ | 🟤 Phase 1.5 |
| Copy message | ✅ | ❌ | 🟤 Phase 1.5 |
| Fork conversation | ✅ | ❌ | ⚪ Phase 3 |
| Rate responses | ✅ | ❌ | 🔵 Phase 2 |

### Sessions
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Session persistence | ✅ | ✅ | ✅ Done |
| Rename | ✅ | ✅ | ✅ Done |
| Delete | ✅ | ✅ | ✅ Done |
| Archive | ✅ | ❌ | 🟤 Phase 1.5 |
| Search (full-text) | ✅ | ✅ | ✅ Done |
| Pin | ✅ | ❌ | 🟤 Phase 1.5 |
| Multi-select | ✅ | ❌ | 🟤 Phase 1.5 |
| Export single | ✅ | ❌ | 🟤 Phase 1.5 |
| Share conversation | ✅ | ❌ | ⚪ Phase 3 |

### Attachments
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Drag-drop files | ✅ | ❌ | 🟤 Phase 1.5 |
| Image upload | ✅ | ❌ | 🟤 Phase 1.5 |
| PDF upload | ✅ | ❌ | 🟤 Phase 1.5 |
| Code files | ✅ | ❌ | 🟤 Phase 1.5 |
| Paste images | ✅ | ❌ | 🟤 Phase 1.5 |
| File preview | ✅ | ❌ | 🔵 Phase 2 |
| Multiple files | ✅ | ❌ | 🔵 Phase 2 |

### Voice
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Voice input (mic) | ✅ | ❌ | 🟤 Phase 1.5 |
| Voice output (TTS) | ✅ | ❌ | 🟤 Phase 1.5 |

### Projects
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Project grouping | ✅ | ❌ | ⚪ Phase 3 |
| Project instructions | ✅ | ❌ | ⚪ Phase 3 |
| File knowledge base | ✅ | ❌ | ⚪ Phase 3 |
| File RAG | ✅ | ❌ | ⚪ Phase 3 |
| Project templates | ✅ | ❌ | ⚪ Phase 3 |
| Project sharing | ✅ | ❌ | ⚪ Phase 3 |

### MCP
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| MCP server config | ✅ | ❌ | 🔵 Phase 2 |
| Tool discovery | ✅ | ❌ | 🔵 Phase 2 |
| Permission prompts | ✅ | ❌ | 🔵 Phase 2 |
| Auto-approve | ✅ | ❌ | 🔵 Phase 2 |
| Server lifecycle | ✅ | ❌ | 🔵 Phase 2 |

### Artifacts
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| HTML preview | ✅ | ❌ | 🔵 Phase 2 |
| React preview | ✅ | ❌ | 🔵 Phase 2 |
| SVG render | ✅ | ❌ | 🔵 Phase 2 |
| Mermaid diagrams | ✅ | ❌ | 🔵 Phase 2 |
| Python sandbox | ✅ | ❌ | 🟢 Phase 2.5 |
| JS sandbox | ✅ | ❌ | 🟢 Phase 2.5 |
| Code blocks | ✅ | ✅ (basic) | 🟤 Phase 1.5 |

### Intelligence
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Web search | ✅ | ❌ | 🔵 Phase 2 |
| Image generation | ❌ | ❌ | 🟢 Phase 2.5 (win) |
| Code execution | ✅ | ❌ | 🟢 Phase 2.5 |
| Memory (long-term) | ✅ | ✅ (v1) | ✅ Done |
| Memory management UI | ✅ | ✅ | ✅ Done |

### Customization
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Custom instructions | ✅ | ❌ | 🟤 Phase 1.5 |
| Model selection | ✅ (Claude only) | ❌ | 🟢 Phase 2.5 (WIN) |
| Theme accent color | ✅ | ❌ | 🟤 Phase 1.5 |
| Font size | ✅ | ❌ | 🟤 Phase 1.5 |

### Advanced
| Feature | Claude | Flow Now | Flow Plan |
|---------|--------|----------|-----------|
| Claude Code (CLI) | ✅ | ❌ | ⚪ Phase 3 |
| Background agents | ✅ | ❌ | ⚪ Phase 3 |
| Code review (GitHub) | ✅ | ❌ | ⚪ Phase 3 |
| Collaboration | ✅ | ❌ | ⚪ Phase 3 |
| Admin console | ✅ | ✅ (basic) | 🔵 Phase 2 |
| SSO/Enterprise | ✅ | ❌ | ⚪ Phase 3 |
| Mobile apps | ✅ | ❌ | ⚪ Phase 3 |
| Batch API | ✅ | ❌ | ⚪ Phase 3 |

### Flow Advantages (Things Claude CAN'T do)
| Feature | Claude | Flow |
|---------|--------|------|
| Multi-model selection | ❌ (Claude only) | 🟢 DS Flash/Pro, GLM 5.1, Gemini 3 Flash |
| Image generation | ❌ | 🟢 DALL-E / SD integration |
| Personality modes | ❌ | 🟢 Mr Chow / Professional toggle |
| Prediction market panel | ❌ | 🟢 Live Polymarket/Kalshi data |
| Mr Chow Terminal mode | ❌ | 🟢 CLI agent with personality |
| Open source stack | ❌ | 🟢 Full control, no vendor lock |
| Free tier possible | ❌ (paid only) | 🟢 We control costs |

---

## 13. OPEN SOURCE CLAUDE CLONES

### Known Projects (as of June 2026)

| Project | Base | Stars | Notes |
|---------|------|-------|-------|
| **NextChat** (ChatGPT-Next-Web) | Next.js | 75k+ | ChatGPT interface, not Claude-specific |
| **Lobe Chat** | Next.js | 50k+ | Multi-model chat, plugin system, MCP support planned |
| **Open WebUI** | Svelte/Python | 50k+ | Self-hosted AI chat, Ollama support |
| **Jan** | Electron | 25k+ | Offline-first, local models, extensible |
| **LibreChat** | Node.js | 20k+ | Multi-provider, multi-user, MCP experimental |
| **Big-AGI** | Next.js | 10k+ | Multi-model, personas, voice, image gen |
| **AI Studio** | Next.js | 5k+ | Google AI Studio clone, multi-model |

### Key Takeaway
- **No one has built a true Claude Desktop clone** with Tauri + MCP support
- Lobe Chat is closest to multi-model support but is web-only
- Jan is closest to a desktop app but focuses on local models, not API-driven
- LibreChat has the best multi-provider backend
- **Flow Desktop is differentiating**: Tauri native + our backend + multi-model + Mr Chow personality

### What We Should Borrow
| From | What |
|------|------|
| Lobe Chat | Plugin system architecture, model provider abstraction |
| Jan | MCP client implementation, server management UI |
| LibreChat | Multi-user/admin patterns, multi-provider routing |
| NextChat | Conversation management UX patterns |

---

## 14. IMPLEMENTATION ROADMAP (Updated)

### Phase 1 — Foundation ✅ (DONE)
- [x] Tauri v2 project setup
- [x] Three-column Claude-like layout
- [x] Streaming responses (SSE)
- [x] Session persistence (Neon DB)
- [x] Conversation search
- [x] Memory v1 (summaries)
- [x] Guest mode (no Clerk required)
- [x] Production DMG with Vercel URL

### Phase 1.5 — Desktop Parity 🟤 (DO THIS NEXT)
High priority — these make it feel like a real desktop app:

1. **Keyboard shortcuts** — Full shortcut set (Cmd+N, Cmd+K, Cmd+E, etc.)
2. **System tray** — Menu bar icon, right-click menu, show/hide
3. **Global hotkey** — Cmd+Space to show/hide from anywhere
4. **Drag-drop files** — Accept files onto the input area
5. **Copy/Regenerate/Edit messages** — Message action buttons
6. **Custom instructions UI** — "About you" + "How to respond" settings page
7. **Voice input** — Mic button → web speech API → STT
8. **Theme accent color** — Accent color picker in settings
9. **Font size setting** — Small/Medium/Large
10. **Archive & Pin** — Extended sidebar management

### Phase 2 — Power User 🔵
1. **MCP server management UI** — Add/edit/remove/restart MCP servers
2. **Tool discovery** — Auto-discover and display tools
3. **Permission prompts** — Allow once/always/deny
4. **File attachments** — Upload images, PDFs, code files
5. **Artifact preview v1** — Code syntax highlighting, HTML preview
6. **Web search integration** — Built-in web search tool
7. **Export chat** — Export as JSON/Markdown

### Phase 2.5 — Exceed Claude 🟢
1. **Multi-model selection** — DS V4 Flash, DS V4 Pro, GLM 5.1, Gemini 3 Flash from dropdown
2. **Image generation** — DALL-E / Stable Diffusion API integration
3. **Personality toggle** — Mr Chow mode / Professional mode / Custom
4. **Prediction market panel** — Live Polymarket/Kalshi integration in right panel

### Phase 3 — Complete Platform ⚪
1. **Claude Code CLI clone** — `flow` CLI terminal agent
2. **Projects system** — With knowledge base, file RAG
3. **Background agents** — Scheduled tasks, async processing
4. **Collaboration** — Shared conversations, team workspaces
5. **Mobile apps** — iOS/Android wrappers
6. **Admin console** — Enterprise user management, SSO
7. **Code review integration** — GitHub App

---

*Last updated: 2026-06-14*
*Reference for: Flow Desktop implementation*
*Next action: Start Phase 1.5 — keyboard shortcuts + system tray + global hotkey*
