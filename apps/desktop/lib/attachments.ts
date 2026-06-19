/**
 * ─── File Attachments v1 ──────────────────────────────────────────────────
 *
 * Shared types, limits, and sanitization helpers for plain-text file
 * attachments (no PDFs/images).
 */

// ─── Attachment interface ─────────────────────────────────────────────────

export interface Attachment {
  filename: string;
  mimeType: string;
  size: number; // raw file size in bytes
  extractedText: string; // extracted plain text (truncated + sanitized)
}

// ─── Limits ───────────────────────────────────────────────────────────────

export const ATTACHMENT_LIMITS = {
  MAX_COUNT: 3, // max attachments per message
  MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024, // 1 MB per file
  MAX_EXTRACTED_CHARS: 50_000, // max chars of extracted text per file
} as const;

// ─── Accepted text/code MIME types ────────────────────────────────────────

export const ACCEPTED_MIME_TYPES = [
  // Plain text
  "text/plain",
  // HTML / XML / Markdown
  "text/html",
  "text/xml",
  "text/markdown",
  "text/x-markdown",
  // CSS
  "text/css",
  // CSV
  "text/csv",
  // YAML
  "text/yaml",
  "text/x-yaml",
  "application/x-yaml",
  // TOML
  "text/toml",
  "application/toml",
  // Code — JavaScript / TypeScript
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/jsx",
  "text/tsx",
  "application/typescript",
  "text/typescript",
  // JSON
  "application/json",
  // Shell
  "text/x-sh",
  "application/x-sh",
  // Python
  "text/x-python",
  "text/x-python3",
  // Rust
  "text/x-rust",
  "text/rust",
  // Go
  "text/x-go",
  // Java
  "text/x-java",
  "text/java",
  // C / C++
  "text/x-c",
  "text/x-csrc",
  "text/x-c++",
  "text/x-c++src",
  // C#
  "text/x-csharp",
  // Header files
  "text/x-chdr",
  "text/x-c++hdr",
  // SQL
  "text/x-sql",
  // Diff
  "text/x-diff",
  // General binary detection fallback
] as const;

export const ACCEPTED_EXTENSIONS = [
  ".txt", ".md", ".markdown",
  ".html", ".htm", ".xml",
  ".css", ".scss", ".less",
  ".csv",
  ".json", ".jsonc",
  ".yaml", ".yml",
  ".toml",
  ".sh", ".bash", ".zsh",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".py3",
  ".rs",
  ".go",
  ".java",
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx",
  ".cs",
  ".sql",
  ".diff", ".patch",
  ".env", ".env.example",
  ".cfg", ".conf", ".ini",
  ".log",
  ".gitignore", ".dockerignore",
  ".toml",
  ".gradle", ".groovy",
  ".kt", ".kts",
  ".swift",
  ".rb",
  ".php",
  ".pl",
  ".lua",
  ".r",
  ".dart",
  ".scala",
  ".zig",
];

// ─── Sanitisation helpers ─────────────────────────────────────────────────

/**
 * Strip null bytes and control characters (except \n, \r, \t) from text.
 */
export function sanitizeText(text: string): string {
  // Replace null bytes
  let cleaned = text.replace(/\0/g, "");
  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Strip control characters except \n, \r, \t
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  return cleaned;
}

/**
 * Truncate extracted text to MAX_EXTRACTED_CHARS, preserving whole characters.
 */
export function truncateText(text: string): string {
  if (text.length <= ATTACHMENT_LIMITS.MAX_EXTRACTED_CHARS) {
    return text;
  }
  return text.slice(0, ATTACHMENT_LIMITS.MAX_EXTRACTED_CHARS) +
    "\n\n[...truncated at " + ATTACHMENT_LIMITS.MAX_EXTRACTED_CHARS + " characters]";
}

/**
 * Full sanitisation pipeline: sanitize → truncate.
 */
export function processExtractedText(text: string): string {
  return truncateText(sanitizeText(text));
}

/**
 * Check if a MIME type is in our accepted list.
 */
export function isAcceptedMimeType(mimeType: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a file extension is in our accepted list.
 */
export function isAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Validate an attachment object and return an error string, or null if valid.
 */
export function validateAttachment(att: Attachment): string | null {
  if (!att.filename || typeof att.filename !== "string") {
    return "Attachment must have a filename";
  }
  if (typeof att.size !== "number" || att.size < 0) {
    return "Attachment must have a valid size";
  }
  if (att.size > ATTACHMENT_LIMITS.MAX_FILE_SIZE_BYTES) {
    return `File "${att.filename}" exceeds 1 MB size limit`;
  }
  if (typeof att.extractedText !== "string") {
    return "Attachment must have extractedText";
  }
  return null;
}
