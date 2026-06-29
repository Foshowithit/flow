---
description: Implement the cross-session memory system for Flow
argument-hint: Use the design doc from $ARTIFACTS_DIR/memory-design.md
---

# Build: Cross-Session Memory System

You are building Flow's Claude-style memory system in the repo at `$ARTIFACTS_DIR/flow/`.

Read the design doc at `$ARTIFACTS_DIR/memory-design.md` first, then implement everything.

## What to Build

### 1. DB Migration — `apps/desktop/lib/schema.sql`

Add after the existing tables:

```sql
-- Enable pgvector (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Memories (cross-session) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
    -- Categories: 'fact', 'preference', 'goal', 'constraint', 'identity', 'general'
  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  embedding     vector(1536),  -- for semantic search
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories (category);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

If using Neon's pgvector as a managed extension, adjust accordingly. Make sure to wrap in `DO $$ BEGIN ... EXCEPTION ... END $$` for idempotent migration.

### 2. Memory Library — `apps/desktop/lib/memory-system.ts`

Create a new module with these exports:

```typescript
// Types
interface MemoryFact {
  id: string;
  userId: string;
  content: string;
  category: 'fact' | 'preference' | 'goal' | 'constraint' | 'identity' | 'general';
  sourceSessionId?: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

// Core API
export async function getMemoryFacts(userId: string, limit?: number): Promise<MemoryFact[]>
  → Fetch ALL memories for user, ordered by updated_at DESC. Limit optional.

export async function searchMemoryFacts(userId: string, query: string, limit?: number): Promise<MemoryFact[]>
  → Vector search on memories.embedding using cosine similarity.
  → If no pgvector / no results, fall back to ILIKE text search on content.

export async function addMemoryFact(userId: string, content: string, category: string, sessionId?: string, messageId?: string): Promise<MemoryFact>
  → Insert a new memory fact.
  → Check for duplicates: if content is very similar to existing (semantic cosine > 0.95), skip.

export async function updateMemoryFact(id: string, userId: string, content: string, category: string): Promise<MemoryFact>
  → Update content/category. Recompute embedding.

export async function deleteMemoryFact(id: string, userId: string): Promise<void>

export async function generateMemoryFacts(messages: { role: string; content: string }[]): Promise<{ content: string; category: string }[]>
  → Call the AI model (chatCompletion with system memory-extraction prompt) to extract facts from the conversation.
  → System prompt: "You are a memory extraction system. Extract concrete facts about the user from this conversation. Return each fact as a JSON array of {content, category}. Categories: fact (anything specific they shared), preference (likes/dislikes), goal (what they're trying to do), constraint (limitations/requirements), identity (who they are, their background). Only extract clear, specific, useful facts. Skip vague statements."

export async function getMemoryContext(userId: string): Promise<string>
  → Fetch all memories + top 5 vector-matched for empty query (recency)
  → Return as formatted string for system prompt injection: "Remembered context about you:\n- {fact content}\n..."

export async function maybeExtractAndStoreMemory(userId: string, sessionId: string)
  → Called after each chat response.
  → Fetch last user message + assistant response pair.
  → Call generateMemoryFacts() on that pair.
  → For each extracted fact, call addMemoryFact() (which deduplicates).
  → Best-effort, never throws.
```

**IMPORTANT**: The embedding column uses vector(1536). Use `sql` from `@/lib/db` for all queries. For generating embeddings:
- Use the Open AI-compatible embedding endpoint: `POST https://api.opencode.ai/v1/embeddings` with model `text-embedding-3-small` and the `OPENCODE_GO_API_KEY` env var.
- Wrap embedding generation so failures don't block memory operations — text-only search is the fallback.

### 3. Memory API Routes

**`apps/desktop/app/api/memory/facts/route.ts`** — CRUD for memory facts:
- `GET /api/memory/facts` — list all memories for current user
- `GET /api/memory/facts?search=query` — search memories
- `POST /api/memory/facts` — create a new fact (body: { content, category })
- `PUT /api/memory/facts/[id]` — update a fact
- `DELETE /api/memory/facts/[id]` — delete a fact

**`apps/desktop/app/api/memory/facts/[id]/route.ts`** — individual fact operations

All routes require authentication. Return 401 for guests.

### 4. Integrate into Chat Flow

**`apps/desktop/app/api/chat/route.ts`**:
- After line 109 (after custom instructions injection), BUT BEFORE attachment injection:
  - Inject cross-session memories: `getMemoryContext(internalUserId)` → add as system message
  - Content: `"Relevant context I remember about you:\n{memory facts}"`
- After line 158 (after `maybeUpdateSessionSummary`):
  - Call `maybeExtractAndStoreMemory(internalUserId, session.id)`
- Guest mode: No memory injection or extraction (guest is ephemeral)

**`apps/desktop/app/api/chat/stream/route.ts`**:
- Same injection point (after auth check, before provider call)
- Same extraction call after stream completes

### 5. Memory Management UI — `apps/desktop/app/settings/page.tsx`

Add a "Memory" section to the settings page between Custom Instructions and the Danger Zone:

```tsx
// Memory section
const [memories, setMemories] = useState<MemoryFact[]>([]);
const [memoriesLoaded, setMemoriesLoaded] = useState(false);
const [editingMemory, setEditingMemory] = useState<string | null>(null);
const [editContent, setEditContent] = useState("");
const [memorySearch, setMemorySearch] = useState("");
```

Features:
- Fetch memories from `/api/memory/facts` on mount
- Display as a list of cards showing content, category badge, and date
- Pencil icon on each card to enter edit mode (inline textarea)
- Delete button with confirmation
- Search input that filters via `/api/memory/facts?search=...`
- Empty state: "No memories yet. Memories will appear here as you chat."
- Loading state: skeleton cards
- Error state: "Could not load memories" with retry button
- Add memory button at top: opens a dialog to type content + select category

Style: Match the existing settings page design (dark theme, purple accents).

### 6. Guest Mode Consideration
- Guest chat: no memory injection, no extraction. The chat flow already has a separate code path for guests.

## Verification

After implementation:
- Run `cd $ARTIFACTS_DIR/flow && npx tsc --noEmit` — must pass with zero errors
- Run `cd $ARTIFACTS_DIR/flow && npx next build` — must pass with zero errors

Do NOT leave TODO comments, stubs, or placeholders. Every function must have a real implementation.
