---
description: Implement the Projects system (Claude Projects clone) for Flow
argument-hint: Use the design doc from $ARTIFACTS_DIR/memory-design.md
---

# Build: Projects System

You are building Flow's Claude Projects clone in the repo at `$ARTIFACTS_DIR/flow/`. Read the design doc at `$ARTIFACTS_DIR/memory-design.md` first.

## What to Build

### 1. DB Migration — `apps/desktop/lib/schema.sql`

Add after the memories tables:

```sql
-- ─── Projects ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  instructions  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);

-- ─── Project Knowledge (uploaded files) ───────────────────────────
CREATE TABLE IF NOT EXISTS project_knowledge (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  content       TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'text',
  embedding     vector(1536),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_project_id ON project_knowledge (project_id);
CREATE INDEX IF NOT EXISTS idx_project_knowledge_embedding ON project_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Project Memories (cross-session memory per project) ──────────
CREATE TABLE IF NOT EXISTS project_memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_memories_project_id ON project_memories (project_id);

-- ─── Chat Session belongs to a Project ───────────────────────────
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions (project_id);
```

Make all additions idempotent (wrapped with `IF NOT EXISTS` / `DO $$` blocks).

### 2. Projects Library — `apps/desktop/lib/projects.ts`

```typescript
// Types
interface Project {
  id: string;
  userId: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectKnowledge {
  id: string;
  projectId: string;
  fileName: string;
  content: string;
  contentType: string;
  createdAt: string;
}

// Project CRUD
export async function getProjects(userId: string): Promise<Project[]>
export async function getProject(id: string, userId: string): Promise<Project | null>
export async function createProject(userId: string, name: string, instructions?: string): Promise<Project>
export async function updateProject(id: string, userId: string, data: { name?: string; instructions?: string }): Promise<Project>
export async function deleteProject(id: string, userId: string): Promise<void>

// Project Knowledge
export async function getProjectKnowledge(projectId: string, userId: string): Promise<ProjectKnowledge[]>
export async function addProjectKnowledge(projectId: string, userId: string, fileName: string, content: string, contentType?: string): Promise<ProjectKnowledge>
export async function deleteProjectKnowledge(id: string, userId: string): Promise<void>
export async function searchProjectKnowledge(projectId: string, userId: string, query: string): Promise<{ content: string }[]>
  → Vector search on project_knowledge.embedding. Fall back to ILIKE.

// Project Memory
export async function getProjectMemories(projectId: string, userId: string): Promise<{ content: string; category: string }[]>
export async function addProjectMemory(projectId: string, userId: string, content: string, category?: string, sessionId?: string): Promise<void>

// Context Assembly
export async function getProjectContext(projectId: string, userId: string): Promise<{ instructions: string; knowledge: string; memories: string }>
  → Returns the full context for system prompt injection: project instructions + knowledge summaries + project memories.

export async function maybeExtractProjectMemory(projectId: string, userId: string, sessionId: string)
  → Like maybeExtractAndStoreMemory but for project-scoped memory.
```

### 3. API Routes

**`apps/desktop/app/api/projects/route.ts`** — GET (list), POST (create)
**`apps/desktop/app/api/projects/[id]/route.ts`** — GET, PUT, DELETE
**`apps/desktop/app/api/projects/[id]/knowledge/route.ts`** — GET (list), POST (add file)
**`apps/desktop/app/api/projects/[id]/knowledge/[kid]/route.ts`** — DELETE
**`apps/desktop/app/api/projects/[id]/memories/route.ts`** — GET (list)

All routes require authentication. Return 401 for guests.

### 4. Integrate into Chat Flow

**`apps/desktop/app/api/chat/route.ts`**:
- Chat request body already has a `sessionId`. Add `projectId` field to `ChatRequestBody` in `chat-helpers.ts`.
- When a projectId is provided, inject project context (instructions + knowledge + project memories) into system prompt.
- The project context goes BETWEEN custom instructions and memories in the system prompt stack:
  1. Custom instructions (about you + how to respond)
  2. Project context (instructions + knowledge + memories)
  3. Cross-session memories
  4. Session summary context

**`apps/desktop/app/api/chat/stream/route.ts`** — same injection pattern.

### 5. Projects UI — `apps/desktop/app/projects/page.tsx`

Create a full projects management page at `/projects`:

- Sidebar lists all projects (with count of sessions per project)
- Clicking a project opens it
- Project detail view:
  - Name (editable inline)
  - Instructions textarea (markdown supported)
  - Knowledge files section: list uploaded files, upload button, delete button
  - Project memories section: list with edit/delete
  - Chat sessions in this project: list with links
- Create new project button (modal dialog)
- Delete project with confirmation

### 6. Sidebar Integration — `apps/desktop/components/Sidebar.tsx`

- Add "Projects" link with a folder icon to the sidebar navigation
- Show recent projects as a collapsible section in the sidebar
- Clicking a project name opens the projects page or the project's latest chat

### 7. Chat Header / Project Selector — `apps/desktop/app/chat/page.tsx` or the chat layout

- When creating a new chat, show a project selector dropdown
- If a project is selected, the chat is scoped to that project
- Show project name in the chat header
- The session is created with project_id set

## Verification

- `npx tsc --noEmit` — zero errors
- `npx next build` — succeeds
- All routes compile and are importable
