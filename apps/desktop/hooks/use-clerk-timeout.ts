"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";

/**
 * Wraps Clerk's useAuth with a timeout fallback.
 * If Clerk fails to initialize within `timeoutMs` (default 10s),
 * returns isLoaded=true and timedOut=true so the UI can show a
 * meaningful fallback instead of spinning indefinitely.
 */
export function useClerkAuthTimeout(timeoutMs = 10_000) {
	const clerk = useAuth();
	const [timedOut, setTimedOut] = useState(false);
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		const timer = setTimeout(() => {
			if (!clerk.isLoaded) {
				setTimedOut(true);
			}
		}, timeoutMs);

		return () => clearTimeout(timer);
	}, [clerk.isLoaded, timeoutMs]);

	return {
		...clerk,
		isLoaded: clerk.isLoaded || timedOut,
		timedOut,
	};
}

/**
 * Wraps Clerk's useUser with a timeout fallback.
 */
export function useClerkUserTimeout(timeoutMs = 10_000) {
	const clerk = useUser();
	const [timedOut, setTimedOut] = useState(false);
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		const timer = setTimeout(() => {
			if (!clerk.isLoaded) {
				setTimedOut(true);
			}
		}, timeoutMs);

		return () => clearTimeout(timer);
	}, [clerk.isLoaded, timeoutMs]);

	return {
		...clerk,
		isLoaded: clerk.isLoaded || timedOut,
		timedOut,
	};
}
