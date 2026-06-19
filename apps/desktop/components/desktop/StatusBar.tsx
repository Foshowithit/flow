export default function StatusBar() {
	return (
		<footer className="flex items-center justify-between h-7 px-4 bg-[#1a1a1a] border-t border-border text-[11px] text-text-tertiary shrink-0">
			{/* Left: status */}
			<div className="flex items-center gap-1.5">
				<span className="h-1.5 w-1.5 rounded-full bg-green-500" />
				<span>Ready</span>
			</div>

			{/* Center: model name */}
			<span className="font-medium text-text-secondary">DeepSeek V4 Flash</span>

			{/* Right: connection status */}
			<span className="text-text-tertiary">Connected</span>
		</footer>
	);
}
