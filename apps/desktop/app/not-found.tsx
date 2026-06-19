import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
	return (
		<div className="min-h-dvh w-screen bg-background flex flex-col items-center justify-center px-6 text-center">
			<div className="max-w-[420px]">
				<Image
					src="/flow-logo-vector.svg"
					alt="Flow"
					width={48}
					height={48}
					className="mx-auto mb-6 opacity-60"
				/>
				<h1 className="text-6xl font-bold tracking-tight text-text-primary mb-3">
					404
				</h1>
				<p className="text-base text-text-secondary mb-8 leading-relaxed">
					This page isn&apos;t part of the workflow yet.
				</p>
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Link
						href="/"
						className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all"
					>
						Go home
					</Link>
					<Link
						href="/chat"
						className="inline-flex items-center justify-center h-10 px-6 rounded-xl border border-border bg-surface text-text-primary font-medium text-sm hover:bg-surface-hover transition-all"
					>
						Open chat
					</Link>
				</div>
			</div>
		</div>
	);
}
