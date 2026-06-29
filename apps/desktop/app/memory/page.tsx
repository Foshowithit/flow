"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";
import {
	Star,
	Trash2,
	Plus,
	X,
	Check,
	AlertCircle,
	RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface MemoryEntry {
	session_id: string;
	title: string;
	summary: string;
	message_count: number;
	updated_at: string;
}

interface MemoryFact {
	id: string;
	content: string;
	category: string;
	importance: number;
	source_session_id: string | null;
	created_at: string;
	updated_at: string;
}

type Tab = "summaries" | "facts";

const CATEGORIES = [
	"all",
	"preference",
	"fact",
	"goal",
	"personal_info",
	"constraint",
	"general",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
	preference: "bg-purple-500/10 text-purple-400 border-purple-500/20",
	fact: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	goal: "bg-green-500/10 text-green-400 border-green-500/20",
	personal_info: "bg-amber-500/10 text-amber-400 border-amber-500/20",
	constraint: "bg-red-500/10 text-red-400 border-red-500/20",
	general: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
	preference: "Preference",
	fact: "Fact",
	goal: "Goal",
	personal_info: "Personal Info",
	constraint: "Constraint",
	general: "General",
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function ImportanceStars({ value }: { value: number }) {
	return (
		<span className="inline-flex gap-0.5">
			{[1, 2, 3, 4, 5].map((i) => (
				<Star
					key={i}
					className={`h-3 w-3 ${
						i <= value
							? "text-yellow-400 fill-yellow-400"
							: "text-text-tertiary"
					}`}
				/>
			))}
		</span>
	);
}

function CategoryBadge({ category }: { category: string }) {
	const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
	const label = CATEGORY_LABELS[category] || category;
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClass}`}
		>
			{label}
		</span>
	);
}

function FactSkeleton() {
	return (
		<div className="rounded-2xl border border-border bg-surface p-5 animate-pulse">
			<div className="flex items-start justify-between gap-4 mb-2">
				<div className="flex-1 space-y-2">
					<div className="h-4 bg-surface-hover rounded w-3/4" />
					<div className="h-3 bg-surface-hover rounded w-1/4" />
				</div>
				<div className="h-4 w-16 bg-surface-hover rounded" />
			</div>
			<div className="h-3 bg-surface-hover rounded w-full" />
		</div>
	);
}

// ─── Page Component ──────────────────────────────────────────────────────

export default function MemoryPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const [activeTab, setActiveTab] = useState<Tab>("summaries");

	// Session summaries state
	const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// Memory facts state
	const [facts, setFacts] = useState<MemoryFact[]>([]);
	const [factsLoading, setFactsLoading] = useState(false);
	const [factsError, setFactsError] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [showAddForm, setShowAddForm] = useState(false);
	const [editingFactId, setEditingFactId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	// Add/Edit form state
	const [formContent, setFormContent] = useState("");
	const [formCategory, setFormCategory] = useState("general");
	const [formImportance, setFormImportance] = useState(3);
	const [formSaving, setFormSaving] = useState(false);
	const [formError, setFormError] = useState("");

	// ── Load session summaries ──────────────────────────────────────

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
				setError(err instanceof Error ? err.message : "Something went wrong.");
			} finally {
				setLoading(false);
			}
		})();
	}, [isLoaded, isSignedIn]);

	// ── Load memory facts ───────────────────────────────────────────

	const loadFacts = useCallback(async () => {
		setFactsLoading(true);
		setFactsError("");
		try {
			const params = new URLSearchParams({ limit: "50", offset: "0" });
			if (categoryFilter !== "all") {
				params.set("category", categoryFilter);
			}
			const res = await fetch(`/api/memory/facts?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to load memory facts");
			const data = await res.json();
			setFacts(data.facts || []);
		} catch (err) {
			setFactsError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setFactsLoading(false);
		}
	}, [categoryFilter]);

	useEffect(() => {
		if (!isSignedIn || activeTab !== "facts") return;
		loadFacts();
	}, [isSignedIn, activeTab, loadFacts]);

	// ── Add fact ─────────────────────────────────────────────────────

	const handleAddFact = useCallback(async () => {
		const trimmed = formContent.trim();
		if (!trimmed) return;
		setFormSaving(true);
		setFormError("");
		try {
			const res = await fetch("/api/memory/facts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: trimmed,
					category: formCategory,
					importance: formImportance,
				}),
			});
			if (!res.ok) {
				const errData = await res
					.json()
					.catch(() => ({ error: "Failed to save" }));
				throw new Error(errData.error || "Failed to save memory fact");
			}
			setFormContent("");
			setFormCategory("general");
			setFormImportance(3);
			setShowAddForm(false);
			loadFacts();
		} catch (err) {
			setFormError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setFormSaving(false);
		}
	}, [formContent, formCategory, formImportance, loadFacts]);

	// ── Update fact ──────────────────────────────────────────────────

	const handleUpdateFact = useCallback(
		async (id: string) => {
			const trimmed = formContent.trim();
			if (!trimmed) return;
			setFormSaving(true);
			setFormError("");
			try {
				const res = await fetch(`/api/memory/facts/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						content: trimmed,
						category: formCategory,
						importance: formImportance,
					}),
				});
				if (!res.ok) {
					const errData = await res
						.json()
						.catch(() => ({ error: "Failed to update" }));
					throw new Error(errData.error || "Failed to update memory fact");
				}
				setEditingFactId(null);
				setFormContent("");
				setFormCategory("general");
				setFormImportance(3);
				loadFacts();
			} catch (err) {
				setFormError(
					err instanceof Error ? err.message : "Something went wrong.",
				);
			} finally {
				setFormSaving(false);
			}
		},
		[formContent, formCategory, formImportance, loadFacts],
	);

	// ── Delete fact ──────────────────────────────────────────────────

	const handleDeleteFact = useCallback(
		async (id: string) => {
			try {
				const res = await fetch(`/api/memory/facts/${id}`, {
					method: "DELETE",
				});
				if (!res.ok) throw new Error("Failed to delete memory fact");
				setDeleteConfirmId(null);
				loadFacts();
			} catch (err) {
				setFactsError(err instanceof Error ? err.message : "Failed to delete.");
			}
		},
		[loadFacts],
	);

	// ── Open edit form ───────────────────────────────────────────────

	const startEditing = useCallback((fact: MemoryFact) => {
		setEditingFactId(fact.id);
		setFormContent(fact.content);
		setFormCategory(fact.category);
		setFormImportance(fact.importance);
		setFormError("");
	}, []);

	const cancelEditing = useCallback(() => {
		setEditingFactId(null);
		setFormContent("");
		setFormCategory("general");
		setFormImportance(3);
		setFormError("");
	}, []);

	// ── Loading state ────────────────────────────────────────────────

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

	// ── Clerk timeout fallback ──────────────────────────────────────

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

			{/* Tab navigation */}
			<div className="border-b border-border">
				<div className="max-w-3xl mx-auto px-6 flex gap-6">
					<button
						onClick={() => setActiveTab("summaries")}
						className={`py-3 text-sm font-medium border-b-2 transition-colors ${
							activeTab === "summaries"
								? "border-accent text-accent"
								: "border-transparent text-text-secondary hover:text-text-primary"
						}`}
					>
						Session Summaries
					</button>
					<button
						onClick={() => setActiveTab("facts")}
						className={`py-3 text-sm font-medium border-b-2 transition-colors ${
							activeTab === "facts"
								? "border-accent text-accent"
								: "border-transparent text-text-secondary hover:text-text-primary"
						}`}
					>
						Memory Facts
					</button>
				</div>
			</div>

			{/* Content */}
			<main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
				{activeTab === "summaries" && (
					<>
						{/* Info notice */}
						<section className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
							<h2 className="text-base font-semibold tracking-tight text-text-primary mb-2">
								How Flow remembers
							</h2>
							<p className="text-sm text-text-secondary leading-relaxed">
								Flow currently remembers conversation summaries only. These
								summaries are automatically generated from your chats and help
								Flow provide context across your session. Memory facts are
								automatically extracted from your conversations.
							</p>
						</section>

						{/* Memory list */}
						<section>
							<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
								Session summaries
							</h2>

							{loading && (
								<div className="text-center py-12">
									<p className="text-sm text-text-secondary">
										Loading memories…
									</p>
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
					</>
				)}

				{activeTab === "facts" && (
					<section>
						{/* Header with add button and filter */}
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
							<h2 className="text-base font-semibold tracking-tight text-text-primary">
								Memory Facts
							</h2>
							<div className="flex items-center gap-3">
								{/* Category filter */}
								<select
									value={categoryFilter}
									onChange={(e) => setCategoryFilter(e.target.value)}
									className="h-9 rounded-lg border border-border bg-surface text-xs text-text-secondary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
									aria-label="Filter by category"
								>
									{CATEGORIES.map((cat) => (
										<option key={cat} value={cat}>
											{cat === "all"
												? "All Categories"
												: CATEGORY_LABELS[cat] || cat}
										</option>
									))}
								</select>

								{/* Add button */}
								{!showAddForm && (
									<button
										onClick={() => {
											setShowAddForm(true);
											setEditingFactId(null);
											setFormContent("");
											setFormCategory("general");
											setFormImportance(3);
											setFormError("");
										}}
										className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all"
									>
										<Plus className="h-3.5 w-3.5" />
										Add Memory
									</button>
								)}
							</div>
						</div>

						{/* Inline add form */}
						{showAddForm && (
							<div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 mb-6">
								<div className="space-y-3">
									<div>
										<textarea
											value={formContent}
											onChange={(e) => setFormContent(e.target.value)}
											placeholder="Enter a memory fact…"
											className="w-full rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 min-h-[80px] outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
										/>
									</div>
									<div className="flex flex-wrap gap-3">
										<div className="flex-1 min-w-[140px]">
											<label className="block text-xs text-text-tertiary mb-1">
												Category
											</label>
											<select
												value={formCategory}
												onChange={(e) => setFormCategory(e.target.value)}
												className="w-full h-9 rounded-lg border border-border bg-surface text-xs text-text-secondary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
											>
												{CATEGORIES.filter((c) => c !== "all").map((cat) => (
													<option key={cat} value={cat}>
														{CATEGORY_LABELS[cat] || cat}
													</option>
												))}
											</select>
										</div>
										<div className="flex-1 min-w-[120px]">
											<label className="block text-xs text-text-tertiary mb-1">
												Importance
											</label>
											<select
												value={formImportance}
												onChange={(e) =>
													setFormImportance(Number(e.target.value))
												}
												className="w-full h-9 rounded-lg border border-border bg-surface text-xs text-text-secondary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
											>
												{[1, 2, 3, 4, 5].map((i) => (
													<option key={i} value={i}>
														{i} —{" "}
														{i === 1
															? "Low"
															: i === 5
																? "Critical"
																: i === 2
																	? "Minor"
																	: i === 3
																		? "Normal"
																		: "Important"}
													</option>
												))}
											</select>
										</div>
									</div>
									{formError && (
										<p className="text-xs text-red-400 flex items-center gap-1">
											<AlertCircle className="h-3 w-3" />
											{formError}
										</p>
									)}
									<div className="flex items-center gap-2">
										<button
											onClick={handleAddFact}
											disabled={formSaving || !formContent.trim()}
											className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all disabled:opacity-50"
										>
											{formSaving ? "Saving…" : "Save"}
										</button>
										<button
											onClick={() => {
												setShowAddForm(false);
												setFormError("");
											}}
											className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Loading state */}
						{factsLoading && (
							<div className="space-y-3">
								<FactSkeleton />
								<FactSkeleton />
								<FactSkeleton />
							</div>
						)}

						{/* Error state */}
						{factsError && !factsLoading && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center justify-between">
								<p className="text-sm text-red-400 flex items-center gap-2">
									<AlertCircle className="h-4 w-4" />
									{factsError}
								</p>
								<button
									onClick={loadFacts}
									className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
								>
									<RefreshCw className="h-3 w-3" />
									Retry
								</button>
							</div>
						)}

						{/* Empty state */}
						{!factsLoading && !factsError && facts.length === 0 && (
							<div className="rounded-2xl border border-border bg-surface p-8 text-center">
								<p className="text-sm text-text-secondary">
									No memory facts yet. Facts are automatically extracted from
									your conversations.
								</p>
							</div>
						)}

						{/* Facts list */}
						{!factsLoading && facts.length > 0 && (
							<div className="space-y-3">
								{facts.map((fact) => (
									<div
										key={fact.id}
										className="rounded-2xl border border-border bg-surface p-5"
									>
										{editingFactId === fact.id ? (
											// ── Inline edit form ──
											<div className="space-y-3">
												<textarea
													value={formContent}
													onChange={(e) => setFormContent(e.target.value)}
													className="w-full rounded-lg border border-border bg-background text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 min-h-[80px] outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
												/>
												<div className="flex flex-wrap gap-3">
													<div className="flex-1 min-w-[140px]">
														<label className="block text-xs text-text-tertiary mb-1">
															Category
														</label>
														<select
															value={formCategory}
															onChange={(e) => setFormCategory(e.target.value)}
															className="w-full h-8 rounded-lg border border-border bg-background text-xs text-text-secondary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
														>
															{CATEGORIES.filter((c) => c !== "all").map(
																(cat) => (
																	<option key={cat} value={cat}>
																		{CATEGORY_LABELS[cat] || cat}
																	</option>
																),
															)}
														</select>
													</div>
													<div className="flex-1 min-w-[120px]">
														<label className="block text-xs text-text-tertiary mb-1">
															Importance
														</label>
														<select
															value={formImportance}
															onChange={(e) =>
																setFormImportance(Number(e.target.value))
															}
															className="w-full h-8 rounded-lg border border-border bg-background text-xs text-text-secondary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
														>
															{[1, 2, 3, 4, 5].map((i) => (
																<option key={i} value={i}>
																	{i}
																</option>
															))}
														</select>
													</div>
												</div>
												{formError && (
													<p className="text-xs text-red-400 flex items-center gap-1">
														<AlertCircle className="h-3 w-3" />
														{formError}
													</p>
												)}
												<div className="flex items-center gap-2">
													<button
														onClick={() => handleUpdateFact(fact.id)}
														disabled={formSaving || !formContent.trim()}
														className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all disabled:opacity-50"
													>
														<Check className="h-3 w-3" />
														{formSaving ? "Saving…" : "Save"}
													</button>
													<button
														onClick={cancelEditing}
														className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
													>
														<X className="h-3 w-3" />
														Cancel
													</button>
												</div>
											</div>
										) : (
											// ── Fact display ──
											<>
												<div className="flex items-start justify-between gap-4 mb-2">
													<div className="flex-1 min-w-0">
														<p className="text-sm text-text-primary leading-relaxed">
															{fact.content}
														</p>
														<div className="flex items-center gap-2 mt-2 flex-wrap">
															<CategoryBadge category={fact.category} />
															<ImportanceStars value={fact.importance} />
															<span className="text-[10px] text-text-tertiary">
																{new Date(fact.created_at).toLocaleDateString(
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
													<div className="flex items-center gap-1 shrink-0">
														{/* Edit button */}
														<button
															onClick={() => startEditing(fact)}
															className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
															aria-label="Edit fact"
															title="Edit"
														>
															<svg
																className="h-3.5 w-3.5"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
																strokeWidth={2}
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
																/>
															</svg>
														</button>
														{/* Delete button */}
														{deleteConfirmId === fact.id ? (
															<div className="flex items-center gap-1">
																<button
																	onClick={() => handleDeleteFact(fact.id)}
																	className="h-7 px-2 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
																>
																	Confirm
																</button>
																<button
																	onClick={() => setDeleteConfirmId(null)}
																	className="h-7 px-2 rounded border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
																>
																	Cancel
																</button>
															</div>
														) : (
															<button
																onClick={() => setDeleteConfirmId(fact.id)}
																className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500 transition-colors"
																aria-label="Delete fact"
																title="Delete"
															>
																<Trash2 className="h-3.5 w-3.5" />
															</button>
														)}
													</div>
												</div>
											</>
										)}
									</div>
								))}
							</div>
						)}
					</section>
				)}
			</main>
		</div>
	);
}
