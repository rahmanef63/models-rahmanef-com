"use client";
import { useEffect, useRef, useState } from "react";
import { deviceLoginSession } from "../lib/device-login";

type Start = () => Promise<{ verificationUrl: string; userCode: string; intervalMs: number }>;
export function useDeviceLogin(start: Start, poll: () => Promise<{ status: string }>, label: string, onBanner: (message: string) => void) {
  const [flow, setFlow] = useState<{ url: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => { stop.current?.(); stop.current = null; }, []);
  function cancel() { stop.current?.(); stop.current = null; setFlow(null); setBusy(false); }
  function connect() {
    if (stop.current) return;
    setBusy(true); onBanner("");
    stop.current = deviceLoginSession(start, poll, {
      onFlow: ({ verificationUrl, userCode }) => setFlow({ url: verificationUrl, code: userCode }),
      onDone: (status) => { cancel(); onBanner(status === "done" ? `✓ ${label} sign-in saved — model access not tested.` : "⚠ Login expired or declined — try again."); },
      onError: () => { cancel(); onBanner("⚠ Sign-in failed. Try again."); },
    });
  }
  return { flow, busy, connect, cancel };
}
