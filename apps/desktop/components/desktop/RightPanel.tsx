"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	FileText,
	Upload,
	BookOpen,
	File as FileIcon,
	Wrench,
} from "lucide-react";
import McpPanel from "./McpPanel";

type Tab = "knowledge" | "files" | "notes" | "tools";

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
	{ id: "knowledge", label: "Knowledge", icon: BookOpen },
	{ id: "files", label: "Files", icon: FileText },
	{ id: "notes", label: "Notes", icon: FileIcon },
	{ id: "tools", label: "Tools", icon: Wrench },
];

export default function RightPanel({
	open = true,
}: {
	/** Whether the panel is visible (desktop toggle) */
	open?: boolean;
}) {
	const [activeTab, setActiveTab] = useState<Tab>("knowledge");

	return (
		<aside
			className={cn(
				"flex flex-col h-full bg-[#212121] border-l border-border",
				!open && "hidden",
			)}
		>
			{/* Tabs */}
			<div className="flex border-b border-border shrink-0">
				{TABS.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex items-center gap-1.5 flex-1 px-2 py-2.5 text-xs font-medium transition-colors relative",
								isActive
									? "text-accent"
									: "text-text-tertiary hover:text-text-secondary",
							)}
						>
							<Icon className="h-3.5 w-3.5" />
							<span className="truncate">{tab.label}</span>
							{isActive && (
								<span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
							)}
						</button>
					);
				})}
			</div>

			{/* Content area */}
			<div className="flex-1 overflow-y-auto">
				{activeTab === "knowledge" && <KnowledgeTab />}
				{activeTab === "files" && <FilesTab />}
				{activeTab === "notes" && <NotesTab />}
				{activeTab === "tools" && <ToolsTab />}
			</div>
		</aside>
	);
}

function KnowledgeTab() {
	return (
		<div className="flex flex-col items-center justify-center h-full px-6 text-center">
			<div className="mb-4 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
				<BookOpen className="h-6 w-6 text-accent/60" />
			</div>
			<h3 className="text-sm font-semibold text-text-primary mb-1">
				Knowledge Base
			</h3>
			<p className="text-xs text-text-tertiary leading-relaxed mb-4">
				Add files to your knowledge base to give the assistant context about
				your project.
			</p>

			{/* Drag-and-drop zone (visual only) */}
			<div className="w-full border-2 border-dashed border-border rounded-lg px-4 py-6 transition-colors hover:border-accent/30 hover:bg-accent-light/30 cursor-default">
				<Upload className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
				<p className="text-xs text-text-tertiary">Drag & drop files here</p>
				<p className="text-[10px] text-text-tertiary/60 mt-1">
					or click to browse
				</p>
			</div>

			<p className="text-[10px] text-text-tertiary/50 mt-4">
				Coming soon — Phase 2
			</p>
		</div>
	);
}

function FilesTab() {
	return (
		<div className="flex flex-col items-center justify-center h-full px-6 text-center">
			<div className="mb-4 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
				<FileText className="h-6 w-6 text-accent/60" />
			</div>
			<h3 className="text-sm font-semibold text-text-primary mb-1">Files</h3>
			<p className="text-xs text-text-tertiary leading-relaxed">
				Attach text, code, or markdown files directly in the chat input.
			</p>
			<p className="text-[10px] text-text-tertiary/50 mt-4">
				Use the paperclip button or drag & drop files into the chat.
			</p>
		</div>
	);
}

function NotesTab() {
	return (
		<div className="flex flex-col items-center justify-center h-full px-6 text-center">
			<div className="mb-4 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
				<FileIcon className="h-6 w-6 text-accent/60" />
			</div>
			<h3 className="text-sm font-semibold text-text-primary mb-1">Notes</h3>
			<p className="text-xs text-text-tertiary leading-relaxed">
				Your session notes will be synced here.
			</p>
			<p className="text-[10px] text-text-tertiary/50 mt-4">
				Coming soon — Phase 2
			</p>
		</div>
	);
}

function ToolsTab() {
	return <McpPanel />;
}
