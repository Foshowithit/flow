/**
 * Global type augmentations for client-only runtime objects.
 */

interface Window {
	/** Set by Tauri v2 webview preload when running inside Tauri */
	__TAURI__?: Record<string, unknown>;
}
