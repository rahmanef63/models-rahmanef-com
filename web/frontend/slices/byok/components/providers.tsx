"use client";
import { useState } from "react";
import { PROVIDER_LABEL, SUPPORTED, FRIENDLY, ErrorLine, type Cred, type Catalog } from "@/app/app/_components/shared";
import { ProviderKeys } from "./provider-keys";

// lowest cost.input CHAT-capable model.dev knows for a provider — used as the throwaway 1-token
// connectivity test, and as the default when a provider has no catalog entry at all (5 of 22
// don't — those just skip the auto-test, no crash, the credential is saved regardless).
// Excludes embedding/guard/moderation models — those reject a plain chat call for reasons
// unrelated to key validity (e.g. openai's cheapest model by cost.input is an embeddings model,
// which would false-negative a perfectly valid key).
export function cheapestModel(catalog: Catalog, provider: string): string | undefined {
  const models = catalog[provider]?.models as Record<string, any> | undefined;
  const ids = models ? Object.keys(models) : [];
  const chatCapable = ids.filter((id) => {
    const m = models![id];
    const family = String(m?.family ?? "").toLowerCase();
    if (/embed|guard|moderation/.test(family) || /embed|guard|moderation/i.test(id)) return false;
    const out = m?.modalities?.output;
    return !Array.isArray(out) || out.includes("text");
  });
  // OpenRouter's ":free" models share a global, cross-user rate-limit pool — a 429 there says
  // nothing about whether THIS key works, so prefer a paid model for the connectivity test.
  const notFree = chatCapable.filter((id) => !id.endsWith(":free"));
  const pool = notFree.length > 0 ? notFree : chatCapable.length > 0 ? chatCapable : ids; // fall back rather than skipping the test entirely
  if (pool.length === 0) return undefined;
  return pool.reduce((best, id) => {
    const c = models![id]?.cost?.input;
    const bc = models![best]?.cost?.input;
    return c != null && (bc == null || c < bc) ? id : best;
  }, pool[0]);
}

type TestResult = { ok: boolean; code?: string; status?: number; detail?: string; model?: string };

function TestResultLine({ r, provider, isAdmin }: { r: TestResult; provider: string; isAdmin: boolean }) {
  if (r.ok) return <p className="ok-line">✓ verified — {PROVIDER_LABEL[provider] ?? provider} responded{r.model ? ` (${r.model})` : ""}.</p>;
  return <ErrorLine e={{ data: { code: r.code ?? "internal", status: r.status, detail: r.detail, provider, model: r.model } }} isAdmin={isAdmin} />;
}

// shared model-pick + test sequence — used by both ApiKeyForm (right after Save) and
// ConnectedCreds (the on-demand "test" button), so they can't drift out of sync.
async function runCredentialTest(
  testCredential: (a: { provider: string; model: string }) => Promise<TestResult>,
  catalog: Catalog,
  provider: string,
): Promise<TestResult | undefined> {
  const model = cheapestModel(catalog, provider);
  if (!model) return undefined;
  return { ...(await testCredential({ provider, model })), model };
}

// OAuth-only providers never appear in the manual paste-a-key dropdown — derived from
// PROVIDER_LABEL so a new provider only needs adding in one place (shared.tsx).
const OAUTH_ONLY = new Set(["openai-codex", "anthropic-oauth", "github-copilot"]);
const API_KEY_PROVIDERS = Object.keys(PROVIDER_LABEL).filter((p) => !OAUTH_ONLY.has(p));

