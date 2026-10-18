"use client";
import { useState } from "react";
import { PROVIDER_LABEL, SUPPORTED, type Cred, type Catalog } from "../lib/provider-meta";
import { FRIENDLY, useConfirm } from "@/features/core";
import { ErrorLine } from "./error-line";
import { ProviderKeys } from "./provider-keys";
export { CustomProviderForm } from "./custom-provider-form";
import { cheapestModel, credentialError, type TestResult } from "../lib/credential-check";
export { cheapestModel } from "../lib/credential-check";

function TestResultLine({ r, provider, isAdmin }: { r: TestResult; provider: string; isAdmin: boolean }) {
  if (r.ok) return <p className="ok-line">✓ check passed — {PROVIDER_LABEL[provider] ?? provider} responded{r.model ? ` (${r.model})` : ""}.</p>;
  return <ErrorLine e={credentialError({ data: r }, provider)} isAdmin={isAdmin} />;
}

// Tests run only on explicit request; saving a credential does not contact the provider.
async function runCredentialTest(
  testCredential: (a: { provider: string; model: string }) => Promise<TestResult>,
  catalog: Catalog,
  provider: string,
): Promise<TestResult | undefined> {
  const model = cheapestModel(catalog, provider);
  if (!model) return undefined;
  return { ...(await testCredential({ provider, model })), model };
}

// OAuth-only providers do not accept pasted API keys.
const OAUTH_ONLY = new Set(["openai-codex", "anthropic-oauth", "github-copilot"]);
const API_KEY_PROVIDERS = Object.keys(PROVIDER_LABEL).filter((p) => !OAUTH_ONLY.has(p));

export function ApiKeyForm({ setCredential, isAdmin }: {
  setCredential: (a: { provider: string; apiKey: string }) => Promise<unknown>;
  testCredential: (a: { provider: string; model: string }) => Promise<TestResult>;
  catalog: Catalog;
  isAdmin: boolean;
}) {
  const [provider, setProvider] = useState("anthropic");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <div className="apikey">
      <div className="apikey-label mono muted">or paste an API key — any of {SUPPORTED} providers</div>
      <div className="row">
        <select disabled={busy} value={provider} onChange={(e) => { setProvider(e.target.value); setKey(""); setSaved(false); setErr(null); }} style={{ width: "auto" }}>
          {API_KEY_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p] ?? p}</option>)}
        </select>
        <input disabled={busy} type="password" placeholder="sk-…" value={key} autoComplete="off" aria-label="API key" onChange={(e) => { setKey(e.target.value); setSaved(false); setErr(null); }} />
        <button
          className="btn accent"
          disabled={busy || !key.trim()}
          onClick={async () => {
            if (busy || !key.trim()) return;
            const p = provider;
            setBusy(true);
            setSaved(false);
            setErr(null);
            try {
              await setCredential({ provider: p, apiKey: key });
              setSaved(true);
            } catch (e) {
              setErr(credentialError(e, p));
            } finally {
              setKey("");
              setBusy(false);
            }
          }}
        >
          {busy ? "saving…" : "Save"}
        </button>
      </div>
      {saved && <p className="muted" role="status" style={{ fontSize: ".85rem" }}>Key saved — not tested. Use “test” below to make a provider request; usage charges may apply.</p>}
      {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
    </div>
  );
}

