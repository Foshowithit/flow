"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";
import { Plus, Trash2, FileText, AlertCircle, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Project {
	id: string;
	name: string;
	description: string | null;
	instructions: string | null;
	knowledge_file_count?: number;
	created_at: string;
	updated_at: string;
}

// ─── Page Component ──────────────────────────────────────────────────────

export default function ProjectsPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const router = useRouter();

	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// New project form
	const [showForm, setShowForm] = useState(false);
	const [newName, setNewName] = useState("");
	const [newInstructions, setNewInstructions] = useState("");
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");

	// Delete confirmation
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// ── Load projects ───────────────────────────────────────────────

	const loadProjects = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/projects");
			if (!res.ok) throw new Error("Failed to load projects");
			const data: Project[] = await res.json();
			// Fetch knowledge file counts for each project
			const withCounts = await Promise.all(
				data.map(async (p) => {
					try {
						const countRes = await fetch(`/api/projects/${p.id}`);
						if (countRes.ok) {
							const detail = await countRes.json();
							return {
								...p,
								knowledge_file_count: detail.knowledge_file_count ?? 0,
							};
						}
					} catch {
						// Silently fail
					}
					return { ...p, knowledge_file_count: 0 };
				}),
			);
			setProjects(withCounts);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) {
			setLoading(false);
			return;
		}
		loadProjects();
	}, [isLoaded, isSignedIn, loadProjects]);

	// ── Create project ──────────────────────────────────────────────

	const handleCreate = useCallback(async () => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		setCreating(true);
		setCreateError("");
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: trimmed,
					instructions: newInstructions.trim() || undefined,
				}),
			});
			if (!res.ok) {
				const errData = await res
					.json()
					.catch(() => ({ error: "Failed to create" }));
				throw new Error(errData.error || "Failed to create project");
			}
			const project: Project = await res.json();
			setProjects((prev) => [{ ...project, knowledge_file_count: 0 }, ...prev]);
			setShowForm(false);
			setNewName("");
			setNewInstructions("");
		} catch (err) {
			setCreateError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setCreating(false);
		}
	}, [newName, newInstructions]);

	// ── Delete project ──────────────────────────────────────────────

	const handleDelete = useCallback(async (id: string) => {
		setDeleting(true);
		try {
			const res = await fetch(`/api/projects/${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete project");
			setProjects((prev) => prev.filter((p) => p.id !== id));
			setDeleteConfirmId(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete.");
		} finally {
			setDeleting(false);
		}
	}, []);

	// ── Auth guard states ───────────────────────────────────────────

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

	if (timedOut) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Projects
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
					Projects
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					Sign in to manage your projects.
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
							Projects
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
				{/* Header + New project button */}
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold tracking-tight text-text-primary">
						All Projects
					</h2>
					{!showForm && (
						<button
							onClick={() => setShowForm(true)}
							className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all"
						>
							<Plus className="h-3.5 w-3.5" />
							New Project
						</button>
					)}
				</div>

				{/* Inline create form */}
				{showForm && (
					<div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
						<div className="space-y-3">
							<div>
								<label className="block text-xs text-text-tertiary mb-1">
									Project Name
								</label>
								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="e.g. My Project"
									className="w-full h-9 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
									autoFocus
								/>
							</div>
							<div>
								<label className="block text-xs text-text-tertiary mb-1">
									Instructions (optional)
								</label>
								<textarea
									value={newInstructions}
									onChange={(e) => setNewInstructions(e.target.value)}
									placeholder="Context or instructions for this project…"
									className="w-full rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 min-h-[80px] outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
								/>
							</div>
							{createError && (
								<p className="text-xs text-red-400 flex items-center gap-1">
									<AlertCircle className="h-3 w-3" />
									{createError}
								</p>
							)}
							<div className="flex items-center gap-2">
								<button
									onClick={handleCreate}
									disabled={creating || !newName.trim()}
									className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all disabled:opacity-50"
								>
									{creating ? "Creating…" : "Create"}
								</button>
								<button
									onClick={() => {
										setShowForm(false);
										setCreateError("");
									}}
									className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Loading */}
				{loading && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
					</div>
				)}

				{/* Error */}
				{error && !loading && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{/* Empty state */}
				{!loading && !error && projects.length === 0 && (
					<div className="rounded-2xl border border-border bg-surface p-8 text-center">
						<p className="text-sm text-text-secondary">
							No projects yet. Create one to organise your work.
						</p>
					</div>
				)}

				{/* Project cards */}
				{!loading && projects.length > 0 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{projects.map((project) => (
							<div
								key={project.id}
								className="rounded-2xl border border-border bg-surface p-5 hover:border-accent/30 transition-colors group"
							>
								<div className="flex flex-col h-full">
									{/* Title row */}
									<div className="flex items-start justify-between gap-2 mb-2">
										<Link
											href={`/projects/${project.id}`}
											className="text-sm font-semibold text-text-primary hover:text-accent transition-colors truncate"
										>
											{project.name}
										</Link>
										{deleteConfirmId === project.id ? (
											<div className="flex items-center gap-1 shrink-0">
												<button
													onClick={(e) => {
														e.preventDefault();
														handleDelete(project.id);
													}}
													disabled={deleting}
													className="h-6 px-2 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition-colors"
												>
													{deleting ? "…" : "Confirm"}
												</button>
												<button
													onClick={(e) => {
														e.preventDefault();
														setDeleteConfirmId(null);
													}}
													className="h-6 px-2 rounded border border-border text-[10px] text-text-secondary hover:text-text-primary transition-colors"
												>
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													setDeleteConfirmId(project.id);
												}}
												className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
												aria-label="Delete project"
												title="Delete"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										)}
									</div>

									{/* Instructions preview */}
									{project.instructions && (
										<p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3 flex-1">
											{project.instructions}
										</p>
									)}

									{/* Footer info */}
									<div className="flex items-center gap-3 mt-auto pt-2 border-t border-border-light">
										<span className="text-[10px] text-text-tertiary flex items-center gap-1">
											<FileText className="h-3 w-3" />
											{project.knowledge_file_count ?? 0} file
											{(project.knowledge_file_count ?? 0) === 1 ? "" : "s"}
										</span>
										<Link
											href={`/projects/${project.id}`}
											className="text-[10px] text-accent hover:text-accent-hover transition-colors ml-auto"
										>
											Open &rarr;
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
