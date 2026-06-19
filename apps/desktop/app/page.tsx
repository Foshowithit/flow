"use client";

import { useState, type FormEvent } from "react";
import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────

interface WaitlistResponse {
	message?: string;
	error?: string;
}

// ─── Landing Page ────────────────────────────────────────────────

export default function LandingPage() {
	const { isSignedIn } = useAuth();
	const { user } = useUser();

	const [email, setEmail] = useState("");
	const [role, setRole] = useState("");
	const [useCase, setUseCase] = useState("");
	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error" | "duplicate"
	>("idle");
	const [message, setMessage] = useState("");

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!email.trim()) return;

		setStatus("loading");
		setMessage("");

		try {
			const res = await fetch("/api/waitlist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.trim(),
					role: role.trim() || undefined,
					useCase: useCase.trim() || undefined,
				}),
			});

			const data: WaitlistResponse = await res.json();
			if (res.ok) {
				setStatus("success");
				setMessage(data.message || "You're on the list.");
				setEmail("");
				setRole("");
				setUseCase("");
			} else if (res.status === 409) {
				setStatus("duplicate");
				setMessage(data.error || "You're already on the list.");
			} else {
				setStatus("error");
				setMessage(data.error || "Something went wrong.");
			}
		} catch {
			setStatus("error");
			setMessage("Network error. Please try again.");
		}
	};

	return (
		<div className="min-h-dvh w-screen overflow-x-hidden bg-background text-text-primary">
			{/* ─── Nav ─────────────────────────────────────────────────── */}
			<nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md border-b border-border">
				<div className="flex items-center gap-2">
					<Image
						src="/flow-logo-vector.svg"
						alt="Flow"
						width={24}
						height={24}
						className="text-accent"
					/>
					<span className="text-base font-bold tracking-tight text-accent">
						Flow
					</span>
				</div>
				<div className="flex items-center gap-3">
					<Link
						href="/chat"
						className="text-sm text-text-secondary hover:text-text-primary transition-colors"
					>
						Chat
					</Link>
					{isSignedIn ? (
						<Link
							href="/chat"
							className="text-sm font-medium px-3 py-1.5 rounded-lg bg-accent text-black hover:bg-accent-hover transition-colors"
						>
							Go to Chat
						</Link>
					) : (
						<>
							<Link
								href="/sign-in"
								className="text-sm text-text-secondary hover:text-text-primary transition-colors"
							>
								Sign in
							</Link>
							<SignInButton mode="modal">
								<button className="text-sm font-medium px-3 py-1.5 rounded-lg bg-accent text-black hover:bg-accent-hover transition-colors">
									Get Started
								</button>
							</SignInButton>
						</>
					)}
				</div>
			</nav>

			{/* ─── Hero ──────────────────────────────────────────────────── */}
			<section className="gradient-hero pt-28 pb-20 px-6 flex flex-col items-center text-center">
				<div className="max-w-[800px] mx-auto fade-in-up">
					{/* Logo */}
					<div className="flex items-center justify-center gap-3 mb-5">
						<Image
							src="/flow-logo-vector.svg"
							alt="Flow"
							width={48}
							height={48}
							className="text-accent"
						/>
						<span className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
							Flow
						</span>
					</div>
					<p className="text-xs text-text-tertiary tracking-wider mb-6">
						built by{" "}
						<span className="font-semibold text-text-secondary">
							Adam &amp; Chow
						</span>
					</p>

					{/* Headline */}
					<h1 className="text-[clamp(2.35rem,6vw,4.25rem)] font-bold leading-[1.1] tracking-tight mb-5">
						<span className="gradient-text">
							An AI assistant for everyday tasks.
						</span>
					</h1>

					{/* Subheadline */}
					<p className="text-base sm:text-lg text-text-secondary max-w-[600px] mx-auto leading-relaxed mb-8">
						Flow is a private-beta AI chat app with account sign-in,
						conversation history, and a clean interface. No extra complexity, no
						integrations (yet) — just a useful assistant built by Adam &amp;
						Chow.
					</p>

					{/* CTA */}
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						{isSignedIn ? (
							<Link
								href="/chat"
								className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all"
							>
								Go to Chat
							</Link>
						) : (
							<>
								<Link
									href="/sign-in"
									className="inline-flex items-center justify-center h-10 px-6 rounded-xl border border-border bg-surface text-text-primary font-medium text-sm hover:bg-surface-hover transition-all"
								>
									Sign in
								</Link>
								<SignInButton mode="modal">
									<button className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all">
										Get Started
									</button>
								</SignInButton>
								<Link
									href="/chat"
									className="inline-flex items-center justify-center h-10 px-6 rounded-xl border border-border bg-surface text-text-primary font-medium text-sm hover:bg-surface-hover transition-all"
								>
									Try the assistant
								</Link>
							</>
						)}
					</div>
				</div>

				{/* ─── Product Preview Card ──────────────────────────────────── */}
				<div className="mt-16 w-full max-w-[680px] fade-in-up stagger-1">
					<div className="rounded-2xl border border-border bg-surface p-5 shadow-lg">
						{/* Mock chat header */}
						<div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
							<Image
								src="/flow-logo-vector.svg"
								alt="Flow"
								width={20}
								height={20}
								className="text-black"
							/>
							<span className="text-xs font-semibold text-text-primary tracking-tight">
								Flow Assistant
							</span>
							<span className="text-[10px] font-medium text-text-secondary ml-auto">
								Just now
							</span>
						</div>

						{/* Mock messages */}
						<div className="space-y-3">
							<div className="flex justify-start">
								<div className="bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-sm leading-relaxed text-text-primary max-w-[85%]">
									What are the key risks with our current deployment strategy?
								</div>
							</div>
							<div className="flex justify-end">
								<div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-2.5 text-sm leading-relaxed text-text-primary max-w-[85%]">
									<div className="font-semibold text-accent text-xs uppercase tracking-wide mb-1">
										Analysis
									</div>
									<p>
										Three main areas to evaluate: (1) no rollback plan for the
										database migration, (2) the canary percentage is too
										aggressive at 40%, and (3) monitoring gaps on the new
										endpoints.
									</p>
									<p className="mt-2">
										Want me to draft a mitigation plan for each?
									</p>
								</div>
							</div>
							<div className="flex justify-start">
								<div className="bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-sm leading-relaxed text-text-primary max-w-[85%]">
									Yes, please. Start with the database rollback.
								</div>
							</div>
						</div>

						{/* Mock input */}
						<div className="mt-4 pt-3 border-t border-border">
							<div className="h-9 rounded-lg bg-background border border-border flex items-center px-3">
								<span className="text-xs text-text-tertiary">
									Ask a follow-up…
								</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ─── Features ────────────────────────────────────────────────── */}
			<section className="py-20 px-6 border-t border-border">
				<div className="max-w-[1000px] mx-auto">
					<h2 className="text-xl font-semibold tracking-tight text-center mb-12">
						Built for real conversations
					</h2>

					<div className="grid md:grid-cols-3 gap-5">
						{/* Feature 1 */}
						<div className="rounded-2xl border border-border bg-surface p-6 fade-in-up stagger-1">
							<div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
								<svg
									className="h-5 w-5 text-accent"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
									/>
								</svg>
							</div>
							<h3 className="text-base font-semibold tracking-tight mb-2">
								Clean chat
							</h3>
							<p className="text-sm text-text-secondary leading-relaxed">
								A straightforward AI chat interface. Ask questions, get answers,
								pick up where you left off.
							</p>
						</div>

						{/* Feature 2 */}
						<div className="rounded-2xl border border-border bg-surface p-6 fade-in-up stagger-2">
							<div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
								<svg
									className="h-5 w-5 text-accent"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<h3 className="text-base font-semibold tracking-tight mb-2">
								Conversation history
							</h3>
							<p className="text-sm text-text-secondary leading-relaxed">
								Signed-in beta users get persistent chat history. Pick up where
								you left off across any session.
							</p>
						</div>

						{/* Feature 3 */}
						<div className="rounded-2xl border border-border bg-surface p-6 fade-in-up stagger-3">
							<div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
								<svg
									className="h-5 w-5 text-accent"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
									/>
								</svg>
							</div>
							<h3 className="text-base font-semibold tracking-tight mb-2">
								Roadmap
							</h3>
							<p className="text-sm text-text-secondary leading-relaxed">
								Integrations and advanced features are on the roadmap for after
								beta. We're building in public.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* ─── Pricing / Access ─────────────────────────────────────────── */}
			<section className="py-20 px-6 border-t border-border" id="signup">
				<div className="max-w-[680px] mx-auto text-center">
					<h2 className="text-xl font-semibold tracking-tight mb-3">
						Private beta
					</h2>
					<p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-[480px] mx-auto">
						We're shipping fast and looking for early testers. Get access and
						help shape what we build.
					</p>

					{/* Pricing card */}
					<div className="rounded-2xl border border-border bg-surface p-8 mb-10 text-left">
						<div className="flex items-baseline gap-1.5 mb-1">
							<span className="text-2xl font-bold tracking-tight">$0</span>
							<span className="text-sm text-text-secondary">/ mo</span>
						</div>
						<p className="text-sm text-text-secondary mb-4">
							During private beta. No surprises.
						</p>
						<ul className="space-y-2 mb-6">
							{[
								"Access to Flow Assistant",
								"AI-powered chat with history",
								"Conversation history across sessions",
								"Direct feedback channel to the team",
								"No credit card required",
							].map((item) => (
								<li
									key={item}
									className="flex items-start gap-2 text-sm text-text-secondary"
								>
									<svg
										className="h-4 w-4 text-accent mt-0.5 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M5 13l4 4L19 7"
										/>
									</svg>
									{item}
								</li>
							))}
						</ul>
					</div>

					{/* Signup / CTA */}
					{isSignedIn ? (
						<div className="rounded-2xl border border-border bg-surface p-8 text-center">
							<h3 className="text-base font-semibold tracking-tight mb-4">
								You're signed in
							</h3>
							<p className="text-sm text-text-secondary mb-6">
								{user?.primaryEmailAddress?.emailAddress || "Ready to go"}
							</p>
							<Link
								href="/chat"
								className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all"
							>
								Go to Chat
							</Link>
						</div>
					) : (
						<div className="rounded-2xl border border-border bg-surface p-8 text-left">
							<h3 className="text-base font-semibold tracking-tight mb-4">
								Request access
							</h3>
							{status === "success" ? (
								<div className="rounded-xl bg-accent/10 border border-accent/20 px-5 py-4">
									<p className="text-sm text-text-primary font-medium">
										{message}
									</p>
									<p className="text-xs text-text-secondary mt-1">
										We'll reach out when we're ready for you.
									</p>
								</div>
							) : (
								<form onSubmit={handleSubmit} className="space-y-4">
									<div>
										<label
											htmlFor="email"
											className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block"
										>
											Email *
										</label>
										<input
											id="email"
											type="email"
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											placeholder="you@example.com"
											className="w-full h-10 px-3.5 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
										/>
									</div>
									<div>
										<label
											htmlFor="role"
											className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block"
										>
											Role
										</label>
										<input
											id="role"
											type="text"
											value={role}
											onChange={(e) => setRole(e.target.value)}
											placeholder="Engineer, PM, founder…"
											className="w-full h-10 px-3.5 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
										/>
									</div>
									<div>
										<label
											htmlFor="useCase"
											className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block"
										>
											What would you use it for?
										</label>
										<textarea
											id="useCase"
											rows={3}
											value={useCase}
											onChange={(e) => setUseCase(e.target.value)}
											placeholder="Tell us about the workflow you want to automate…"
											className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
										/>
									</div>
									{status === "error" && (
										<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
											<p className="text-sm text-red-400">{message}</p>
										</div>
									)}
									{status === "duplicate" && (
										<div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3">
											<p className="text-sm text-text-primary">{message}</p>
										</div>
									)}
									<Button
										type="submit"
										variant="primary"
										disabled={status === "loading"}
										className="w-full h-10 rounded-xl"
									>
										{status === "loading" ? "Sending…" : "Get early access"}
									</Button>
								</form>
							)}
						</div>
					)}
				</div>
			</section>

			{/* ─── Footer ───────────────────────────────────────────────────── */}
			<footer className="border-t border-border py-8 px-6">
				<div className="max-w-[1000px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
					<span className="text-xs text-text-tertiary font-medium">
						Flow — built by Adam &amp; Chow
					</span>
					<div className="flex items-center gap-4">
						<Link
							href="/chat"
							className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
						>
							Chat
						</Link>
						<span className="text-xs text-text-tertiary">
							&copy; {new Date().getFullYear()}
						</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
