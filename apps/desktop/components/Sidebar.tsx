"use client";

import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProjectSelector from "@/components/ProjectSelector";
import {
	Plus,
	PanelLeftClose,
	Pencil,
	Trash2,
	Settings,
	Brain,
	Folder,
	Search,
	X,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";

interface Conversation {
	id: string;
	title: string;
}

interface SearchResult {
	sessionId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	matchedRole: string | null;
	snippet: string | null;
	messageCreatedAt: string | null;
}

interface SidebarProps {
	conversations: Conversation[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onRename: (id: string, currentTitle: string) => void;
	onDelete: (id: string) => void;
	isOpen: boolean;
	onClose: () => void;
}

export default function Sidebar({
	conversations,
	activeId,
	onSelect,
	onNew,
	onRename,
	onDelete,
	isOpen,
	onClose,
}: SidebarProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
		null,
	);
	const [isSearching, setIsSearching] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);

	// Track mount state for guarding async setState after unmount
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Debounced search
	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		const trimmed = searchQuery.trim();
		if (trimmed.length < 2) {
			setSearchResults(null);
			return;
		}

		debounceRef.current = setTimeout(async () => {
			setIsSearching(true);
			try {
				const res = await fetch(
					`/api/sessions/search?q=${encodeURIComponent(trimmed)}`,
				);
				if (!res.ok) {
					if (mountedRef.current) setSearchResults([]);
					return;
				}
				const data: SearchResult[] = await res.json();
				if (mountedRef.current) {
					setSearchResults(Array.isArray(data) ? data : []);
				}
			} catch {
				if (mountedRef.current) setSearchResults([]);
			} finally {
				if (mountedRef.current) setIsSearching(false);
			}
		}, 300);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [searchQuery]);
	const clearSearch = useCallback(() => {
		setSearchQuery("");
		setSearchResults(null);
	}, []);

	const isSearchActive = searchResults !== null;

	return (
		<>
			{/* Mobile overlay */}
			<div
				className={cn("sidebar-overlay", isOpen && "open")}
				onClick={onClose}
			/>

			{/* Sidebar panel */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-surface border-r border-border",
					"transition-transform duration-300 ease-in-out",
					"-translate-x-full md:translate-x-0 md:static md:z-auto",
					isOpen && "translate-x-0",
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-4 h-12 border-b border-border">
					<span className="text-sm font-semibold text-text-primary tracking-tight">
						Flow
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={onNew}
							aria-label="New chat"
							className="h-8 w-8"
						>
							<Plus className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							aria-label="Close sidebar"
							className="h-8 w-8 md:hidden"
						>
							<PanelLeftClose className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Search box */}
				<div className="px-2 pt-2 pb-1">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search conversations…"
							aria-label="Search conversations"
							className="w-full h-8 rounded-lg bg-surface-hover border border-border pl-7 pr-7 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
						/>
						{searchQuery && (
							<button
								onClick={clearSearch}
								className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary transition-colors"
								aria-label="Clear search"
							>
								<X className="h-3 w-3" />
							</button>
						)}
					</div>
				</div>

				{/* Content: search results or conversation list */}
				<ScrollArea className="flex-1 px-2 py-1">
					{isSearchActive ? (
						// ── Search Results ──
						<div className="space-y-0.5">
							{isSearching && searchResults === null && (
								<div className="text-center py-6 text-xs text-text-tertiary">
									Searching…
								</div>
							)}
							{!isSearching && searchResults?.length === 0 && (
								<div className="text-center py-6 text-xs text-text-tertiary">
									No results found.
								</div>
							)}
							{searchResults?.map((result) => (
								<div
									key={result.sessionId}
									className={cn(
										"rounded-lg transition-colors cursor-pointer",
										"hover:bg-surface-hover",
										activeId === result.sessionId && "bg-accent-light",
									)}
									onClick={() => {
										onSelect(result.sessionId);
										onClose();
										clearSearch();
									}}
								>
									<div className="px-3 py-2">
										<div className="text-sm font-medium text-text-primary truncate">
											{result.title}
										</div>
										{result.snippet && (
											<div className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
												{result.snippet}
											</div>
										)}
										<div className="flex items-center gap-2 mt-1">
											<span className="text-[10px] uppercase font-medium text-text-tertiary">
												{result.matchedRole === "user"
													? "You"
													: result.matchedRole === "assistant"
														? "Assistant"
														: "Title"}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						// ── Conversation List ──
						<>
							{conversations.length === 0 && (
								<div className="text-center py-10 px-4 text-sm text-text-tertiary leading-relaxed">
									No conversations yet.
								</div>
							)}
							<div className="space-y-0.5">
								{conversations.map((conv) => (
									<div
										key={conv.id}
										className={cn(
											"group flex items-center gap-1 rounded-lg transition-colors",
											"hover:bg-surface-hover",
											activeId === conv.id && "bg-accent-light",
										)}
									>
										<button
											onClick={() => {
												onSelect(conv.id);
												onClose();
											}}
											className={cn(
												"flex-1 text-left px-3 py-2 text-sm transition-colors min-w-0",
												activeId === conv.id
													? "text-accent font-medium"
													: "text-text-secondary",
											)}
										>
											<span className="truncate block">{conv.title}</span>
										</button>
										<div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												onClick={(e) => {
													e.stopPropagation();
													onRename(conv.id, conv.title);
												}}
												className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
												aria-label={`Rename ${conv.title}`}
												title="Rename"
											>
												<Pencil className="h-3.5 w-3.5" />
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													onDelete(conv.id);
												}}
												className="h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-tertiary hover:text-red-500 transition-colors"
												aria-label={`Delete ${conv.title}`}
												title="Delete"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								))}
							</div>
						</>
					)}
				</ScrollArea>

				{/* Footer — User info + links */}
				<div className="px-4 py-3 border-t border-border space-y-2">
					<UserInfo />
					<ProjectSelector />
					<div className="flex items-center gap-1 pt-1 border-t border-border-light">
						<Link
							href="/memory"
							className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
						>
							<Brain className="h-3 w-3" />
							Memory
						</Link>
						<Link
							href="/projects"
							className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
						>
							<Folder className="h-3 w-3" />
							Projects
						</Link>
						<Link
							href="/settings"
							className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
						>
							<Settings className="h-3 w-3" />
							Settings
						</Link>
					</div>
				</div>
			</aside>
		</>
	);
}

