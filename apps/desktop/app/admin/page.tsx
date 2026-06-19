"use client";

import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClerkAuthTimeout } from "@/hooks/use-clerk-timeout";

// ─── Types ────────────────────────────────────────────────────────────────

interface AdminUser {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	role: string;
	beta_status: string;
	created_at: string;
	deleted_at: string | null;
	session_count: number;
	message_count: number;
	usage_count: number;
	total_cost_cents: number;
}

interface UsageDaily {
	day: string;
	model: string;
	request_count: number;
	tokens_in: number;
	tokens_out: number;
	cost_cents: number;
}

interface UsageTotals {
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	total_cost_cents: number;
}

interface AdminHealth {
	status: string;
	timestamp: string;
	app: string;
	db: boolean | null;
	mockChat: boolean;
	aiConfigured: boolean;
	clerkWebhookSecret: boolean;
	envFlags: Record<string, boolean>;
}

type Section = "users" | "usage" | "health";

// ─── Page Component ───────────────────────────────────────────────────────

export default function AdminPage() {
	const { isSignedIn, isLoaded, timedOut } = useClerkAuthTimeout(8000);
	const [authCheckDone, setAuthCheckDone] = useState(false);
	const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
	const [section, setSection] = useState<Section>("users");

	// Data state
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [usageData, setUsageData] = useState<{
		daily: UsageDaily[];
		totals: UsageTotals;
	} | null>(null);
	const [health, setHealth] = useState<AdminHealth | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Check admin status on mount (when signed in)
	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) {
			setAuthCheckDone(true);
			setIsAdmin(false);
			return;
		}
		// Try fetching admin data — 403 means not admin
		setLoading(true);
		fetch("/api/admin/health")
			.then((res) => {
				if (res.ok) {
					setIsAdmin(true);
				} else if (res.status === 403) {
					setIsAdmin(false);
				} else {
					// 401 or other — treat as not admin
					setIsAdmin(false);
				}
			})
			.catch(() => {
				setIsAdmin(false);
			})
			.finally(() => {
				setAuthCheckDone(true);
				setLoading(false);
			});
	}, [isSignedIn, isLoaded]);

	// Fetch data when admin confirmed
	useEffect(() => {
		if (isAdmin !== true) return;

		const fetchSection = async () => {
			setLoading(true);
			setError(null);
			try {
				if (section === "users") {
					const res = await fetch("/api/admin/users");
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					setUsers(data);
				} else if (section === "usage") {
					const res = await fetch("/api/admin/usage");
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					setUsageData(data);
				} else if (section === "health") {
					const res = await fetch("/api/admin/health");
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					setHealth(data);
				}
			} catch (err: any) {
				setError(err.message || "Failed to load data");
			} finally {
				setLoading(false);
			}
		};

		fetchSection();
	}, [isAdmin, section]);

	// ── Loading state ──────────────────────────────────────────────────
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
					Admin
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

	// ── Signed-out state ───────────────────────────────────────────────
	if (!isSignedIn) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Admin
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					Sign in to access the admin panel.
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

	// ── Not admin state ────────────────────────────────────────────────
	if (authCheckDone && isAdmin === false) {
		return (
			<div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
					Admin
				</h1>
				<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
					You do not have admin access.
				</p>
				<Link
					href="/"
					className="text-sm text-text-secondary hover:text-text-primary transition-colors"
				>
					Back to home
				</Link>
			</div>
		);
	}

	// ── Admin panel ────────────────────────────────────────────────────
	return (
		<div className="min-h-dvh bg-background">
			{/* Header */}
			<header className="border-b border-border bg-surface/80 backdrop-blur-sm">
				<div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="text-sm font-semibold text-accent tracking-tight hover:text-accent-hover transition-colors"
						>
							Flow
						</Link>
						<span className="text-sm text-text-secondary">/</span>
						<h1 className="text-sm font-semibold text-text-primary tracking-tight">
							Admin
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

			{/* Tab nav */}
			<div className="border-b border-border">
				<div className="max-w-5xl mx-auto px-6 flex gap-6">
					{(
						[
							{ id: "users" as Section, label: "Users" },
							{ id: "usage" as Section, label: "Usage" },
							{ id: "health" as Section, label: "Health" },
						] as const
					).map((tab) => (
						<button
							key={tab.id}
							onClick={() => setSection(tab.id)}
							className={`py-3 text-sm font-medium border-b-2 transition-colors ${
								section === tab.id
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
			<main className="max-w-5xl mx-auto px-6 py-8">
				{loading && <p className="text-sm text-text-secondary">Loading…</p>}
				{error && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-6">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{!loading && !error && section === "users" && users && (
					<UsersSection users={users} />
				)}
				{!loading && !error && section === "usage" && usageData && (
					<UsageSection data={usageData} />
				)}
				{!loading && !error && section === "health" && health && (
					<HealthSection health={health} />
				)}
			</main>
		</div>
	);
}

// ─── Users Section ────────────────────────────────────────────────────────

function UsersSection({ users }: { users: AdminUser[] }) {
	if (users.length === 0) {
		return (
			<div className="rounded-2xl border border-border bg-surface p-6 text-center">
				<p className="text-sm text-text-secondary">No users found.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-2xl border border-border">
			<table className="w-full text-sm">
				<thead>
					<tr className="bg-surface-hover border-b border-border">
						<th className="text-left px-4 py-3 font-medium text-text-secondary">
							Email / Name
						</th>
						<th className="text-left px-4 py-3 font-medium text-text-secondary">
							Role
						</th>
						<th className="text-left px-4 py-3 font-medium text-text-secondary">
							Beta
						</th>
						<th className="text-left px-4 py-3 font-medium text-text-secondary">
							Created
						</th>
						<th className="text-right px-4 py-3 font-medium text-text-secondary">
							Sessions
						</th>
						<th className="text-right px-4 py-3 font-medium text-text-secondary">
							Messages
						</th>
						<th className="text-right px-4 py-3 font-medium text-text-secondary">
							Usage
						</th>
						<th className="text-right px-4 py-3 font-medium text-text-secondary">
							Cost
						</th>
					</tr>
				</thead>
				<tbody>
					{users.map((u) => (
						<tr
							key={u.id}
							className="border-b border-border last:border-b-0 hover:bg-surface/50"
						>
							<td className="px-4 py-3 text-text-primary">
								<div>{u.email}</div>
								{u.first_name && (
									<div className="text-xs text-text-tertiary">
										{u.first_name} {u.last_name}
									</div>
								)}
							</td>
							<td className="px-4 py-3">
								<span
									className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
										u.role === "admin"
											? "bg-accent/10 text-accent"
											: "bg-surface-hover text-text-secondary"
									}`}
								>
									{u.role}
								</span>
							</td>
							<td className="px-4 py-3 text-text-secondary">
								{u.deleted_at ? (
									<span className="text-red-400">deleted</span>
								) : (
									u.beta_status
								)}
							</td>
							<td className="px-4 py-3 text-text-secondary whitespace-nowrap">
								{new Date(u.created_at).toLocaleDateString()}
							</td>
							<td className="px-4 py-3 text-right text-text-primary">
								{u.session_count}
							</td>
							<td className="px-4 py-3 text-right text-text-primary">
								{u.message_count}
							</td>
							<td className="px-4 py-3 text-right text-text-primary">
								{u.usage_count}
							</td>
							<td className="px-4 py-3 text-right text-text-primary">
								${(u.total_cost_cents / 100).toFixed(2)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ─── Usage Section ────────────────────────────────────────────────────────

function UsageSection({
	data,
}: {
	data: { daily: UsageDaily[]; totals: UsageTotals };
}) {
	const { totals, daily } = data;
	return (
		<div className="space-y-6">
			{/* Totals card */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<StatCard label="Total Requests" value={totals.total_requests} />
				<StatCard label="Total Tokens In" value={totals.total_tokens_in} />
				<StatCard label="Total Tokens Out" value={totals.total_tokens_out} />
				<StatCard
					label="Total Cost"
					value={`$${(totals.total_cost_cents / 100).toFixed(2)}`}
				/>
			</div>

			{/* Daily breakdown */}
			{daily.length === 0 ? (
				<div className="rounded-2xl border border-border bg-surface p-6 text-center">
					<p className="text-sm text-text-secondary">No usage records yet.</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-surface-hover border-b border-border">
								<th className="text-left px-4 py-3 font-medium text-text-secondary">
									Day
								</th>
								<th className="text-left px-4 py-3 font-medium text-text-secondary">
									Model
								</th>
								<th className="text-right px-4 py-3 font-medium text-text-secondary">
									Requests
								</th>
								<th className="text-right px-4 py-3 font-medium text-text-secondary">
									Tokens In
								</th>
								<th className="text-right px-4 py-3 font-medium text-text-secondary">
									Tokens Out
								</th>
								<th className="text-right px-4 py-3 font-medium text-text-secondary">
									Cost
								</th>
							</tr>
						</thead>
						<tbody>
							{daily.map((row, i) => (
								<tr
									key={`${row.day}-${row.model}-${i}`}
									className="border-b border-border last:border-b-0 hover:bg-surface/50"
								>
									<td className="px-4 py-3 text-text-primary">{row.day}</td>
									<td className="px-4 py-3 text-text-secondary">{row.model}</td>
									<td className="px-4 py-3 text-right text-text-primary">
										{row.request_count}
									</td>
									<td className="px-4 py-3 text-right text-text-primary">
										{row.tokens_in.toLocaleString()}
									</td>
									<td className="px-4 py-3 text-right text-text-primary">
										{row.tokens_out.toLocaleString()}
									</td>
									<td className="px-4 py-3 text-right text-text-primary">
										${(row.cost_cents / 100).toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// ─── Health Section ───────────────────────────────────────────────────────

function HealthSection({ health }: { health: AdminHealth }) {
	return (
		<div className="space-y-6">
			{/* Status card */}
			<div className="rounded-2xl border border-border bg-surface p-6">
				<div className="flex items-center gap-2 mb-4">
					<span
						className={`h-2.5 w-2.5 rounded-full ${
							health.db === true ? "bg-green-500" : "bg-red-500"
						}`}
					/>
					<span className="text-sm font-semibold text-text-primary">
						{health.db === true ? "Healthy" : "Degraded"}
					</span>
					<span className="text-xs text-text-tertiary ml-auto">
						{health.timestamp}
					</span>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
					<HealthItem label="App" value={health.app} />
					<HealthItem
						label="Database"
						value={health.db === true ? "connected" : "disconnected"}
					/>
					<HealthItem
						label="Mock Chat"
						value={health.mockChat ? "enabled" : "disabled"}
					/>
					<HealthItem
						label="AI Configured"
						value={health.aiConfigured ? "yes" : "no"}
					/>
					<HealthItem
						label="Clerk Webhook Secret"
						value={health.clerkWebhookSecret ? "present" : "missing"}
					/>
				</div>
			</div>

			{/* Env flags */}
			<div className="rounded-2xl border border-border bg-surface p-6">
				<h2 className="text-base font-semibold tracking-tight text-text-primary mb-4">
					Environment Variables
				</h2>
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
					{Object.entries(health.envFlags).map(([key, present]) => (
						<div
							key={key}
							className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border"
						>
							<span
								className={`h-2 w-2 rounded-full ${
									present ? "bg-green-500" : "bg-red-500"
								}`}
							/>
							<span className="text-text-secondary font-mono text-xs">
								{key}
							</span>
							<span className="ml-auto text-xs text-text-tertiary">
								{present ? "set" : "missing"}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Sub-components ───────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="rounded-2xl border border-border bg-surface p-4">
			<p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
				{label}
			</p>
			<p className="text-xl font-semibold text-text-primary">{value}</p>
		</div>
	);
}

function HealthItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="px-3 py-2 rounded-lg bg-background border border-border">
			<p className="text-xs text-text-tertiary">{label}</p>
			<p className="text-sm font-medium text-text-primary">{value}</p>
		</div>
	);
}
