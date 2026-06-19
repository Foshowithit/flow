"use client";

import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function DesktopLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider>
			<div
				className={`${inter.className} h-dvh w-screen overflow-hidden bg-background`}
			>
				{children}
			</div>
		</ClerkProvider>
	);
}