// ─── Sidebar User Info ────────────────────────────────────────────

function UserInfo() {
	const { isSignedIn, user } = useUser();

	if (!isSignedIn) {
		return (
			<div className="flex items-center gap-2 min-w-0">
				<div className="h-6 w-6 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
					?
				</div>
				<div className="flex flex-col min-w-0">
					<span className="text-xs font-medium text-text-primary truncate">
						Guest
					</span>
					<span className="text-[10px] text-text-tertiary truncate">
						Sign in to save chats
					</span>
				</div>
			</div>
		);
	}

	const displayName =
		user?.firstName && user?.lastName
			? `${user.firstName} ${user.lastName}`
			: user?.firstName ||
				user?.primaryEmailAddress?.emailAddress ||
				"Flow User";

	return (
		<div className="flex items-center gap-2 min-w-0">
			<div className="h-6 w-6 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
				{displayName.charAt(0).toUpperCase()}
			</div>
			<div className="flex flex-col min-w-0">
				<span className="text-xs font-medium text-text-primary truncate">
					{displayName}
				</span>
				{user?.primaryEmailAddress?.emailAddress && (
					<span className="text-[10px] text-text-tertiary truncate">
						{user.primaryEmailAddress.emailAddress}
					</span>
				)}
			</div>
		</div>
	);
}
