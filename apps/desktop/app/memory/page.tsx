"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";

interface MemoryEntry {
	session_id: string;
	title: string;
	summary: string;
	message_count: number;
	updated_at: string;
}

export default function MemoryPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) {
			setLoading(false);
			return;
		}

		(async () => {
			try {
				const res = await fetch("/api/memory");
				if (!res.ok) throw new Error("Failed to load memory data");
				const data = (await res.json()) as MemoryEntry[];
				setMemoryEntries(data);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Something went wrong.",
				);
			} finally {
				setLoading(false);
			}
		})();
	}, [isLoaded, isSignedIn]);

	if (!isLoaded && !timedOut) {
		return (
			<div className="min-h-dvh bg-background flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
					<p className="text-sm text-text-secondary">Loading…</p>
				</div>
			</div>
		);
	}

	// ── Clerk timeout fallback ────────────────────────────────────────
	if (timedOut) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Memory
				</h1>
				<div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-5 py-6 max-w-sm">
					<p className="text-sm text-yellow-400 mb-3">
						Authentication is taking longer than expected. Sign in may be
						temporarily unavailable.
					</p>
					<div className="flex gap-3 justify-center">
						<Link
							href="/"
							className="text-sm text-accent hover:text-accent-hover transition-colors"
						>
							Home
						</Link>
						<Link
							href="/chat"
							className="text-sm text-accent hover:text-accent-hover transition-colors"
						>
							Chat
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (!isSignedIn) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Memory
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					Sign in to see what Flow remembers about your conversations.
				</p>
				<SignInButton mode="modal">
					<button className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all">
						Sign in
					</button>
				</SignInButton>
				<div className="mt-6">
					<Link
						href="/"
						className="text-sm text-text-secondary hover:text-text-primary transition-colors"
					>
						Back to home
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-dvh bg-background">
			{/* Header */}
			<header className="border-b border-border bg-surface/80 backdrop-blur-sm">
				<div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="text-sm font-semibold text-accent tracking-tight hover:text-accent-hover transition-colors"
						>
							Flow
						</Link>
						<span className="text-sm text-text-secondary">/</span>
						<h1 className="text-sm font-semibold text-text-primary tracking-tight">
							Memory
						</h1>
					</div>
					<div className="flex items-center gap-3">
						<Link
							href="/settings"
							className="text-sm text-text-secondary hover:text-text-primary transition-colors"
						>
							Settings
						</Link>
						<Link
							href="/chat"
							className="text-sm text-text-secondary hover:text-text-primary transition-colors"
						>
							Back to chat
						</Link>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
				{/* Info notice */}
				<section className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-2">
						How Flow remembers
					</h2>
					<p className="text-sm text-text-secondary leading-relaxed">
						Flow currently remembers conversation summaries only. These summaries
						are automatically generated from your chats and help Flow provide
						context across your session. Editable long-term memories are coming
						next.
					</p>
				</section>

				{/* Memory list */}
				<section>
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Session summaries
					</h2>

					{loading && (
						<div className="text-center py-12">
							<p className="text-sm text-text-secondary">Loading memories…</p>
						</div>
					)}

					{error && (
						<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
							<p className="text-sm text-red-400">{error}</p>
						</div>
					)}

					{!loading && !error && memoryEntries.length === 0 && (
						<div className="rounded-2xl border border-border bg-surface p-8 text-center">
							<p className="text-sm text-text-secondary">
								No session summaries yet. Memories are created after enough
								conversation in a session.
							</p>
						</div>
					)}

					{!loading && memoryEntries.length > 0 && (
						<div className="space-y-3">
							{memoryEntries.map((entry) => (
								<div
									key={entry.session_id}
									className="rounded-2xl border border-border bg-surface p-5"
								>
									<div className="flex items-start justify-between gap-4 mb-2">
										<div className="min-w-0">
											<Link
												href={`/chat?session=${entry.session_id}`}
												className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate block"
											>
												{entry.title || "Untitled session"}
											</Link>
											<div className="flex items-center gap-3 mt-1">
												<span className="text-xs text-text-tertiary">
													{entry.message_count} message
													{entry.message_count === 1 ? "" : "s"}
												</span>
												<span className="text-xs text-text-tertiary">
													{new Date(entry.updated_at).toLocaleDateString(
														"en-US",
														{
															month: "short",
															day: "numeric",
															year: "numeric",
														},
													)}
												</span>
											</div>
										</div>
										<Link
											href={`/chat?session=${entry.session_id}`}
											className="text-xs text-accent hover:text-accent-hover transition-colors shrink-0 mt-1"
										>
											Open chat
										</Link>
									</div>
									<p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
										{entry.summary}
									</p>
								</div>
							))}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
