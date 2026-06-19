/**
 * ─── Model Routing ─────────────────────────────────────────────────────────
 *
 * For private beta, ALL queries route to DS V4 Flash (deepseek-v4-flash)
 * for cost efficiency, speed, and reliability. Pro routing is disabled.
 *
 * To re-enable Pro routing in the future:
 *   - Restore the content-based logic in `routeModel()`
 *   - Set MODEL_PRO / MODEL_PRO_GO constants as needed
 *
 * When OpenCode Go is active (OPENCODE_GO_API_KEY set), the model names are
 * mapped to the OpenCode Go format: deepseek-v4-flash / deepseek-v4-pro.
 */

import { isOpenCodeGoEnabled } from "@/lib/deepseek";

// These keyword arrays are kept for reference; they will be used when Pro
// routing is re-enabled. Prefix `_` avoids lint warning on unused declarations.
const _COMPLEX_KEYWORDS = [
	"analyze",
	"analysis",
	"compare",
	"contrast",
	"explain",
	"why",
	"how does",
	"what is the difference",
	"pros and cons",
	"evaluate",
	"synthesize",
	"debug",
	"code",
	"function",
	"algorithm",
	"math",
	"equation",
	"solve",
	"reason",
	"think step by step",
	"work through",
	"deep dive",
	"research",
	"architecture",
	"design pattern",
];
const _PRO_KEYWORDS = ["pro", "deep", "expert", "advanced"];

export interface RouteResult {
	model: string;
	thinking: boolean;
	reason: string;
}

// Internal model IDs (always the same regardless of provider)
const MODEL_FLASH = "deepseek-chat";
const MODEL_PRO = "deepseek-reasoner";

// OpenCode Go model names
const MODEL_FLASH_GO = "deepseek-v4-flash";
const MODEL_PRO_GO = "deepseek-v4-pro";

/**
 * resolveModelName — maps internal model ID to the active provider's name.
 */
function resolveModelName(internalName: string): string {
	if (!isOpenCodeGoEnabled()) {
		return internalName;
	}
	if (internalName === MODEL_FLASH) return MODEL_FLASH_GO;
	if (internalName === MODEL_PRO) return MODEL_PRO_GO;
	return internalName;
}

/**
 * routeModel — for private beta, always routes to DS V4 Flash regardless
 * of prompt complexity. Pro routing is disabled for cost/reliability.
 *
 * To re-enable Pro routing: restore the keyword/complexity logic that
 * returned resolveModelName(MODEL_PRO) for complex or pro-requested queries.
 */
export function routeModel(_message: string): RouteResult {
	// Private beta: always use Flash for speed and cost predictability.
	// Pro routing is disabled. Re-enable when ready.
	return {
		model: resolveModelName(MODEL_FLASH),
		thinking: true,
		reason: "Beta mode — DS V4 Flash (Pro disabled for cost/reliability)",
	};
}
