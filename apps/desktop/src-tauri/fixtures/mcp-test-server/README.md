# MCP Test Server Fixture

A minimal, safe MCP-like JSON-RPC server for testing the Flow MCP runtime
protocol integration. It communicates over **stdin/stdout** using
JSON-RPC 2.0 (one JSON object per line).

## NOTICE

This fixture is spawned by the Flow Desktop Tauri backend via
`std::process::Command` with a hardcoded path. The fixture process lifecycle
(start/stop/restart) is managed by the Rust `mcp::process` module.

## Safety

- **No filesystem access** — does not read or write files.
- **No shell access** — does not spawn processes or execute commands.
- **No network access** — does not make HTTP requests or open sockets.
- **No environment variable printing** — does not access `process.env`.
- **No Tauri access** — does not interact with the Tauri backend.
- **Purely computational** — only echoes input, returns the time, or adds
  numbers.

## Available Tools

### `echo`

Returns the input text unchanged.

**Parameters:**
- `text` (string, required) — Text to echo.

**Returns:**
- `content[0].text` — The echoed text.

### `get_time`

Returns the current UTC time as an ISO 8601 string.

**Parameters:** None

**Returns:**
- `content[0].text` — ISO 8601 timestamp (e.g. `2026-06-16T12:34:56.789Z`).

### `add_numbers`

Adds two numbers and returns the result.

**Parameters:**
- `a` (number, required) — First number.
- `b` (number, required) — Second number.

**Returns:**
- `content[0].text` — The sum as a string.

## Protocol

The server expects one JSON-RPC 2.0 request object per line on stdin,
and writes one JSON-RPC 2.0 response per line to stdout.

### Special methods

- `list_tools` — Returns the list of available tools with their schemas.
- `call_tool` — Calls a tool by name with the given arguments.

### Example (manual test)

```bash
echo '{"method":"initialize","id":1}' | node server.js
```

```bash
echo '{"method":"tools/list","id":2}' | node server.js
```

```bash
echo '{"method":"tools/call","id":3,"params":{"name":"echo","arguments":{"text":"hello"}}}' | node server.js
```

```bash
echo '{"method":"tools/call","id":4,"params":{"name":"add_numbers","arguments":{"a":5,"b":3}}}' | node server.js
```
