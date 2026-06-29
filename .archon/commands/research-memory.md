---
description: Research current Flow codebase and produce a design document for the Claude-style memory & projects system
argument-hint: No arguments — reads the repo directly
---

# Research: Memory & Projects Design for Flow

You are in the Flow monorepo at `$ARTIFACTS_DIR/flow/`. Your job is to:

1. **Read the current codebase:**
   - `apps/desktop/app/api/chat/route.ts` — chat flow entry point (guest + auth)
   - `apps/desktop/lib/memory.ts` — existing per-session summary system
   - `apps/desktop/lib/schema.sql` — current DB schema
   - `apps/desktop/lib/chat-helpers.ts` — chat helper utilities
   - `apps/desktop/lib/deepseek.ts` — AI provider wrapper
   - `apps/desktop/lib/db.ts` — DB connection
   - `apps/desktop/app/settings/page.tsx` — settings UI (has custom instructions)
   - `apps/desktop/app/api/memory/route.ts` — existing memory API
   - `apps/desktop/app/api/settings/instructions/route.ts` — instructions API
   - `apps/desktop/components/Sidebar.tsx` — sidebar component
   - `apps/desktop/app/api/chat/stream/route.ts` — streaming chat route
   - `apps/desktop/app/memory/page.tsx` — memory page (if it exists)
   - `docker-compose.yml` — Docker services (for pgvector setup notes)

2. **Produce a design document** at `$ARTIFACTS_DIR/memory-design.md` covering:

   **A. Cross-Session Memory System**
   - DB schema: `memories` table (user_id, content, category, embedding, source_chat_id, created_at)
   - How memory is EXTRACTED: after chat response, call generateMemoryFacts() to extract facts
   - How memory is INJECTED: at chat start, fetch relevant memories via vector search, inject into system prompt
   - Deduplication strategy: semantic similarity threshold or LLM-based merge
   - Memory management UI: view/edit/delete in settings
   - Guest mode: no memory (guest is ephemeral)

   **B. Projects System** (like Claude Projects)
   - DB schema: `projects` table (id, user_id, name, instructions, created_at)
   - `project_knowledge` table (id, project_id, file_name, content, embedding)
   - `project_memories` table (id, project_id, content, created_at) — separate memory per project
   - Project selector in sidebar / chat header
   - Knowledge upload: file → extract text → embed → store
   - Project-scoped system prompt injection

   **C. Chat Search / RAG**
   - Embed chat messages with pgvector
   - Search endpoint that queries vector DB
   - "Search past chats" tool call pattern

   **D. Implementation Plan**
   - Files to create/modify with exact paths
   - Order of implementation
   - Any concerns (pgvector extension in Neon, migration safety, guest flow)

3. **Write the design doc** and report back with a summary of the key decisions.
