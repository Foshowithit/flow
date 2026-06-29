"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";
import {
	ArrowLeft,
	Upload,
	Trash2,
	FileText,
	AlertCircle,
	Loader2,
	Star,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Project {
	id: string;
	name: string;
	description: string | null;
	instructions: string | null;
	knowledge_file_count: number;
	created_at: string;
	updated_at: string;
}

interface KnowledgeFile {
	id: string;
	name: string | null;
	mime_type: string | null;
	token_count: number;
	created_at: string;
}

interface ProjectMemory {
	id: string;
	content: string;
	category: string;
	importance: number;
	source_session_id: string | null;
	created_at: string;
}

type Tab = "settings" | "knowledge" | "memories";

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

const ACCEPTED_FILE_EXTENSIONS = ".txt,.md,.csv,.json,.ts,.tsx,.py,.js";

// ─── Page Component ──────────────────────────────────────────────────────

export default function ProjectDetailPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const params = useParams();
	const router = useRouter();
	const projectId = params.id as string;

	const [project, setProject] = useState<Project | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState<Tab>("settings");

	// Settings form
	const [editName, setEditName] = useState("");
	const [editInstructions, setEditInstructions] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
		"idle",
	);

	// Knowledge files
	const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
	const [knowledgeLoading, setKnowledgeLoading] = useState(false);
	const [knowledgeError, setKnowledgeError] = useState("");
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState("");
	const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

	// Project memories
	const [memories, setMemories] = useState<ProjectMemory[]>([]);
	const [memoriesLoading, setMemoriesLoading] = useState(false);
	const [memoriesError, setMemoriesError] = useState("");
	const [deleteMemoryId, setDeleteMemoryId] = useState<string | null>(null);

	// ── Load project ────────────────────────────────────────────────

	const loadProject = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`/api/projects/${projectId}`);
			if (!res.ok) {
				if (res.status === 404) throw new Error("Project not found");
				throw new Error("Failed to load project");
			}
			const data: Project = await res.json();
			setProject(data);
			setEditName(data.name);
			setEditInstructions(data.instructions || "");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) {
			setLoading(false);
			return;
		}
		loadProject();
	}, [isLoaded, isSignedIn, loadProject]);

	// ── Load knowledge files ────────────────────────────────────────

	const loadKnowledgeFiles = useCallback(async () => {
		setKnowledgeLoading(true);
		setKnowledgeError("");
		try {
			const res = await fetch(`/api/projects/${projectId}/knowledge`);
			if (!res.ok) throw new Error("Failed to load knowledge files");
			const data: KnowledgeFile[] = await res.json();
			setKnowledgeFiles(data);
		} catch (err) {
			setKnowledgeError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setKnowledgeLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		if (!isSignedIn || activeTab !== "knowledge") return;
		loadKnowledgeFiles();
	}, [isSignedIn, activeTab, loadKnowledgeFiles]);

	// ── Load project memories ───────────────────────────────────────

	const loadMemories = useCallback(async () => {
		setMemoriesLoading(true);
		setMemoriesError("");
		try {
			const res = await fetch(`/api/projects/${projectId}/memories`);
			if (!res.ok) throw new Error("Failed to load project memories");
			const data: ProjectMemory[] = await res.json();
			setMemories(data);
		} catch (err) {
			setMemoriesError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setMemoriesLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		if (!isSignedIn || activeTab !== "memories") return;
		loadMemories();
	}, [isSignedIn, activeTab, loadMemories]);

	// ── Save settings ───────────────────────────────────────────────

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaveStatus("idle");
		try {
			const res = await fetch(`/api/projects/${projectId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editName.trim(),
					instructions: editInstructions.trim() || null,
				}),
			});
			if (!res.ok) {
				const errData = await res
					.json()
					.catch(() => ({ error: "Failed to save" }));
				throw new Error(errData.error || "Failed to save");
			}
			const updated: Project = await res.json();
			setProject(updated);
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2500);
		} catch (err) {
			setSaveStatus("error");
		} finally {
			setSaving(false);
		}
	}, [projectId, editName, editInstructions]);

	// ── Upload knowledge file ───────────────────────────────────────

	const handleUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			setUploading(true);
			setUploadError("");
			const formData = new FormData();
			formData.append("file", file);
			try {
				const res = await fetch(`/api/projects/${projectId}/knowledge`, {
					method: "POST",
					body: formData,
				});
				if (!res.ok) {
					const errData = await res
						.json()
						.catch(() => ({ error: "Upload failed" }));
					throw new Error(errData.error || "Upload failed");
				}
				loadKnowledgeFiles();
			} catch (err) {
				setUploadError(err instanceof Error ? err.message : "Upload failed.");
			} finally {
				setUploading(false);
				// Reset the input
				e.target.value = "";
			}
		},
		[projectId, loadKnowledgeFiles],
	);

	// ── Delete knowledge file ───────────────────────────────────────

	const handleDeleteFile = useCallback(
		async (fileId: string) => {
			try {
				const res = await fetch(
					`/api/projects/${projectId}/knowledge/${fileId}`,
					{ method: "DELETE" },
				);
				if (!res.ok) throw new Error("Failed to delete file");
				setKnowledgeFiles((prev) => prev.filter((f) => f.id !== fileId));
				setDeleteFileId(null);
			} catch (err) {
				setKnowledgeError(
					err instanceof Error ? err.message : "Failed to delete.",
				);
			}
		},
		[projectId],
	);

	// ── Delete project memory ───────────────────────────────────────

	const handleDeleteMemory = useCallback(
		async (memoryId: string) => {
			try {
				const res = await fetch(
					`/api/projects/${projectId}/memories?id=${memoryId}`,
					{ method: "DELETE" },
				);
				if (!res.ok) throw new Error("Failed to delete memory");
				setMemories((prev) => prev.filter((m) => m.id !== memoryId));
				setDeleteMemoryId(null);
			} catch (err) {
				setMemoriesError(
					err instanceof Error ? err.message : "Failed to delete.",
				);
			}
		},
		[projectId],
	);

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
					Project
				</h1>
				<div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-5 py-6 max-w-sm">
					<p className="text-sm text-yellow-400 mb-3">
						Authentication is taking longer than expected.
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
					Project
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					Sign in to view project details.
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

	// ── Loading error state ─────────────────────────────────────────

	if (loading) {
		return (
			<div className="min-h-dvh bg-background flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
			</div>
		);
	}

	if (error || !project) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Project
				</h1>
				<p className="text-sm text-red-400 mb-6">
					{error || "Project not found."}
				</p>
				<Link
					href="/projects"
					className="text-sm text-accent hover:text-accent-hover transition-colors"
				>
					&larr; Back to projects
				</Link>
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
						<Link
							href="/projects"
							className="text-sm text-text-secondary hover:text-text-primary transition-colors"
						>
							Projects
						</Link>
						<span className="text-sm text-text-secondary">/</span>
						<h1 className="text-sm font-semibold text-text-primary tracking-tight">
							{project.name}
						</h1>
					</div>
					<Link
						href="/chat"
						className="text-sm text-text-secondary hover:text-text-primary transition-colors"
					>
						Back to chat
					</Link>
				</div>
			</header>

			{/* Tab navigation */}
			<div className="border-b border-border">
				<div className="max-w-3xl mx-auto px-6 flex gap-6">
					{(
						[
							{ id: "settings" as Tab, label: "Settings" },
							{ id: "knowledge" as Tab, label: "Knowledge" },
							{ id: "memories" as Tab, label: "Project Memories" },
						] as const
					).map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === tab.id
									? "border-accent text-accent"
									: "border-transparent text-text-secondary hover:text-text-primary"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<main className="max-w-3xl mx-auto px-6 py-8">
				{activeTab === "settings" && (
					<div className="rounded-2xl border border-border bg-surface p-6">
						<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
							Project Settings
						</h2>
						<div className="space-y-4">
							{/* Name */}
							<div>
								<label className="block text-xs text-text-tertiary mb-1">
									Project Name
								</label>
								<input
									type="text"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="w-full h-9 rounded-lg border border-border bg-background text-sm text-text-primary px-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
								/>
							</div>

							{/* Instructions */}
							<div>
								<label className="block text-xs text-text-tertiary mb-1">
									Instructions
								</label>
								<textarea
									value={editInstructions}
									onChange={(e) => setEditInstructions(e.target.value)}
									placeholder="Context or instructions for this project…"
									className="w-full rounded-lg border border-border bg-background text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 min-h-[120px] outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
								/>
							</div>

							{/* Save button */}
							<div className="flex items-center gap-3 pt-2">
								<button
									onClick={handleSave}
									disabled={saving || !editName.trim()}
									className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all disabled:opacity-50"
								>
									{saving ? "Saving…" : "Save"}
								</button>
								{saveStatus === "saved" && (
									<span className="text-xs text-green-500">Saved ✓</span>
								)}
								{saveStatus === "error" && (
									<span className="text-xs text-red-400">Failed to save</span>
								)}
							</div>
						</div>
					</div>
				)}

				{activeTab === "knowledge" && (
					<div className="space-y-6">
						{/* Upload section */}
						<div className="rounded-2xl border border-border bg-surface p-6">
							<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
								Knowledge Files
							</h2>
							<p className="text-xs text-text-tertiary mb-4">
								Upload files for the AI to reference. Accepted formats:{" "}
								{ACCEPTED_FILE_EXTENSIONS}. Files are chunked and embedded for
								semantic search.
							</p>

							<div className="flex items-center gap-3">
								<label className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-black font-semibold text-xs hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
									<Upload className="h-3.5 w-3.5" />
									{uploading ? "Uploading…" : "Upload File"}
									<input
										type="file"
										accept={ACCEPTED_FILE_EXTENSIONS}
										onChange={handleUpload}
										disabled={uploading}
										className="hidden"
									/>
								</label>
								{uploadError && (
									<span className="text-xs text-red-400 flex items-center gap-1">
										<AlertCircle className="h-3 w-3" />
										{uploadError}
									</span>
								)}
							</div>

							{/* File size hint */}
							<p className="text-[10px] text-text-tertiary mt-2">
								50 MB max file size.
							</p>
						</div>

						{/* File list */}
						{knowledgeLoading && (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
							</div>
						)}

						{knowledgeError && !knowledgeLoading && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
								<p className="text-sm text-red-400">{knowledgeError}</p>
							</div>
						)}

						{!knowledgeLoading && knowledgeFiles.length === 0 && (
							<div className="rounded-2xl border border-border bg-surface p-8 text-center">
								<p className="text-sm text-text-secondary">
									No knowledge files uploaded yet.
								</p>
							</div>
						)}

						{knowledgeFiles.length > 0 && (
							<div className="space-y-2">
								{knowledgeFiles.map((file) => (
									<div
										key={file.id}
										className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
									>
										<div className="flex items-center gap-3 min-w-0">
											<FileText className="h-4 w-4 text-text-tertiary shrink-0" />
											<div className="min-w-0">
												<p className="text-sm text-text-primary truncate">
													{file.name || "Untitled file"}
												</p>
												<p className="text-[10px] text-text-tertiary">
													~{file.token_count.toLocaleString()} tokens
												</p>
											</div>
										</div>
										{deleteFileId === file.id ? (
											<div className="flex items-center gap-1 shrink-0">
												<button
													onClick={() => handleDeleteFile(file.id)}
													className="h-6 px-2 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition-colors"
												>
													Confirm
												</button>
												<button
													onClick={() => setDeleteFileId(null)}
													className="h-6 px-2 rounded border border-border text-[10px] text-text-secondary hover:text-text-primary transition-colors"
												>
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={() => setDeleteFileId(file.id)}
												className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500 transition-colors shrink-0"
												aria-label="Delete file"
												title="Delete"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{activeTab === "memories" && (
					<section>
						<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
							Project Memories
						</h2>

						{memoriesLoading && (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
							</div>
						)}

						{memoriesError && !memoriesLoading && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
								<p className="text-sm text-red-400">{memoriesError}</p>
							</div>
						)}

						{!memoriesLoading && memories.length === 0 && (
							<div className="rounded-2xl border border-border bg-surface p-8 text-center">
								<p className="text-sm text-text-secondary">
									No project-specific memories yet.
								</p>
							</div>
						)}

						{memories.length > 0 && (
							<div className="space-y-3">
								{memories.map((memory) => (
									<div
										key={memory.id}
										className="rounded-2xl border border-border bg-surface p-5"
									>
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1 min-w-0">
												<p className="text-sm text-text-primary leading-relaxed">
													{memory.content}
												</p>
												<div className="flex items-center gap-2 mt-2 flex-wrap">
													<span
														className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
															CATEGORY_COLORS[memory.category] ||
															CATEGORY_COLORS.general
														}`}
													>
														{CATEGORY_LABELS[memory.category] ||
															memory.category}
													</span>
													<span className="inline-flex gap-0.5">
														{[1, 2, 3, 4, 5].map((i) => (
															<Star
																key={i}
																className={`h-3 w-3 ${
																	i <= memory.importance
																		? "text-yellow-400 fill-yellow-400"
																		: "text-text-tertiary"
																}`}
															/>
														))}
													</span>
													<span className="text-[10px] text-text-tertiary">
														{new Date(memory.created_at).toLocaleDateString(
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
											{deleteMemoryId === memory.id ? (
												<div className="flex items-center gap-1 shrink-0">
													<button
														onClick={() => handleDeleteMemory(memory.id)}
														className="h-6 px-2 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 transition-colors"
													>
														Confirm
													</button>
													<button
														onClick={() => setDeleteMemoryId(null)}
														className="h-6 px-2 rounded border border-border text-[10px] text-text-secondary hover:text-text-primary transition-colors"
													>
														Cancel
													</button>
												</div>
											) : (
												<button
													onClick={() => setDeleteMemoryId(memory.id)}
													className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500 transition-colors shrink-0"
													aria-label="Delete memory"
													title="Delete"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</button>
											)}
										</div>
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
