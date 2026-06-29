import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Returns a singleton Postgres.js client.
 * Throws only when first accessed, not at module-import time,
 * so build-time collection of pages doesn't fail.
 */
function getSql(): ReturnType<typeof postgres> {
	if (!_sql) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error("DATABASE_URL environment variable is not set");
		}
		_sql = postgres(connectionString);
	}
	return _sql;
}

export { getSql };

// Convenience re-export so callers can `import { sql } from "@/lib/db"`.
const _sqlProxy = (() => {}) as unknown as ReturnType<typeof postgres>;

export const sql = new Proxy(_sqlProxy, {
	get(_target, prop) {
		return (getSql() as any)[prop];
	},
	apply(_target, _thisArg, args) {
		return (getSql() as any)(...args);
	},
});