export function ConnectedCreds({ providers, catalog, isAdmin, deleteCredential, testCredential }: {
  providers: Cred[];
  catalog: Catalog;
  isAdmin: boolean;
  deleteCredential: (a: { provider: string }) => Promise<unknown>;
  testCredential: (a: { provider: string; model: string }) => Promise<TestResult>;
}) {
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { result: TestResult; checkedAt?: number; keyCount?: number }>>({});
  const [errs, setErrs] = useState<Record<string, unknown>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { ask, confirmDialog } = useConfirm();
  function forget(provider: string) {
    setResults((rs) => { const { [provider]: _drop, ...rest } = rs; return rest; });
    setErrs((es) => { const { [provider]: _drop, ...rest } = es; return rest; });
  }
  async function runTest(provider: string) {
    if (testing[provider]) return;
    forget(provider);
    setTesting((t) => ({ ...t, [provider]: true }));
    setErrs((es) => ({ ...es, [provider]: null }));
    try {
      const r = await runCredentialTest(testCredential, catalog, provider);
      const cred = providers.find((p) => p.provider === provider);
      if (r) setResults((rs) => ({ ...rs, [provider]: { result: r, checkedAt: cred?.lastCheckedAt, keyCount: cred?.keyCount } }));
    } catch (e) {
      setErrs((es) => ({ ...es, [provider]: credentialError(e, provider) }));
    } finally {
      setTesting((t) => ({ ...t, [provider]: false }));
    }
  }
  async function remove(provider: string) {
    setTesting((t) => ({ ...t, [provider]: true }));
    try { await deleteCredential({ provider }); forget(provider); }
    catch (e) { setErrs((es) => ({ ...es, [provider]: credentialError(e, provider) })); }
    finally { setTesting((t) => ({ ...t, [provider]: false })); }
  }
  return (
    <>
    <p className="muted" style={{ fontSize: ".8rem" }}>Tests send a chat request to the provider. Usage charges may apply.</p>
    <ul className="creds">
      {providers.map((p) => {
        const canTest = p.kind !== "oauth" && !!cheapestModel(catalog, p.provider);
        const saved = results[p.provider];
        const result = saved?.checkedAt === p.lastCheckedAt && saved?.keyCount === p.keyCount ? saved?.result : undefined;
        const live = errs[p.provider] != null ? { e: errs[p.provider] } : result ? { r: result } : null;
        return (
          <li key={p.provider}>
            <span className="name">{PROVIDER_LABEL[p.provider] ?? p.provider}</span>
            <span className="cred-actions">
              {testing[p.provider] ? <span className="badge">PENDING</span> : <CredBadge p={errs[p.provider] != null ? { ...p, lastCheckedOk: undefined } : result ? { ...p, lastCheckedOk: result.ok } : p} canTest={canTest} />}
              {canTest && (
                <button className="link" disabled={testing[p.provider]} onClick={() => void runTest(p.provider)}>
                  {testing[p.provider] ? "testing…" : "test"}
                </button>
              )}
              {p.kind !== "oauth" && (
                <button className="link" onClick={() => setOpen((o) => ({ ...o, [p.provider]: !o[p.provider] }))}>
                  {p.keyCount && p.keyCount > 1 ? `${p.keyCount} keys` : "+ key"}
                </button>
              )}
              <button className="link danger" disabled={testing[p.provider]} onClick={() => ask({ title: "Remove provider?", message: `Disconnect ${PROVIDER_LABEL[p.provider] ?? p.provider}? This drops all of its keys.`, confirmLabel: "Remove", run: () => remove(p.provider) })}>remove</button>
            </span>
            {/* a test run THIS session wins; otherwise fall back to the persisted last-check so a
                stale failure is still explained inline, not only via the badge's title= tooltip */}
            {testing[p.provider] ? <p className="muted" role="status">Request pending…</p> : live ? (
              "e" in live ? <ErrorLine e={live.e} isAdmin={isAdmin} /> : <TestResultLine r={live.r} provider={p.provider} isAdmin={isAdmin} />
            ) : (
              p.lastCheckedOk === false && <ErrorLine e={credentialError({ data: { code: p.lastCheckedCode } }, p.provider)} isAdmin={isAdmin} />
            )}
            {p.kind !== "oauth" && open[p.provider] && <ProviderKeys provider={p.provider} />}
          </li>
        );
      })}
    </ul>
    {confirmDialog}
    </>
  );
}

function CredBadge({ p, canTest }: { p: Cred; canTest: boolean }) {
  if (p.kind === "oauth") return <span className="badge oauth">OAUTH</span>;
  if (p.lastCheckedOk === true) return <span className="badge ok" title="The last provider chat check succeeded. Individual pool keys and model access may differ.">CHECK PASSED</span>;
  if (p.lastCheckedOk === false) {
    const label = PROVIDER_LABEL[p.provider] ?? p.provider;
    const title = (FRIENDLY[p.lastCheckedCode ?? "internal"] ?? FRIENDLY.internal)(label);
    return <span className="badge danger" title={title}>NEEDS ATTENTION</span>;
  }
  // "not tested yet" (one tap away) vs "can never be auto-tested" (no models.dev coverage) —
  // otherwise both read identically and the missing test button on the latter looks like a bug.
  if (!canTest) return <span className="badge" title="No suitable chat model in the models.dev catalog for this provider — no automatic check is available.">NO AUTO-CHECK</span>;
  return <span className="badge key">NOT TESTED</span>;
}
