"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Plus,
	Settings,
	ChevronDown,
	ChevronRight,
	Search,
	Loader2,
} from "lucide-react";
import Link from "next/link";

interface ServerSession {
	id: string;
	title: string;
	created_at?: string;
}
interface DesktopSidebarProps {
	sessions: ServerSession[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onRename?: (id: string, currentTitle: string) => void;
	onDelete?: (id: string) => void;
	isLoading?: boolean;
	/** Whether the sidebar is visible (desktop toggle) */
	open?: boolean;
}

function groupSessionsByDate(
	sessions: ServerSession[],
): Record<string, ServerSession[]> {
	if (sessions.length === 0) return {};

	// If no sessions have dates, just show all under "Conversations"
	if (!sessions[0]?.created_at) {
		return { Conversations: sessions };
	}

	const groups: Record<string, ServerSession[]> = {};
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	for (const session of sessions) {
		const created = new Date(session.created_at!);
		created.setHours(0, 0, 0, 0);

		let group: string;
		if (created.getTime() === today.getTime()) {
			group = "Today";
		} else if (created.getTime() === yesterday.getTime()) {
			group = "Yesterday";
		} else {
			group = created.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year:
					created.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
			});
		}

		if (!groups[group]) groups[group] = [];
		groups[group].push(session);
	}

	return groups;
}

export default function DesktopSidebar({
	sessions,
	activeId,
	onSelect,
	onNew,
	onRename,
	onDelete,
	isLoading,
	open = true,
}: DesktopSidebarProps) {
	const { user } = useUser();
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [searchQuery, setSearchQuery] = useState("");

	function toggleSection(section: string) {
		setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
	}

	// Group and filter sessions
	const groups = groupSessionsByDate(sessions);

	const filtered = Object.entries(groups).reduce(
		(acc, [section, sectionSessions]) => {
			const filteredSessions = sectionSessions.filter((s) =>
				s.title.toLowerCase().includes(searchQuery.toLowerCase()),
			);
			if (filteredSessions.length > 0) {
				acc[section] = filteredSessions;
			}
			return acc;
		},
		{} as Record<string, ServerSession[]>,
	);

	// Avatar display
	const avatarLetter =
		user?.firstName?.[0] ||
		user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ||
		"U";
	const displayName =
		user?.fullName || user?.primaryEmailAddress?.emailAddress || "User";

	return (
		<aside
			className={cn(
				"flex flex-col h-full bg-surface border-r border-border",
				!open && "hidden",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 h-12 shrink-0">
				<span className="text-sm font-semibold text-text-primary tracking-tight">
					Flow
				</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onNew}
					aria-label="New chat"
					className="h-8 w-8 text-text-tertiary hover:text-text-primary"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			{/* Search */}
			<div className="px-2 pb-2 shrink-0">
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search conversations…"
						aria-label="Search conversations"
						className="w-full h-8 rounded-lg bg-surface-hover/50 border border-border pl-7 pr-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
					/>
				</div>
			</div>

			{/* Sessions list */}
			<div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
				{isLoading && sessions.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full gap-2">
						<Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
						<p className="text-xs text-text-tertiary">Loading conversations…</p>
					</div>
				) : Object.keys(filtered).length === 0 ? (
					<div className="text-center py-8 px-4 text-xs text-text-tertiary">
						{sessions.length === 0
							? "No conversations yet. Start a new chat."
							: "No conversations found."}
					</div>
				) : (
					Object.entries(filtered).map(([section, sectionSessions]) => (
						<div key={section} className="mb-1">
							<button
								onClick={() => toggleSection(section)}
								className="flex items-center gap-1 w-full px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary transition-colors"
							>
								{collapsed[section] ? (
									<ChevronRight className="h-3 w-3" />
								) : (
									<ChevronDown className="h-3 w-3" />
								)}
								{section}
							</button>
							{!collapsed[section] && (
								<div className="space-y-0.5">
									{sectionSessions.map((session) => (
										<div key={session.id} className="group relative">
											<button
												onClick={() => onSelect(session.id)}
												className={cn(
													"w-full text-left px-3 py-2 rounded-lg transition-colors",
													"hover:bg-surface-hover/60",
													activeId === session.id && "bg-accent-light",
												)}
											>
												<div className="text-sm font-medium text-text-primary truncate">
													{session.title}
												</div>
											</button>
											{/* Context actions — shown on hover */}
											<div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
												{onRename && (
													<button
														onClick={(e) => {
															e.stopPropagation();
															onRename(session.id, session.title);
														}}
														className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover/60 text-[10px] transition-colors"
														title="Rename"
													>
														✎
													</button>
												)}
												{onDelete && (
													<button
														onClick={(e) => {
															e.stopPropagation();
															onDelete(session.id);
														}}
														className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-destructive hover:bg-destructive/10 text-[10px] transition-colors"
														title="Delete"
													>
														✕
													</button>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					))
				)}
			</div>

			{/* Bottom: user + settings */}
			<div className="shrink-0 px-3 py-3 border-t border-border">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 min-w-0">
						<div className="h-7 w-7 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
							{avatarLetter}
						</div>
						<div className="flex flex-col min-w-0">
							<span className="text-xs font-medium text-text-primary truncate">
								{displayName}
							</span>
							<span className="text-[10px] text-text-tertiary truncate">
								{user ? "Signed in" : "Not signed in"}
							</span>
						</div>
					</div>
					<Link
						href="/settings"
						aria-label="Settings"
						className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover/60 text-text-tertiary hover:text-text-primary transition-colors"
					>
						<Settings className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</aside>
	);
}
