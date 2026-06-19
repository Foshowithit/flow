import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Returns a singleton Neon SQL client.
 * Throws only when first accessed, not at module-import time,
 * so build-time collection of pages doesn't fail.
 */
function getSql(): NeonQueryFunction<false, false> {
	if (!_sql) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error("DATABASE_URL environment variable is not set");
		}
		_sql = neon(connectionString);
	}
	return _sql;
}

export { getSql };
// Convenience re-export so callers can `import { sql } from "@/lib/db"`.
// eslint-disable-next-line no-redeclare
export const sql = new Proxy(
	(() => {}) as unknown as NeonQueryFunction<false, false>,
	{
		get(_target, prop) {
			return (getSql() as any)[prop];
		},
		apply(_target, _thisArg, args) {
			return (getSql() as any)(...args);
		},
	},
);
