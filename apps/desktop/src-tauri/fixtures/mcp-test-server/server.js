#!/usr/bin/env node

/**
 * ─── Safe MCP Fixture Server — stdio JSON-RPC ─────────────────────────────
 *
 * This is a **test fixture** for the Flow MCP runtime.
 * It implements a minimal Model Context Protocol (MCP)-like server over
 * stdin/stdout using JSON-RPC 2.0 line-delimited messages.
 *
 * SAFETY:
 * - No filesystem access (no fs, no file reading/writing)
 * - No shell access (no exec, no spawn, no child_process)
 * - No network access (no http, no sockets, no fetch)
 * - No environment variable printing
 * - Purely computational: echo, time, arithmetic
 * - Does NOT access Tauri or any backend internals
 *
 * USAGE:
 *   Automatically by an MCP client via `node server.js`
 *   Manually for testing:
 *     echo '{"method":"echo","params":{"text":"hello"}}' | node server.js
 *
 * NOTICE:
 *   This fixture is spawned by the Flow Desktop Tauri backend via
 *   `std::process::Command` with a hardcoded path.
 *
 * @module mcp-test-server/fixture
 */

const readline = require("readline");

// ─── Tool handlers ─────────────────────────────────────────────────────────

const TOOLS = {
	echo: {
		description: "Echo the input text back to the caller.",
		inputSchema: {
			type: "object",
			properties: {
				text: { type: "string", description: "Text to echo" },
			},
			required: ["text"],
		},
		handler: (params) => {
			return { content: [{ type: "text", text: params.text ?? "" }] };
		},
	},

	get_time: {
		description: "Return the current UTC time as an ISO 8601 string.",
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
		handler: () => {
			const now = new Date().toISOString();
			return { content: [{ type: "text", text: now }] };
		},
	},

	add_numbers: {
		description: "Add two numbers and return the result.",
		inputSchema: {
			type: "object",
			properties: {
				a: { type: "number", description: "First number" },
				b: { type: "number", description: "Second number" },
			},
			required: ["a", "b"],
		},
		handler: (params) => {
			const a = Number(params.a);
			const b = Number(params.b);
			if (isNaN(a) || isNaN(b)) {
				return {
					content: [{ type: "error", message: "Parameters must be numbers" }],
				};
			}
			return { content: [{ type: "text", text: String(a + b) }] };
		},
	},
};

// ─── Standard MCP method aliases ────────────────────────────────────────────

// Returns the list of available tools (supports both "list_tools" and "tools/list")
function listTools() {
	const tools = Object.entries(TOOLS).map(([name, tool]) => ({
		name,
		description: tool.description,
		inputSchema: tool.inputSchema,
	}));
	return { tools };
}

// Calls a tool by name with arguments (supports both "call_tool" and "tools/call")
function callTool(toolName, toolArgs) {
	const tool = TOOLS[toolName];
	if (!tool) {
		return { error: { code: -32601, message: `Tool not found: ${toolName}` } };
	}
	return tool.handler(toolArgs);
}

// ─── JSON-RPC dispatcher ───────────────────────────────────────────────────

function handleRequest(request) {
	const { id, method, params } = request;

	// ── initialize ────────────────────────────────────────────────────────
	if (method === "initialize") {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: "safe-fixture-server",
					version: "0.1.0",
				},
			},
		};
	}

	// ── tools/list ────────────────────────────────────────────────────────
	if (method === "tools/list" || method === "list_tools") {
		return { jsonrpc: "2.0", id, result: listTools() };
	}

	// ── tools/call ────────────────────────────────────────────────────────
	if (method === "tools/call" || method === "call_tool") {
		const toolName = params?.name;
		const toolArgs = params?.arguments ?? {};
		const result = callTool(toolName, toolArgs);
		if (result.error) {
			return { jsonrpc: "2.0", id, error: result.error };
		}
		return { jsonrpc: "2.0", id, result };
	}

	return {
		jsonrpc: "2.0",
		id,
		error: { code: -32601, message: `Method not found: ${method}` },
	};
}

// ─── Main loop — read JSON-RPC lines from stdin ────────────────────────────

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;

	let request;
	try {
		request = JSON.parse(trimmed);
	} catch {
		// Ignore malformed JSON
		return;
	}

	const response = handleRequest(request);
	process.stdout.write(JSON.stringify(response) + "\n");
});

rl.on("close", () => {
	// Natural exit on stdin EOF
});
