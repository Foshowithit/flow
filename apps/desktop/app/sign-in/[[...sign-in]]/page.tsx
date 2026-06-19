"use client";

import {
	SignIn,
	ClerkLoading,
	ClerkLoaded,
	ClerkFailed,
	ClerkDegraded,
} from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SignInPage() {
	const [timedOut, setTimedOut] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setTimedOut(true), 12_000);
		return () => clearTimeout(timer);
	}, []);

	// ── Hard timeout fallback (Clerk never mounted) ────────────────────
	if (timedOut) {
		return (
			<div className="min-h-dvh w-screen flex items-center justify-center bg-[#1a1a1a] px-4">
				<div className="w-full max-w-sm">
					<div className="mb-8 text-center">
						<span
							className="text-[11px] font-semibold uppercase tracking-[0.14em]"
							style={{ color: "#20b8cd" }}
						>
							Flow
						</span>
						<h1 className="text-xl font-bold text-[#f5f5f5] tracking-tight mt-2">
							Welcome back
						</h1>
						<p className="text-sm text-[#c8c8d0] mt-1">
							Sign in to your account
						</p>
					</div>
					<div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-5 py-6 text-center">
						<p className="text-sm text-yellow-400 mb-3">
							Authentication is taking longer than expected. Sign in may be
							temporarily unavailable.
						</p>
						<div className="flex gap-3 justify-center">
							<Link
								href="/"
								className="text-sm text-[#20b8cd] hover:text-[#1ba8bb] transition-colors"
							>
								Home
							</Link>
							<Link
								href="/chat"
								className="text-sm text-[#20b8cd] hover:text-[#1ba8bb] transition-colors"
							>
								Chat
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-dvh w-screen flex items-center justify-center bg-[#1a1a1a] px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<span
						className="text-[11px] font-semibold uppercase tracking-[0.14em]"
						style={{ color: "#20b8cd" }}
					>
						Flow
					</span>
					<h1 className="text-xl font-bold text-[#f5f5f5] tracking-tight mt-2">
						Welcome back
					</h1>
					<p className="text-sm text-[#c8c8d0] mt-1">Sign in to your account</p>
				</div>

				{/* Clerk loading state */}
				<ClerkLoading>
					<div className="flex flex-col items-center gap-4 py-12">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-[#20b8cd] border-t-transparent" />
						<p className="text-sm text-[#c8c8d0]">Loading sign-in…</p>
					</div>
				</ClerkLoading>

				{/* Clerk failed state (missing/invalid key) */}
				<ClerkFailed>
					<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-6 text-center">
						<p className="text-sm text-red-400 mb-3">
							Authentication is temporarily unavailable.
						</p>
						<Link
							href="/"
							className="text-sm text-[#20b8cd] hover:text-[#1ba8bb] transition-colors"
						>
							Back to home
						</Link>
					</div>
				</ClerkFailed>

				{/* Clerk loaded — render sign-in form */}
				<ClerkLoaded>
					<SignIn
						forceRedirectUrl="/chat"
						signUpUrl="/sign-up"
						appearance={{
							baseTheme: dark,
							elements: {
								rootBox: "w-full",
								card: "bg-[#242424] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-none",
								headerTitle:
									"text-[#f5f5f5] text-lg font-semibold tracking-tight",
								headerSubtitle: "text-[#c8c8d0] text-sm",
								socialButtonsBlockButton:
									"bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#f5f5f5] hover:bg-[#3a3a3a] rounded-xl text-sm font-medium",
								socialButtonsBlockButtonText: "text-[#f5f5f5]",
								formButtonPrimary:
									"bg-[#20b8cd] text-black font-semibold text-sm hover:bg-[#1ba8bb] rounded-xl",
								formFieldInput:
									"bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#f5f5f5] rounded-xl text-sm placeholder:text-[#a1a1aa] focus:border-[#20b8cd] focus:ring-2 focus:ring-[rgba(32,184,205,0.2)]",
								formFieldLabel:
									"text-[#c8c8d0] text-xs font-medium uppercase tracking-wider",
								footerActionText: "text-[#c8c8d0] text-sm",
								footerActionLink:
									"text-[#20b8cd] hover:text-[#1ba8bb] text-sm font-medium",
								dividerLine: "bg-[rgba(255,255,255,0.08)]",
								dividerText: "text-[#a1a1aa] text-xs",
								identityPreviewText: "text-[#f5f5f5]",
								identityPreviewEditButton: "text-[#20b8cd]",
								formResendCodeLink: "text-[#20b8cd]",
								otpCodeFieldInput:
									"bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#f5f5f5] rounded-xl focus:border-[#20b8cd]",
								alertText: "text-red-400",
								alert: "bg-red-500/10 border border-red-500/20 rounded-xl",
							},
						}}
					/>
				</ClerkLoaded>

				{/* Degraded / fallback — if Clerk never loads, show this */}
				<ClerkDegraded>
					<div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-5 py-6 text-center">
						<p className="text-sm text-yellow-400 mb-3">
							Sign-in is taking longer than expected. Please try again later.
						</p>
						<Link
							href="/"
							className="text-sm text-[#20b8cd] hover:text-[#1ba8bb] transition-colors"
						>
							Back to home
						</Link>
					</div>
				</ClerkDegraded>
			</div>
		</div>
	);
}
