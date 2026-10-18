type Flow = { verificationUrl: string; userCode: string; intervalMs: number };
type Callbacks = { onFlow: (flow: Flow) => void; onDone: (status: string) => void; onError: () => void };

// Serial polling with a cancellation generation: late start/poll replies cannot revive a flow.
export function deviceLoginSession(
  start: () => Promise<Flow>, poll: () => Promise<{ status: string }>, callbacks: Callbacks,
  schedule: (run: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout,
  unschedule: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { cancelled = true; if (timer !== undefined) unschedule(timer); };
  void (async () => {
    try {
      const flow = await Promise.resolve().then(start);
      if (cancelled) return;
      callbacks.onFlow(flow);
      const delay = Number.isFinite(flow.intervalMs) ? Math.max(1000, flow.intervalMs) : 5000;
      const check = async () => {
        try {
          const { status } = await poll();
          if (cancelled) return;
          if (status === "pending") timer = schedule(() => void check(), delay);
          else { cancelled = true; callbacks.onDone(status); }
        } catch { if (!cancelled) { cancelled = true; callbacks.onError(); } }
      };
      timer = schedule(() => void check(), delay);
    } catch { if (!cancelled) { cancelled = true; callbacks.onError(); } }
  })();
  return cancel;
}
