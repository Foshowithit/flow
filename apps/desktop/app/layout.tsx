import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const BASE_URL =
	process.env.NEXT_PUBLIC_SITE_URL ||
	process.env.NEXT_PUBLIC_APP_URL ||
	"http://localhost:3000";
export const metadata: Metadata = {
	metadataBase: new URL(BASE_URL),
	title: "Flow — Private Beta AI Assistant",
	description:
		"A private-beta AI chat app with account sign-in, conversation history, and a clean interface. Built by Adam & Chow.",
	openGraph: {
		title: "Flow — Private Beta AI Assistant",
		description:
			"A private-beta AI chat app with account sign-in, conversation history, and a clean interface. Built by Adam & Chow.",
		images: [{ url: "/flow-logo-dark.png", width: 512, height: 512 }],
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Flow",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#1a1a1a" },
		{ media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
	],
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider>
			<html lang="en">
				<head>
					<link rel="manifest" href="/manifest.json" />
					<link rel="apple-touch-icon" href="/flow-icon-192.png" />
				</head>
				<body>{children}</body>
			</html>
		</ClerkProvider>
	);
}
