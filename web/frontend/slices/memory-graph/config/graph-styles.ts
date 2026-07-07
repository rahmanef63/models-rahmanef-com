// Self-contained scoped styles for the memory-graph, injected once as a <style> by the renderer.
// TODO(rr): this slice ships its own CSS (the repo convention is "all styling in globals.css").
// Chosen deliberately: the graph is ~350 lines of bespoke canvas styling that can't reuse global
// .card/.row, and the explicit ask is a slice "reusable in other projects" — a self-contained
// <style> (no globals.css edit, no css-import build concern) is the most portable option.
// Everything is namespaced under `.mgraph` + `mg-` classes; colors come from `--mg-*` vars that
// default here (dark starfield + brand lime) and can be overridden by a consumer. Data export.
export const GRAPH_CSS = `
.mgraph{
  --mg-bg:#111214; --mg-panel:#202124; --mg-panel2:#27282c; --mg-panel3:#242528;
  --mg-line:rgba(255,255,255,.075); --mg-border:rgba(255,255,255,.08);
  --mg-text:#f4f5f7; --mg-muted:#a5a6ad; --mg-muted2:#707177;
  --mg-accent:var(--accent,#cdf24a); --mg-accent-ink:#12130f;
  --mg-line-strong:color-mix(in srgb, var(--mg-accent) 40%, transparent);
  --mg-memory:var(--mg-accent); --mg-agent:#7cc4ff; --mg-skill:#a782ff; --mg-tool:#5fe3c0;
  --mg-node-scale:1; --mg-link-width:1.35; --mg-pill-alpha:.62;
  position:relative; height:clamp(560px,80vh,900px); width:100%;
  border-radius:16px; overflow:hidden; color:var(--mg-text);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  border:1px solid var(--mg-border);
  background:
    radial-gradient(circle at 50% 45%, rgba(220,255,66,.06), transparent 13%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,.03), transparent 38%),
    var(--mg-bg);
}
.mgraph *{box-sizing:border-box}
.mgraph::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px);background-size:14px 14px;background-position:center;opacity:.22;-webkit-mask-image:radial-gradient(ellipse at center, #000 0 34%, transparent 70%);mask-image:radial-gradient(ellipse at center, #000 0 34%, transparent 70%);pointer-events:none}

.mg-topbar{position:absolute;top:0;left:0;right:0;z-index:35;display:flex;justify-content:space-between;align-items:center;padding:14px 14px 0 16px;pointer-events:none}
.mg-brand{font-size:14px;font-weight:700;letter-spacing:-.02em;color:#fafafa}
.mg-actions{display:flex;align-items:center;gap:10px;pointer-events:auto}
.mg-icon-btn,.mg-import-btn{border:0;height:34px;border-radius:999px;font-weight:800;font-size:13px;cursor:pointer;transition:transform .16s ease,filter .16s ease}
.mg-import-btn{background:var(--mg-accent);color:var(--mg-accent-ink);padding:0 16px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 28px rgba(221,255,66,.18)}
.mg-import-btn:hover,.mg-icon-btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.mg-import-btn:active,.mg-icon-btn:active{transform:translateY(0) scale(.98)}
.mg-import-btn svg{width:16px;height:16px}
.mg-icon-btn{width:34px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#dedfe5}
.mg-icon-btn svg{width:18px;height:18px}

.mg-stage{position:absolute;inset:0;cursor:grab;touch-action:none}
.mg-stage.dragging{cursor:grabbing}
.mg-world{position:absolute;left:0;top:0;width:1600px;height:1000px;transform-origin:0 0;will-change:transform}
.mg-edges{position:absolute;inset:0;overflow:visible;pointer-events:none}
.mg-edges line{stroke:var(--mg-line);stroke-width:var(--mg-link-width);vector-effect:non-scaling-stroke}
.mg-edges line.link{stroke:rgba(167,130,255,.22);stroke-dasharray:2 4}
.mg-edges line.hot{stroke:var(--mg-line-strong);stroke-width:calc(var(--mg-link-width) + .25);filter:drop-shadow(0 0 7px rgba(220,255,66,.16))}
.mg-edges line.temp{stroke:rgba(220,255,66,.26);stroke-width:calc(var(--mg-link-width) + .35);stroke-dasharray:4 5}

.mg-hero{position:absolute;left:800px;top:250px;transform:translateX(-50%);width:340px;text-align:left;pointer-events:none;user-select:none;text-shadow:0 12px 42px rgba(0,0,0,.55)}
.mg-hero h1{margin:0;font-size:20px;line-height:1.08;letter-spacing:-.055em;font-weight:850}
.mg-hero p{margin:3px 0 0;color:#a7a8ae;font-size:18px;line-height:1.05;letter-spacing:-.05em;font-weight:700}

.mg-node-layer{position:absolute;inset:0}
.mg-node,.mg-hover-add{--x:0px;--y:0px;position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%);user-select:none;touch-action:none}
.mg-core{width:calc(58px*var(--mg-node-scale));height:calc(58px*var(--mg-node-scale));border-radius:999px;background:radial-gradient(circle at 50% 50%, var(--mg-accent) 0 21%, rgba(220,255,66,.68) 22% 35%, rgba(241,244,231,.96) 50%, #d6d9ce 72%, #a5a9a1 100%);box-shadow:0 0 0 1px rgba(255,255,255,.2),0 0 26px rgba(220,255,66,.33),0 18px 55px rgba(0,0,0,.36);cursor:pointer;transition:box-shadow .2s ease,width .14s ease,height .14s ease}
.mg-core:hover{box-shadow:0 0 0 1px rgba(255,255,255,.25),0 0 38px rgba(220,255,66,.5),0 22px 60px rgba(0,0,0,.42)}
.mg-hub{width:calc(32px*var(--mg-node-scale));height:calc(32px*var(--mg-node-scale));display:grid;place-items:center;border-radius:calc(10px*var(--mg-node-scale));background:rgba(43,44,48,.78);border:1px solid rgba(255,255,255,.09);box-shadow:0 12px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.04);color:#b9bac0;cursor:grab;transition:background .16s,border-color .16s,color .16s,transform .16s,width .14s,height .14s}
.mg-hub:hover,.mg-hub.active{color:#f1f2f4;background:rgba(55,56,61,.9);border-color:var(--mg-line-strong);transform:translate(-50%,-50%) scale(1.06)}
.mg-hub svg{width:calc(17px*var(--mg-node-scale));height:calc(17px*var(--mg-node-scale))}
.mg-pill{min-width:calc(72px*var(--mg-node-scale));height:calc(25px*var(--mg-node-scale));padding:0 calc(15px*var(--mg-node-scale));display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;color:rgba(255,255,255,var(--mg-pill-alpha));background:rgba(38,39,43,.46);border:1px solid rgba(255,255,255,.04);box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 26px rgba(0,0,0,.12);font-size:calc(11px*var(--mg-node-scale));font-weight:700;letter-spacing:-.01em;white-space:nowrap;cursor:pointer;filter:blur(.25px);opacity:.6;transition:opacity .16s,color .16s,background .16s,border-color .16s,transform .16s,filter .16s}
.mg-pill:hover,.mg-pill.active{opacity:1;color:#e9ebef;filter:none;background:rgba(45,46,50,.9);border-color:var(--mg-line-strong);transform:translate(-50%,-50%) scale(1.05);box-shadow:0 16px 40px rgba(0,0,0,.28)}
.mg-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.mg-pill.is-memory .mg-dot{background:var(--mg-memory);box-shadow:0 0 8px var(--mg-memory)}
.mg-pill.is-agent .mg-dot{background:var(--mg-agent);box-shadow:0 0 8px var(--mg-agent)}
.mg-pill.is-skill .mg-dot{background:var(--mg-skill);box-shadow:0 0 8px var(--mg-skill)}
.mg-pill.is-tool .mg-dot{background:var(--mg-tool);box-shadow:0 0 8px var(--mg-tool)}
.mg-pill.is-agent.active,.mg-pill.is-agent:hover{border-color:color-mix(in srgb,var(--mg-agent) 44%,transparent)}
.mg-pill.is-skill.active,.mg-pill.is-skill:hover{border-color:color-mix(in srgb,var(--mg-skill) 44%,transparent)}
.mg-pill.is-tool.active,.mg-pill.is-tool:hover{border-color:color-mix(in srgb,var(--mg-tool) 44%,transparent)}
.mg-tag-dot{display:none;width:5px;height:5px;border-radius:50%;background:var(--mg-skill);box-shadow:0 0 10px rgba(167,130,255,.5)}
.mgraph.tags-on .mg-pill[data-tags="true"] .mg-tag-dot{display:inline-block}

.mg-hover-add{width:34px;height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.07));color:#fff;box-shadow:0 16px 36px rgba(0,0,0,.45);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .14s,transform .14s,border-color .14s;z-index:8}
.mg-hover-add.visible{opacity:1;pointer-events:auto}
.mg-hover-add:hover{transform:translate(-50%,-50%) scale(1.08);border-color:var(--mg-line-strong)}
.mg-hover-add svg{width:16px;height:16px}
.mg-hover-label{position:absolute;left:50%;top:calc(100% + 7px);transform:translateX(-50%);color:#d5d6da;font-size:10px;font-weight:700;white-space:nowrap;opacity:.8;pointer-events:none}

.mg-dock{position:absolute;z-index:25;left:50%;bottom:26px;transform:translateX(-50%);width:min(500px,calc(100% - 40px));pointer-events:auto;transition:width .22s ease,bottom .22s ease}
.mg-dock.expanded{width:min(760px,calc(100% - 40px));bottom:38px}
.mg-context-chip{position:absolute;left:62px;top:-24px;height:20px;padding:0 10px;display:none;align-items:center;border-radius:999px;background:rgba(139,92,246,.16);border:1px solid rgba(167,130,255,.24);color:#ddd7ff;font-size:11px;font-weight:750}
.mg-dock.has-context .mg-context-chip{display:flex}
.mg-composer{min-height:54px;border-radius:999px;background:linear-gradient(180deg,rgba(40,41,45,.92),rgba(30,31,34,.96));border:1px solid rgba(255,255,255,.08);box-shadow:0 22px 80px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.035);display:grid;grid-template-columns:40px 1fr 42px;gap:10px;padding:9px 12px;align-items:center;transition:border-radius .22s,min-height .22s,padding .22s}
.mg-dock.expanded .mg-composer{border-radius:26px;min-height:100px;padding:14px;align-items:end}
.mg-round-btn{border:0;width:34px;height:34px;border-radius:999px;display:grid;place-items:center;cursor:pointer;transition:.16s ease}
.mg-plus{background:rgba(255,255,255,.075);color:#d0d1d6}
.mg-plus:hover{background:rgba(255,255,255,.12);color:#fff}
.mg-send{background:var(--mg-accent);color:var(--mg-accent-ink);box-shadow:0 9px 24px rgba(220,255,66,.15)}
.mg-send:hover{filter:brightness(1.06);transform:translateY(-1px)}
.mg-round-btn svg{width:18px;height:18px}
.mg-input-wrap{position:relative;min-width:0}
.mg-input{width:100%;height:34px;resize:none;border:0;outline:0;background:transparent;color:#f1f2f5;font-size:14px;line-height:20px;padding:7px 0 0;overflow:hidden;transition:height .22s,padding .22s}
.mg-dock.expanded .mg-input{height:68px;padding:0;overflow:auto}
.mg-input::placeholder{color:#8d8e94;font-weight:650}
.mg-hint{position:absolute;z-index:24;left:50%;bottom:8px;transform:translateX(-50%);color:rgba(255,255,255,.22);font-size:10px;font-weight:650;pointer-events:none}

.mg-inspector{position:absolute;z-index:22;right:322px;top:60px;width:290px;padding:16px;border-radius:18px;background:rgba(31,32,35,.86);border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 80px rgba(0,0,0,.45);transform:translateX(22px);opacity:0;pointer-events:none;transition:.2s ease}
.mg-inspector.open{transform:translateX(0);opacity:1;pointer-events:auto}
.mg-inspector-kicker{font-size:11px;color:var(--mg-accent);font-weight:850;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
.mg-inspector h2{font-size:17px;line-height:1.16;margin:0 0 8px;letter-spacing:-.04em}
.mg-inspector p{margin:0;color:#a8a9ae;font-size:13px;line-height:1.5}
.mg-inspector-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.mg-ghost-btn{height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:#e8e9ee;font-size:12px;font-weight:750;cursor:pointer}
.mg-ghost-btn:hover{background:rgba(255,255,255,.08)}

.mg-panel{position:absolute;z-index:32;top:52px;right:12px;width:288px;max-height:calc(100% - 72px);border-radius:12px;background:rgba(35,36,38,.96);border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden;transition:transform .2s ease,opacity .2s ease}
.mg-panel.closed{transform:translateX(calc(100% + 18px));opacity:0;pointer-events:none}
.mg-panel-scroll{overflow:auto;max-height:calc(80vh - 72px);padding-bottom:10px}
.mg-panel-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px 8px;color:#d7d8dc;font-size:14px;font-weight:750}
.mg-panel-title{display:flex;align-items:center;gap:6px;min-width:0}
.mg-chev{width:16px;height:16px;color:#85868c;transition:transform .14s ease}
.mg-panel-actions{display:flex;align-items:center;gap:10px;color:#a7a8ad}
.mg-panel-icon-btn{border:0;background:transparent;color:inherit;width:20px;height:20px;display:grid;place-items:center;cursor:pointer;padding:0;border-radius:6px}
.mg-panel-icon-btn:hover{background:rgba(255,255,255,.06);color:#fff}
.mg-panel-icon-btn svg{width:18px;height:18px}
.mg-search{margin:0 12px 12px;height:34px;border-radius:8px;background:#2a2b2d;border:1px solid rgba(255,255,255,.06);display:grid;grid-template-columns:22px 1fr 20px;align-items:center;gap:6px;padding:0 8px;color:#b9bac0}
.mg-search svg{width:17px;height:17px}
.mg-filter-input{width:100%;border:0;outline:0;background:transparent;color:#d8d9de;font-size:13px;font-weight:650;min-width:0}
.mg-filter-input::placeholder{color:#9c9da4}
.mg-clear{width:18px;height:18px;border:0;border-radius:50%;display:grid;place-items:center;background:#85868c;color:#292a2d;font-size:14px;font-weight:900;cursor:pointer;line-height:1}
.mg-section{border-top:1px solid rgba(255,255,255,.055);padding:0 0 10px}
.mg-section:first-of-type{border-top:0}
.mg-section-head{width:100%;height:38px;border:0;background:transparent;color:#d0d1d6;display:flex;align-items:center;gap:6px;padding:0 12px;font-size:14px;font-weight:750;cursor:pointer;text-align:left}
.mg-section-head .mg-chev{transform:rotate(90deg)}
.mg-section.collapsed .mg-section-head .mg-chev{transform:rotate(0)}
.mg-section-content{padding:0 12px;display:grid;gap:14px}
.mg-section.collapsed .mg-section-content{display:none}
.mg-row{min-height:22px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#c9cacf;font-size:13px;font-weight:500}
.mg-switch{position:relative;width:34px;height:20px;flex:0 0 auto}
.mg-switch input{display:none}
.mg-slider{position:absolute;inset:0;border-radius:999px;background:#3a3b3e;cursor:pointer;transition:.16s ease}
.mg-slider::before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:#f7f7f8;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:.16s ease}
.mg-switch input:checked + .mg-slider{background:var(--mg-skill)}
.mg-switch input:checked + .mg-slider::before{transform:translateX(14px)}
.mg-range{display:grid;gap:8px;color:#c9cacf;font-size:13px;font-weight:500}
.mg-range input[type=range]{appearance:none;-webkit-appearance:none;width:100%;height:20px;background:transparent;cursor:pointer}
.mg-range input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:999px;background:#3a3b3e}
.mg-range input[type=range]::-moz-range-track{height:3px;border-radius:999px;background:#3a3b3e}
.mg-range input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;margin-top:-6.5px;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.mg-range input[type=range]::-moz-range-thumb{width:16px;height:16px;border:0;border-radius:50%;background:#fff}
.mg-animate{height:31px;border:0;border-radius:6px;background:linear-gradient(180deg,#a782ff,#8b5cf6);color:#fff;font-size:13px;font-weight:760;cursor:pointer;box-shadow:0 10px 22px rgba(139,92,246,.18)}
.mg-animate.on{background:linear-gradient(180deg,var(--mg-accent),var(--mg-accent));color:var(--mg-accent-ink)}
.mg-group-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mg-group-chip{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);color:#c9cacf;min-height:28px;border-radius:7px;padding:0 9px;font-size:12px;font-weight:720;cursor:pointer;text-align:left}
.mg-group-chip.active{border-color:rgba(139,92,246,.45);background:rgba(139,92,246,.22);color:#fff}
.mg-toast{position:absolute;z-index:45;left:50%;top:18px;transform:translate(-50%,-12px);padding:10px 14px;border-radius:999px;background:rgba(32,33,36,.94);border:1px solid rgba(255,255,255,.08);color:#f2f3f5;font-size:12px;font-weight:750;opacity:0;pointer-events:none;transition:.2s ease;box-shadow:0 16px 48px rgba(0,0,0,.35)}
.mg-toast.show{opacity:1;transform:translate(-50%,0)}
.mg-help{position:absolute;left:14px;bottom:12px;z-index:15;color:rgba(255,255,255,.24);font-size:11px;line-height:1.5;max-width:300px;opacity:0;transition:.2s ease;pointer-events:none}
.mgraph:hover .mg-help{opacity:1}
.mg-node:focus-visible,.mg-icon-btn:focus-visible,.mg-import-btn:focus-visible,.mg-ghost-btn:focus-visible,.mg-group-chip:focus-visible,.mg-round-btn:focus-visible,.mg-hover-add:focus-visible{outline:2px solid var(--mg-accent);outline-offset:2px}
@media (max-width:900px){.mgraph{--mg-node-scale:.92}.mg-inspector{right:12px;left:12px;top:54px;width:auto}.mg-hero{top:200px;width:240px}.mg-hero h1{font-size:17px}.mg-hint{display:none}}
@media (prefers-reduced-motion:reduce){.mgraph *{transition:none!important;animation:none!important}}
`;
