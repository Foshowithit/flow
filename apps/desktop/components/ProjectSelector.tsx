"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Folder, Plus, Loader2, AlertCircle, X, Check } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Project {
	id: string;
	name: string;
	description: string | null;
	instructions: string | null;
	created_at: string;
	updated_at: string;
}

interface ProjectSelectorProps {
	selectedProjectId?: string;
	onProjectChange?: (projectId: string | null) => void;
}

// ─── Storage key ─────────────────────────────────────────────────────────

const STORAGE_KEY = "flow_active_project_id";

// ─── Helpers ─────────────────────────────────────────────────────────────

function getStoredProjectId(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function setStoredProjectId(id: string | null) {
	if (typeof window === "undefined") return;
	try {
		if (id) {
			localStorage.setItem(STORAGE_KEY, id);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// Silently fail
	}
}

// ─── Component ───────────────────────────────────────────────────────────

export default function ProjectSelector({
	selectedProjectId: controlledProjectId,
	onProjectChange,
}: ProjectSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(
		controlledProjectId ?? getStoredProjectId(),
	);
	const [showNewProjectForm, setShowNewProjectForm] = useState(false);
	const [newName, setNewName] = useState("");
	const [newInstructions, setNewInstructions] = useState("");
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedProject = projects.find((p) => p.id === selectedId);

	// Sync controlled prop
	useEffect(() => {
		if (controlledProjectId !== undefined) {
			setSelectedId(controlledProjectId);
		}
	}, [controlledProjectId]);

	// Load projects on mount
	useEffect(() => {
		setLoading(true);
		setError("");
		fetch("/api/projects")
			.then((res) => {
				if (!res.ok) throw new Error("Failed to load projects");
				return res.json();
			})
			.then((data: Project[]) => {
				setProjects(data);
			})
			.catch((err) => {
				setError(err.message || "Failed to load projects");
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	// Close dropdown on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
				setShowNewProjectForm(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = useCallback(
		(projectId: string | null) => {
			setSelectedId(projectId);
			setStoredProjectId(projectId);
			setIsOpen(false);
			onProjectChange?.(projectId);
		},
		[onProjectChange],
	);

	const handleCreateProject = useCallback(async () => {
		const trimmedName = newName.trim();
		if (!trimmedName) return;
		setCreating(true);
		setCreateError("");
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: trimmedName,
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
			setProjects((prev) => [project, ...prev]);
			setSelectedId(project.id);
			setStoredProjectId(project.id);
			onProjectChange?.(project.id);
			setShowNewProjectForm(false);
			setNewName("");
			setNewInstructions("");
		} catch (err) {
			setCreateError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setCreating(false);
		}
	}, [newName, newInstructions, onProjectChange]);

	return (
		<div className="relative" ref={dropdownRef}>
			{/* Dropdown trigger */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors w-full"
				aria-label="Select project"
				title={
					selectedProject
						? `Project: ${selectedProject.name}`
						: "No project selected"
				}
			>
				<Folder className="h-3 w-3 shrink-0" />
				<span className="truncate flex-1 text-left">
					{selectedProject ? selectedProject.name : "No Project"}
				</span>
			</button>

			{/* Dropdown list */}
			{isOpen && (
				<div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-surface shadow-xl z-50 max-h-64 flex flex-col">
					{/* Header */}
					<div className="px-3 py-2 border-b border-border">
						<span className="text-xs font-semibold text-text-primary tracking-tight">
							Projects
						</span>
					</div>

					{/* Scrollable list */}
					<div className="flex-1 overflow-y-auto py-1">
						{loading && (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
							</div>
						)}

						{error && !loading && (
							<div className="px-3 py-4">
								<p className="text-xs text-red-400 flex items-center gap-1">
									<AlertCircle className="h-3 w-3" />
									{error}
								</p>
							</div>
						)}

						{!loading && !error && (
							<>
								{/* No Project option */}
								<button
									onClick={() => handleSelect(null)}
									className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-hover ${
										selectedId === null
											? "text-accent font-medium"
											: "text-text-secondary"
									}`}
								>
									No Project
								</button>

								{projects.length === 0 && (
									<div className="px-3 py-4 text-center">
										<p className="text-xs text-text-tertiary">
											No projects yet.
										</p>
									</div>
								)}

								{projects.map((project) => (
									<button
										key={project.id}
										onClick={() => handleSelect(project.id)}
										className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-hover flex items-center justify-between ${
											selectedId === project.id
												? "text-accent font-medium"
												: "text-text-secondary"
										}`}
									>
										<span className="truncate">{project.name}</span>
										{selectedId === project.id && (
											<Check className="h-3 w-3 text-accent shrink-0 ml-2" />
										)}
									</button>
								))}
							</>
						)}
					</div>

					{/* New project form or button */}
					<div className="border-t border-border">
						{showNewProjectForm ? (
							<div className="p-3 space-y-2">
								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="Project name"
									className="w-full h-8 rounded-md border border-border bg-background text-xs text-text-primary placeholder:text-text-tertiary px-2 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
									autoFocus
								/>
								<textarea
									value={newInstructions}
									onChange={(e) => setNewInstructions(e.target.value)}
									placeholder="Instructions (optional)"
									className="w-full rounded-md border border-border bg-background text-xs text-text-primary placeholder:text-text-tertiary px-2 py-1.5 min-h-[50px] outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
									rows={2}
								/>
								{createError && (
									<p className="text-[10px] text-red-400">{createError}</p>
								)}
								<div className="flex items-center gap-2">
									<button
										onClick={handleCreateProject}
										disabled={creating || !newName.trim()}
										className="flex-1 h-7 rounded-md bg-accent text-black text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
									>
										{creating ? "Creating…" : "Create"}
									</button>
									<button
										onClick={() => {
											setShowNewProjectForm(false);
											setCreateError("");
										}}
										className="h-7 px-2 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<button
								onClick={() => {
									setShowNewProjectForm(true);
									setNewName("");
									setNewInstructions("");
								}}
								className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
							>
								<Plus className="h-3 w-3" />+ New Project
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