export function ApiKeyForm({ setCredential, testCredential, catalog, isAdmin }: {
  setCredential: (a: { provider: string; apiKey: string }) => Promise<unknown>;
  testCredential: (a: { provider: string; model: string }) => Promise<TestResult>;
  catalog: Catalog;
  isAdmin: boolean;
}) {
  const [provider, setProvider] = useState("anthropic");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <div className="apikey">
      <div className="apikey-label mono muted">or paste an API key — any of {SUPPORTED} providers</div>
      <div className="row">
        <select disabled={busy} value={provider} onChange={(e) => { setProvider(e.target.value); setResult(null); setSkipped(false); setErr(null); }} style={{ width: "auto" }}>
          {API_KEY_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p] ?? p}</option>)}
        </select>
        <input disabled={busy} type="password" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button
          className="btn"
          disabled={busy || !key}
          onClick={async () => {
            const p = provider; // freeze — select+input are disabled while busy, but be explicit
            setBusy(true);
            setResult(null);
            setSkipped(false);
            setErr(null);
            try {
              await setCredential({ provider: p, apiKey: key });
              setKey("");
              // verify it immediately, right here — not the next time the user tries to chat
              const r = await runCredentialTest(testCredential, catalog, p);
              if (r) setResult(r); else setSkipped(true);
            } catch (e) {
              setErr(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : "Save"}
        </button>
      </div>
      {result && <TestResultLine r={result} provider={provider} isAdmin={isAdmin} />}
      {skipped && <p className="muted" style={{ fontSize: ".85rem" }}>Saved — {PROVIDER_LABEL[provider] ?? provider} has no models.dev catalog entry to auto-verify with yet.</p>}
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
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [errs, setErrs] = useState<Record<string, unknown>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  function forget(provider: string) {
    setResults((rs) => { const { [provider]: _drop, ...rest } = rs; return rest; });
    setErrs((es) => { const { [provider]: _drop, ...rest } = es; return rest; });
  }
  async function runTest(provider: string) {
    setTesting((t) => ({ ...t, [provider]: true }));
    setErrs((es) => ({ ...es, [provider]: null }));
    try {
      const r = await runCredentialTest(testCredential, catalog, provider);
      if (r) setResults((rs) => ({ ...rs, [provider]: r }));
    } catch (e) {
      setErrs((es) => ({ ...es, [provider]: e }));
    } finally {
      setTesting((t) => ({ ...t, [provider]: false }));
    }
  }
  return (
    <ul className="creds">
      {providers.map((p) => {
        const canTest = p.kind !== "oauth" && !!cheapestModel(catalog, p.provider);
        const live = errs[p.provider] != null ? { e: errs[p.provider] } : results[p.provider] ? { r: results[p.provider] } : null;
        return (
          <li key={p.provider}>
            <span className="name">{PROVIDER_LABEL[p.provider] ?? p.provider}</span>
            <span className="cred-actions">
              <CredBadge p={p} isAdmin={isAdmin} canTest={canTest} />
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
              <button className="link danger" onClick={() => { forget(p.provider); void deleteCredential({ provider: p.provider }); }}>remove</button>
            </span>
            {/* a test run THIS session wins; otherwise fall back to the persisted last-check so a
                stale failure is still explained inline, not only via the badge's title= tooltip */}
            {live ? (
              "e" in live ? <ErrorLine e={live.e} isAdmin={isAdmin} /> : <TestResultLine r={live.r} provider={p.provider} isAdmin={isAdmin} />
            ) : (
              p.lastCheckedOk === false && <ErrorLine e={{ data: { code: p.lastCheckedCode ?? "internal", detail: p.lastCheckedDetail, provider: p.provider } }} isAdmin={isAdmin} />
            )}
            {p.kind !== "oauth" && open[p.provider] && <ProviderKeys provider={p.provider} />}
          </li>
        );
      })}
    </ul>
  );
}

function CredBadge({ p, isAdmin, canTest }: { p: Cred; isAdmin: boolean; canTest: boolean }) {
  if (p.kind === "oauth") return <span className="badge oauth">OAUTH</span>;
  if (p.lastCheckedOk === true) return <span className="badge ok">VERIFIED</span>;
  if (p.lastCheckedOk === false) {
    const label = PROVIDER_LABEL[p.provider] ?? p.provider;
    const title = isAdmin ? `${p.lastCheckedCode ?? "?"}${p.lastCheckedDetail ? " · " + p.lastCheckedDetail : ""}` : (FRIENDLY[p.lastCheckedCode ?? "internal"] ?? FRIENDLY.internal)(label);
    return <span className="badge danger" title={title}>NEEDS ATTENTION</span>;
  }
  // "not tested yet" (one tap away) vs "can never be auto-tested" (no models.dev coverage) —
  // otherwise both read identically and the missing test button on the latter looks like a bug.
  if (!canTest) return <span className="badge" title="No models.dev catalog entry for this provider — nothing to auto-verify.">NO AUTO-CHECK</span>;
  return <span className="badge key">NOT TESTED</span>;
}
