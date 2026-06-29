"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";

const CUSTOM_INSTRUCTIONS_MAX_LENGTH = 2000;

export default function SettingsPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const { user } = useUser();

	const [exportStatus, setExportStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [deleteStatus, setDeleteStatus] = useState<
		"idle" | "confirming" | "loading" | "success" | "error"
	>("idle");
	const [deleteResult, setDeleteResult] = useState<string>("");

	// ── Memory state ───────────────────────────────────────────────────
	const [extractionEnabled, setExtractionEnabled] = useState(() => {
		if (typeof window === "undefined") return true;
		try {
			return localStorage.getItem("flow_auto_extraction") !== "false";
		} catch {
			return true;
		}
	});
	const [memDeleteConfirm, setMemDeleteConfirm] = useState(false);
	const [memDeleting, setMemDeleting] = useState(false);
	const [memDeleteSuccess, setMemDeleteSuccess] = useState(false);

	const handleDeleteAllMemories = useCallback(async () => {
		setMemDeleting(true);
		try {
			// Delete all memory facts by fetching them and deleting each one
			const res = await fetch("/api/memory/facts?limit=100&offset=0");
			if (!res.ok) throw new Error("Failed to load memory facts");
			const data = await res.json();
			const facts: Array<{ id: string }> = data.facts || [];
			let deleted = 0;
			for (const fact of facts) {
				const delRes = await fetch(`/api/memory/facts/${fact.id}`, {
					method: "DELETE",
				});
				if (delRes.ok) deleted++;
			}
			setMemDeleteConfirm(false);
			setMemDeleteSuccess(true);
			// Reset after 3 seconds
			setTimeout(() => {
				setMemDeleteSuccess(false);
			}, 3000);
		} catch {
			// Keep confirming state so user can retry
			setMemDeleting(false);
		}
	}, []);

	// ── Custom Instructions state ───────────────────────────────────
	const [aboutYou, setAboutYou] = useState("");
	const [howToRespond, setHowToRespond] = useState("");
	const [instructionsLoaded, setInstructionsLoaded] = useState(false);
	const [instructionsSaveStatus, setInstructionsSaveStatus] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [instructionsError, setInstructionsError] = useState("");

	// Load existing instructions
	useEffect(() => {
		if (!isSignedIn) return;
		setInstructionsLoaded(false);
		fetch("/api/settings/instructions")
			.then((res) => {
				if (!res.ok) throw new Error("Failed to load");
				return res.json();
			})
			.then((data) => {
				setAboutYou(data.aboutYou ?? "");
				setHowToRespond(data.howToRespond ?? "");
				setInstructionsLoaded(true);
			})
			.catch(() => {
				// Don't block the UI — user can still type and save
				setInstructionsLoaded(true);
			});
	}, [isSignedIn]);

	const handleSaveInstructions = useCallback(async () => {
		setInstructionsSaveStatus("saving");
		setInstructionsError("");
		try {
			const res = await fetch("/api/settings/instructions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ aboutYou, howToRespond }),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || "Failed to save instructions");
			}
			const data = await res.json();
			setAboutYou(data.aboutYou ?? "");
			setHowToRespond(data.howToRespond ?? "");
			setInstructionsSaveStatus("saved");
			setTimeout(() => setInstructionsSaveStatus("idle"), 2500);
		} catch (err: any) {
			setInstructionsError(err.message || "Something went wrong.");
			setInstructionsSaveStatus("error");
		}
	}, [aboutYou, howToRespond]);

	const handleClearInstructions = useCallback(() => {
		setAboutYou("");
		setHowToRespond("");
	}, []);

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
					Settings
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
					Settings
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					Sign in to manage your account and data.
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

	const displayName =
		user?.firstName && user?.lastName
			? `${user.firstName} ${user.lastName}`
			: user?.firstName ||
				user?.primaryEmailAddress?.emailAddress ||
				"Flow User";

	const email = user?.primaryEmailAddress?.emailAddress || "";

	const handleExport = async () => {
		setExportStatus("loading");
		try {
			const res = await fetch("/api/account/export");
			if (!res.ok) throw new Error("Export failed");
			const data = await res.json();
			const blob = new Blob([JSON.stringify(data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `flow-export-${new Date().toISOString().split("T")[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);
			setExportStatus("success");
			setTimeout(() => setExportStatus("idle"), 3000);
		} catch {
			setExportStatus("error");
			setTimeout(() => setExportStatus("idle"), 3000);
		}
	};

	const handleDeleteAll = async () => {
		if (deleteStatus !== "confirming") {
			setDeleteStatus("confirming");
			return;
		}
		setDeleteStatus("loading");
		try {
			const res = await fetch("/api/account/chats", { method: "DELETE" });
			if (!res.ok) throw new Error("Delete failed");
			const data = await res.json();
			setDeleteResult(
				`Deleted ${data.count} conversation${data.count === 1 ? "" : "s"}.`,
			);
			setDeleteStatus("success");
		} catch {
			setDeleteStatus("error");
			setDeleteResult("Failed to delete chats. Please try again.");
		}
	};

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
							Settings
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

			{/* Content */}
			<main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
				{/* Account Section */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Account
					</h2>
					<div className="space-y-3 text-sm">
						<div>
							<span className="text-text-tertiary">Name: </span>
							<span className="text-text-primary">{displayName}</span>
						</div>
						{email && (
							<div>
								<span className="text-text-tertiary">Email: </span>
								<span className="text-text-primary">{email}</span>
							</div>
						)}
					</div>
					<p className="text-xs text-text-tertiary mt-3">
						Account managed via Clerk. To change email or password, visit{" "}
						<a
							href="https://accounts.clerk.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-accent hover:text-accent-hover underline"
						>
							Clerk Account
						</a>
						.
					</p>
				</section>

				{/* Custom Instructions Section */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Custom Instructions
					</h2>
					<p className="text-sm text-text-secondary mb-5 leading-relaxed">
						Tell Flow about yourself and how you&apos;d like it to respond.
						These instructions are included with every conversation so the model
						can personalise its replies.
					</p>

					<div className="space-y-5">
						{/* About You */}
						<div>
							<label
								htmlFor="about-you"
								className="block text-sm font-medium text-text-primary mb-1.5"
							>
								What should Flow know about you?
							</label>
							<p className="text-xs text-text-tertiary mb-2">
								Share context that helps the model understand you — your role,
								goals, preferences, or any relevant background.
							</p>
							<Textarea
								id="about-you"
								placeholder="e.g. I'm a product manager working on developer tools. I prefer concise, actionable advice."
								value={aboutYou}
								onChange={(e) => setAboutYou(e.target.value)}
								className="min-h-[100px]"
								maxLength={CUSTOM_INSTRUCTIONS_MAX_LENGTH}
							/>
							<div className="flex justify-end mt-1">
								<span
									className={`text-xs ${
										aboutYou.length > CUSTOM_INSTRUCTIONS_MAX_LENGTH * 0.9
											? "text-amber-500"
											: "text-text-tertiary"
									}`}
								>
									{aboutYou.length}/{CUSTOM_INSTRUCTIONS_MAX_LENGTH}
								</span>
							</div>
						</div>

						{/* How to Respond */}
						<div>
							<label
								htmlFor="how-to-respond"
								className="block text-sm font-medium text-text-primary mb-1.5"
							>
								How should Flow respond?
							</label>
							<p className="text-xs text-text-tertiary mb-2">
								Describe tone, style, format preferences, or any specific
								instructions for the model&apos;s responses.
							</p>
							<Textarea
								id="how-to-respond"
								placeholder="e.g. Use a friendly but professional tone. Provide clear explanations with examples when possible."
								value={howToRespond}
								onChange={(e) => setHowToRespond(e.target.value)}
								className="min-h-[100px]"
								maxLength={CUSTOM_INSTRUCTIONS_MAX_LENGTH}
							/>
							<div className="flex justify-end mt-1">
								<span
									className={`text-xs ${
										howToRespond.length > CUSTOM_INSTRUCTIONS_MAX_LENGTH * 0.9
											? "text-amber-500"
											: "text-text-tertiary"
									}`}
								>
									{howToRespond.length}/{CUSTOM_INSTRUCTIONS_MAX_LENGTH}
								</span>
							</div>
						</div>
					</div>

					{/* Secret warning */}
					<div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
						<p className="text-xs text-yellow-400">
							⚠️ Don&apos;t store passwords, API keys, or other secrets in custom
							instructions. These are included in every conversation and treated
							as system-visible data.
						</p>
					</div>

					{/* Save / Clear actions */}
					<div className="mt-5 flex items-center gap-3">
						<Button
							variant="default"
							size="sm"
							onClick={handleSaveInstructions}
							disabled={
								instructionsSaveStatus === "saving" || !instructionsLoaded
							}
						>
							{instructionsSaveStatus === "saving"
								? "Saving…"
								: instructionsSaveStatus === "saved"
									? "Saved ✓"
									: "Save"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearInstructions}
							disabled={instructionsSaveStatus === "saving"}
						>
							Clear
						</Button>
						{instructionsSaveStatus === "error" && (
							<span className="text-xs text-red-500">
								{instructionsError || "Failed to save."}
							</span>
						)}
					</div>
				</section>

				{/* Memory Section */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Memory
					</h2>
					<div className="space-y-4">
						{/* Auto-extraction toggle */}
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Automatic memory extraction
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									Flow will automatically extract facts and preferences from
									your conversations.
								</p>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={extractionEnabled}
									onChange={(e) => {
										setExtractionEnabled(e.target.checked);
										localStorage.setItem(
											"flow_auto_extraction",
											e.target.checked ? "true" : "false",
										);
									}}
									className="sr-only peer"
								/>
								<div className="w-9 h-5 bg-surface-hover rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
							</label>
						</div>

						{/* Manage memories link */}
						<div className="flex items-center justify-between gap-4 pt-2 border-t border-border-light">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Manage memories
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									View and edit your memory facts and session summaries.
								</p>
							</div>
							<Link
								href="/memory"
								className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-accent/10 border border-accent/20 text-xs font-medium text-accent hover:bg-accent/20 transition-colors shrink-0"
							>
								View memory
							</Link>
						</div>

						{/* Delete all memories */}
						<div className="flex items-center justify-between gap-4 pt-2 border-t border-border-light">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Delete all memories
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									Permanently delete all memory facts. Session summaries are not
									affected.
								</p>
							</div>
							{memDeleteConfirm ? (
								<div className="flex items-center gap-2 shrink-0">
									<button
										onClick={() => setMemDeleteConfirm(false)}
										className="h-7 px-2 rounded border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
									>
										Cancel
									</button>
									<button
										onClick={handleDeleteAllMemories}
										disabled={memDeleting}
										className="h-7 px-2 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
									>
										{memDeleting ? "Deleting…" : "Confirm"}
									</button>
								</div>
							) : (
								<button
									onClick={() => setMemDeleteConfirm(true)}
									disabled={memDeleting || memDeleteSuccess}
									className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
								>
									{memDeleting
										? "Deleting…"
										: memDeleteSuccess
											? "Deleted ✓"
											: "Delete all"}
								</button>
							)}
						</div>
					</div>
				</section>

				{/* Data Saved by Flow */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Data saved by Flow
					</h2>
					<ul className="space-y-2 text-sm text-text-secondary">
						<li className="flex items-center gap-2">
							<span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
							Chat history (messages and conversations)
						</li>
						<li className="flex items-center gap-2">
							<span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
							Session summaries (what Flow remembers about your conversations)
						</li>
						<li className="flex items-center gap-2">
							<span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
							Usage records (tokens and API costs)
						</li>
					</ul>
				</section>

				{/* Privacy Note */}
				<section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-2">
						Privacy note
					</h2>
					<p className="text-sm text-text-secondary leading-relaxed">
						Don&apos;t paste passwords, API keys, or private secrets into your
						conversations. Flow stores chat history and session summaries to
						improve your experience, but treat all shared data as visible to the
						system. Sensitive information should be kept outside of this
						platform.
					</p>
				</section>

				{/* Links */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Quick links
					</h2>
					<div className="flex flex-wrap gap-3">
						<Link
							href="/memory"
							className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-accent/10 border border-accent/20 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
						>
							View memory
						</Link>
						<Link
							href="/chat"
							className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
						>
							Back to chat
						</Link>
					</div>
				</section>

				{/* Data Actions */}
				<section className="rounded-2xl border border-border bg-surface p-6">
					<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
						Data actions
					</h2>
					<div className="space-y-4">
						{/* Export */}
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Export my data
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									Download all your conversations and usage data as JSON.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExport}
								disabled={exportStatus === "loading"}
								className="shrink-0"
							>
								{exportStatus === "loading"
									? "Exporting…"
									: exportStatus === "success"
										? "Exported ✓"
										: "Export"}
							</Button>
						</div>

						{/* Delete all chats */}
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Delete all chats
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									Soft-delete all conversations. Data can be recovered by
									contacting support within 30 days.
								</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{deleteStatus === "success" && (
									<span className="text-xs text-green-500">{deleteResult}</span>
								)}
								{deleteStatus === "error" && (
									<span className="text-xs text-red-500">{deleteResult}</span>
								)}
								{deleteStatus === "confirming" ? (
									<>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setDeleteStatus("idle")}
										>
											Cancel
										</Button>
										<Button
											variant="default"
											size="sm"
											onClick={handleDeleteAll}
											className="bg-red-600 hover:bg-red-700 text-white"
										>
											Confirm
										</Button>
									</>
								) : (
									<Button
										variant="outline"
										size="sm"
										onClick={handleDeleteAll}
										disabled={
											deleteStatus === "loading" || deleteStatus === "success"
										}
										className="border-red-500/30 text-red-400 hover:bg-red-500/10"
									>
										{deleteStatus === "loading" ? "Deleting…" : "Delete all"}
									</Button>
								)}
							</div>
						</div>

						{/* Delete account (placeholder) */}
						<div className="flex items-center justify-between gap-4 opacity-50">
							<div>
								<p className="text-sm font-medium text-text-primary">
									Delete account
								</p>
								<p className="text-xs text-text-tertiary mt-0.5">
									Permanently delete your account and all data. Not available in
									this beta.
								</p>
							</div>
							<Button variant="outline" size="sm" disabled className="shrink-0">
								Coming soon
							</Button>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
