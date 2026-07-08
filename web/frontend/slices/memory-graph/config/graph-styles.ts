// Self-contained scoped styles for the memory-graph, injected once as a <style> by the renderer.
// TODO(rr): this slice ships its own CSS (repo convention is globals.css). Deliberate — the graph
// is bespoke canvas styling that can't reuse global .card/.row, and a portable slice must be a
// self-contained drop-in. Every colour derives from the host app's theme tokens (--bg/--fg/--accent
// …) via --mg-* vars, so the graph flips light/dark WITH the app; a consumer can override any --mg-*.
// Namespaced under `.mgraph`. Data export (exempt from the line cap).
export const GRAPH_CSS = `
.mgraph{
  --mg-bg:var(--bg,#111214); --mg-panel:var(--bg-2,#1b1c1f); --mg-panel-2:var(--bg-3,#232428);
  --mg-text:var(--fg,#f4f5f7); --mg-muted:var(--muted,#a5a6ad);
  --mg-line:var(--line,rgba(255,255,255,.09)); --mg-line-2:var(--line-2,rgba(255,255,255,.16));
  --mg-accent:var(--accent,#cdf24a); --mg-accent-ink:var(--accent-ink,#12130f);
  --mg-accent-soft:color-mix(in srgb, var(--mg-accent) 34%, transparent);
  --mg-memory:var(--mg-accent); --mg-agent:#5aa9ff; --mg-skill:#b48bff; --mg-tool:#3fd6ad;
  --mg-glass:color-mix(in srgb, var(--mg-panel) 86%, transparent);
  --mg-glass-2:color-mix(in srgb, var(--mg-panel-2) 82%, transparent);
  --mg-dot:color-mix(in srgb, var(--mg-text) 10%, transparent);
  --mg-node-scale:1; --mg-link-width:1.35; --mg-pill-alpha:.62;
  position:relative; flex:1; height:100%; min-height:520px; width:100%;
  border-radius:16px; overflow:hidden; color:var(--mg-text);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  border:1px solid var(--mg-line);
  background:
    radial-gradient(circle at 50% 44%, color-mix(in srgb, var(--mg-accent) 9%, transparent), transparent 14%),
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--mg-text) 4%, transparent), transparent 40%),
    var(--mg-bg);
}
.mgraph *{box-sizing:border-box}
.mgraph::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle, var(--mg-dot) 1px, transparent 1px);background-size:15px 15px;background-position:center;opacity:.5;-webkit-mask-image:radial-gradient(ellipse at center, #000 0 34%, transparent 72%);mask-image:radial-gradient(ellipse at center, #000 0 34%, transparent 72%);pointer-events:none}

.mg-topbar{position:absolute;top:0;left:0;right:0;z-index:35;display:flex;justify-content:space-between;align-items:center;padding:14px 14px 0 16px;pointer-events:none}
.mg-brand{font-size:14px;font-weight:800;letter-spacing:-.02em;color:var(--mg-text)}
.mg-actions{display:flex;align-items:center;gap:10px;pointer-events:auto}
.mg-icon-btn,.mg-import-btn{border:0;height:34px;border-radius:999px;font-weight:800;font-size:13px;cursor:pointer;transition:transform .16s ease,filter .16s ease,background .16s ease}
.mg-import-btn{background:var(--mg-accent);color:var(--mg-accent-ink);padding:0 16px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 28px color-mix(in srgb, var(--mg-accent) 22%, transparent)}
.mg-import-btn:hover,.mg-icon-btn:hover{transform:translateY(-1px);filter:brightness(1.06)}
.mg-import-btn:active,.mg-icon-btn:active{transform:translateY(0) scale(.98)}
.mg-import-btn svg{width:16px;height:16px}
.mg-icon-btn{width:34px;display:grid;place-items:center;background:var(--mg-glass);border:1px solid var(--mg-line);color:var(--mg-text);backdrop-filter:blur(12px)}
.mg-icon-btn.on{border-color:var(--mg-accent-soft);color:var(--mg-accent)}
.mg-icon-btn svg{width:18px;height:18px}

.mg-stage{position:absolute;inset:0;cursor:grab;touch-action:none}
.mg-stage.dragging{cursor:grabbing}
.mg-world{position:absolute;left:0;top:0;width:1600px;height:1000px;transform-origin:0 0;will-change:transform}
.mg-edges{position:absolute;inset:0;overflow:visible;pointer-events:none}
.mg-edges line{stroke:var(--mg-line-2);stroke-width:var(--mg-link-width);vector-effect:non-scaling-stroke}
.mg-edges line.link{stroke:color-mix(in srgb, var(--mg-skill) 55%, transparent);stroke-dasharray:2 4}
.mg-edges line.hot{stroke:var(--mg-accent-soft);stroke-width:calc(var(--mg-link-width) + .3);filter:drop-shadow(0 0 7px color-mix(in srgb, var(--mg-accent) 22%, transparent))}
.mg-edges line.temp{stroke:var(--mg-accent-soft);stroke-width:calc(var(--mg-link-width) + .35);stroke-dasharray:4 5}

.mg-node-layer{position:absolute;inset:0}
.mg-node,.mg-hover-add{--x:0px;--y:0px;position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%);user-select:none;touch-action:none}
.mg-core{width:calc(58px*var(--mg-node-scale));height:calc(58px*var(--mg-node-scale));border-radius:999px;background:radial-gradient(circle at 50% 50%, var(--mg-accent) 0 22%, color-mix(in srgb, var(--mg-accent) 60%, var(--mg-panel)) 34%, color-mix(in srgb, var(--mg-text) 82%, var(--mg-accent)) 52%, var(--mg-muted) 100%);box-shadow:0 0 0 1px var(--mg-line-2),0 0 26px color-mix(in srgb, var(--mg-accent) 30%, transparent),0 18px 55px rgba(0,0,0,.36);cursor:pointer;transition:box-shadow .2s ease,width .14s ease,height .14s ease}
.mg-core:hover{box-shadow:0 0 0 1px var(--mg-line-2),0 0 40px color-mix(in srgb, var(--mg-accent) 46%, transparent),0 22px 60px rgba(0,0,0,.42)}
.mg-hub{width:calc(32px*var(--mg-node-scale));height:calc(32px*var(--mg-node-scale));display:grid;place-items:center;border-radius:calc(10px*var(--mg-node-scale));background:var(--mg-glass-2);border:1px solid var(--mg-line);box-shadow:0 12px 28px rgba(0,0,0,.24),inset 0 1px 0 color-mix(in srgb, var(--mg-text) 4%, transparent);color:var(--mg-text);cursor:grab;backdrop-filter:blur(6px);transition:background .16s,border-color .16s,transform .16s,width .14s,height .14s}
.mg-hub:hover,.mg-hub.active{border-color:var(--mg-accent-soft);transform:translate(-50%,-50%) scale(1.06)}
.mg-hub svg{width:calc(17px*var(--mg-node-scale));height:calc(17px*var(--mg-node-scale))}
.mg-pill{min-width:calc(72px*var(--mg-node-scale));height:calc(25px*var(--mg-node-scale));padding:0 calc(15px*var(--mg-node-scale));display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;color:var(--mg-text);background:color-mix(in srgb, var(--mg-panel) 55%, transparent);border:1px solid var(--mg-line);box-shadow:0 12px 26px rgba(0,0,0,.12);font-size:calc(11px*var(--mg-node-scale));font-weight:700;letter-spacing:-.01em;white-space:nowrap;cursor:pointer;filter:blur(.25px);opacity:var(--mg-pill-alpha,.62);transition:opacity .16s,color .16s,background .16s,border-color .16s,transform .16s,filter .16s}
.mg-pill:hover,.mg-pill.active{opacity:1;color:var(--mg-text);filter:none;background:color-mix(in srgb, var(--mg-panel) 92%, transparent);border-color:var(--mg-line-2);transform:translate(-50%,-50%) scale(1.05);box-shadow:0 16px 40px rgba(0,0,0,.28)}
.mg-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto;background:var(--mg-memory)}
.mg-pill.is-memory .mg-dot,.mg-legend-dot.is-memory{background:var(--mg-memory);box-shadow:0 0 8px color-mix(in srgb, var(--mg-memory) 60%, transparent)}
.mg-pill.is-agent .mg-dot,.mg-legend-dot.is-agent{background:var(--mg-agent);box-shadow:0 0 8px color-mix(in srgb, var(--mg-agent) 60%, transparent)}
.mg-pill.is-skill .mg-dot,.mg-legend-dot.is-skill{background:var(--mg-skill);box-shadow:0 0 8px color-mix(in srgb, var(--mg-skill) 60%, transparent)}
.mg-pill.is-tool .mg-dot,.mg-legend-dot.is-tool{background:var(--mg-tool);box-shadow:0 0 8px color-mix(in srgb, var(--mg-tool) 60%, transparent)}
.mg-legend-dot.is-cluster{background:var(--mg-muted)}
.mg-legend-dot.is-core{background:var(--mg-accent)}
.mg-pill.is-agent.active,.mg-pill.is-agent:hover{border-color:color-mix(in srgb,var(--mg-agent) 50%,transparent)}
.mg-pill.is-skill.active,.mg-pill.is-skill:hover{border-color:color-mix(in srgb,var(--mg-skill) 50%,transparent)}
.mg-pill.is-tool.active,.mg-pill.is-tool:hover{border-color:color-mix(in srgb,var(--mg-tool) 50%,transparent)}
.mg-tag-dot{display:none;width:5px;height:5px;border-radius:50%;background:var(--mg-skill);box-shadow:0 0 10px color-mix(in srgb, var(--mg-skill) 55%, transparent)}
.mgraph.tags-on .mg-pill[data-tags="true"] .mg-tag-dot{display:inline-block}

.mg-hover-add{width:34px;height:34px;border-radius:999px;border:1px solid var(--mg-line-2);display:grid;place-items:center;background:color-mix(in srgb, var(--mg-panel) 92%, transparent);color:var(--mg-text);box-shadow:0 16px 36px rgba(0,0,0,.4);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .14s,transform .14s,border-color .14s;z-index:8;backdrop-filter:blur(6px)}
.mg-hover-add.visible{opacity:1;pointer-events:auto}
.mg-hover-add:hover{transform:translate(-50%,-50%) scale(1.08);border-color:var(--mg-accent-soft)}
.mg-hover-add svg{width:16px;height:16px}
.mg-hover-label{position:absolute;left:50%;top:calc(100% + 7px);transform:translateX(-50%);color:var(--mg-muted);font-size:10px;font-weight:700;white-space:nowrap;opacity:.85;pointer-events:none}

.mg-dock{position:absolute;z-index:25;left:50%;bottom:26px;transform:translateX(-50%);width:min(520px,calc(100% - 40px));pointer-events:auto;transition:width .22s ease,bottom .22s ease}
.mg-dock.expanded{width:min(760px,calc(100% - 40px));bottom:38px}
.mg-context-chip{position:absolute;left:62px;top:-24px;height:20px;padding:0 10px;display:none;align-items:center;border-radius:999px;background:color-mix(in srgb, var(--mg-skill) 18%, transparent);border:1px solid color-mix(in srgb, var(--mg-skill) 28%, transparent);color:var(--mg-text);font-size:11px;font-weight:750}
.mg-dock.has-context .mg-context-chip{display:flex}
.mg-composer{min-height:54px;border-radius:999px;background:var(--mg-glass);border:1px solid var(--mg-line-2);box-shadow:0 22px 80px rgba(0,0,0,.4),inset 0 1px 0 color-mix(in srgb, var(--mg-text) 4%, transparent);backdrop-filter:blur(16px);display:grid;grid-template-columns:40px 1fr 42px;gap:10px;padding:9px 12px;align-items:center;transition:border-radius .22s,min-height .22s,padding .22s}
.mg-dock.expanded .mg-composer{border-radius:26px;min-height:100px;padding:14px;align-items:end}
.mg-round-btn{border:0;width:34px;height:34px;border-radius:999px;display:grid;place-items:center;cursor:pointer;transition:.16s ease}
.mg-plus{background:color-mix(in srgb, var(--mg-text) 8%, transparent);color:var(--mg-text)}
.mg-plus:hover{background:color-mix(in srgb, var(--mg-text) 14%, transparent)}
.mg-send{background:var(--mg-accent);color:var(--mg-accent-ink);box-shadow:0 9px 24px color-mix(in srgb, var(--mg-accent) 18%, transparent)}
.mg-send:hover{filter:brightness(1.06);transform:translateY(-1px)}
.mg-round-btn svg{width:18px;height:18px}
.mg-input-wrap{position:relative;min-width:0}
.mg-input{width:100%;height:34px;resize:none;border:0;outline:0;background:transparent;color:var(--mg-text);font-size:14px;line-height:20px;padding:7px 0 0;overflow:hidden;transition:height .22s,padding .22s}
.mg-dock.expanded .mg-input{height:68px;padding:0;overflow:auto}
.mg-input::placeholder{color:var(--mg-muted);font-weight:650}
.mg-mention{position:absolute;bottom:calc(100% + 10px);left:-4px;right:-4px;z-index:30;max-height:224px;overflow:auto;padding:6px;border-radius:14px;background:var(--mg-glass);border:1px solid var(--mg-line-2);box-shadow:0 22px 60px rgba(0,0,0,.4);backdrop-filter:blur(16px);display:flex;flex-direction:column;gap:2px}
.mg-mention-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--mg-text);font-size:13px;font-weight:650;cursor:pointer;text-align:left;width:100%}
.mg-mention-item:hover,.mg-mention-item.active{background:color-mix(in srgb, var(--mg-text) 8%, transparent)}
.mg-mention-item small{color:var(--mg-muted);font-size:11px;font-family:ui-monospace,monospace;margin-left:auto}

.mg-inspector{position:absolute;z-index:22;right:316px;top:60px;width:300px;max-height:calc(100% - 96px);overflow:auto;padding:16px;border-radius:18px;background:var(--mg-glass);border:1px solid var(--mg-line-2);box-shadow:0 24px 80px rgba(0,0,0,.42);backdrop-filter:blur(18px);transform:translateX(22px);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease}
.mg-inspector.open{transform:translateX(0);opacity:1;pointer-events:auto}
.mg-inspector-kicker{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--mg-accent);font-weight:850;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
.mg-inspector-kicker .mg-legend-dot{width:7px;height:7px}
.mg-inspector h2{font-size:17px;line-height:1.18;margin:0 0 8px;letter-spacing:-.03em;color:var(--mg-text);word-break:break-word}
.mg-inspector p{margin:0;color:var(--mg-muted);font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.mg-tags{margin-top:8px;color:var(--mg-muted);font-size:11px;font-family:ui-monospace,monospace}
.mg-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.mg-links-h{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--mg-muted);width:100%;font-weight:800}
.mg-link-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--mg-line-2);background:color-mix(in srgb, var(--mg-panel) 60%, transparent);color:var(--mg-text);font-size:12px;font-weight:700;cursor:pointer}
.mg-link-chip:hover{border-color:var(--mg-accent-soft)}
.mg-inspector-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.mg-ghost-btn{height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--mg-line-2);background:color-mix(in srgb, var(--mg-text) 4%, transparent);color:var(--mg-text);font-size:12px;font-weight:750;cursor:pointer}
.mg-ghost-btn:hover{background:color-mix(in srgb, var(--mg-text) 9%, transparent)}
.mg-ghost-btn.danger{color:#ff7a68;border-color:color-mix(in srgb,#ff7a68 40%,transparent)}
.mg-ghost-btn.danger:hover{background:color-mix(in srgb,#ff7a68 14%,transparent)}

.mg-panel{position:absolute;z-index:32;top:12px;right:12px;bottom:12px;width:290px;display:flex;flex-direction:column;border-radius:14px;background:var(--mg-glass);border:1px solid var(--mg-line-2);box-shadow:0 24px 70px rgba(0,0,0,.46);backdrop-filter:blur(18px);overflow:hidden;transition:transform .2s ease,opacity .2s ease}
.mg-panel.closed{transform:translateX(calc(100% + 20px));opacity:0;pointer-events:none}
.mg-panel-scroll{flex:1;overflow:auto;padding-bottom:10px}
.mg-panel-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 8px;color:var(--mg-text);font-size:14px;font-weight:800}
.mg-panel-title{display:flex;align-items:center;gap:6px;min-width:0}
.mg-chev{width:16px;height:16px;color:var(--mg-muted);transition:transform .14s ease;flex:0 0 auto}
.mg-panel-actions{display:flex;align-items:center;gap:10px;color:var(--mg-muted)}
.mg-panel-icon-btn{border:0;background:transparent;color:inherit;width:22px;height:22px;display:grid;place-items:center;cursor:pointer;padding:0;border-radius:6px}
.mg-panel-icon-btn:hover{background:color-mix(in srgb, var(--mg-text) 8%, transparent);color:var(--mg-text)}
.mg-panel-icon-btn svg{width:18px;height:18px}
.mg-search{margin:0 12px 12px;height:34px;border-radius:9px;background:var(--mg-glass-2);border:1px solid var(--mg-line);display:grid;grid-template-columns:22px 1fr 20px;align-items:center;gap:6px;padding:0 8px;color:var(--mg-muted)}
.mg-search svg{width:17px;height:17px}
.mg-filter-input{width:100%;border:0;outline:0;background:transparent;color:var(--mg-text);font-size:13px;font-weight:650;min-width:0}
.mg-filter-input::placeholder{color:var(--mg-muted)}
.mg-clear{width:18px;height:18px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--mg-muted);color:var(--mg-panel);font-size:14px;font-weight:900;cursor:pointer;line-height:1}
.mg-section{border-top:1px solid var(--mg-line);padding:0 0 10px}
.mg-section:first-of-type{border-top:0}
.mg-section-head{width:100%;height:38px;border:0;background:transparent;color:var(--mg-text);display:flex;align-items:center;gap:6px;padding:0 12px;font-size:14px;font-weight:800;cursor:pointer;text-align:left}
.mg-section-head .mg-chev{transform:rotate(90deg)}
.mg-section.collapsed .mg-section-head .mg-chev{transform:rotate(0)}
.mg-section-content{padding:0 12px;display:grid;gap:14px}
.mg-section.collapsed .mg-section-content{display:none}
.mg-row{min-height:22px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--mg-text);font-size:13px;font-weight:600}
.mg-switch{position:relative;width:34px;height:20px;flex:0 0 auto}
.mg-switch input{display:none}
.mg-slider{position:absolute;inset:0;border-radius:999px;background:color-mix(in srgb, var(--mg-text) 22%, transparent);cursor:pointer;transition:.16s ease}
.mg-slider::before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:.16s ease}
.mg-switch input:checked + .mg-slider{background:var(--mg-skill)}
.mg-switch input:checked + .mg-slider::before{transform:translateX(14px)}
.mg-range{display:grid;gap:8px;color:var(--mg-text);font-size:13px;font-weight:600}
.mg-range input[type=range]{appearance:none;-webkit-appearance:none;width:100%;height:20px;background:transparent;cursor:pointer}
.mg-range input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:999px;background:color-mix(in srgb, var(--mg-text) 22%, transparent)}
.mg-range input[type=range]::-moz-range-track{height:3px;border-radius:999px;background:color-mix(in srgb, var(--mg-text) 22%, transparent)}
.mg-range input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--mg-accent);margin-top:-6.5px;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.mg-range input[type=range]::-moz-range-thumb{width:16px;height:16px;border:0;border-radius:50%;background:var(--mg-accent)}
.mg-animate{height:31px;border:0;border-radius:8px;background:color-mix(in srgb, var(--mg-skill) 90%, var(--mg-panel));color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px color-mix(in srgb, var(--mg-skill) 18%, transparent)}
.mg-animate.on{background:var(--mg-accent);color:var(--mg-accent-ink)}
.mg-group-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mg-group-chip{border:1px solid var(--mg-line);background:color-mix(in srgb, var(--mg-text) 4%, transparent);color:var(--mg-text);min-height:28px;border-radius:8px;padding:0 9px;font-size:12px;font-weight:750;cursor:pointer;text-align:left;opacity:.5}
.mg-group-chip.active{border-color:color-mix(in srgb, var(--mg-skill) 45%, transparent);background:color-mix(in srgb, var(--mg-skill) 20%, transparent);opacity:1}

.mg-legend{position:absolute;left:14px;bottom:12px;z-index:15;display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 12px;border-radius:12px;background:var(--mg-glass);border:1px solid var(--mg-line);backdrop-filter:blur(12px);pointer-events:none}
.mg-legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--mg-muted)}
.mg-legend-item b{color:var(--mg-text);font-variant-numeric:tabular-nums}
.mg-legend-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}

.mg-toast{position:absolute;z-index:45;left:50%;top:18px;transform:translate(-50%,-12px);padding:10px 14px;border-radius:999px;background:var(--mg-glass);border:1px solid var(--mg-line-2);color:var(--mg-text);font-size:12px;font-weight:800;opacity:0;pointer-events:none;transition:.2s ease;box-shadow:0 16px 48px rgba(0,0,0,.35);backdrop-filter:blur(12px)}
.mg-toast.show{opacity:1;transform:translate(-50%,0)}
.mg-hint{position:absolute;z-index:14;right:16px;bottom:16px;color:color-mix(in srgb, var(--mg-text) 30%, transparent);font-size:10px;font-weight:650;pointer-events:none;max-width:40%;text-align:right}
.mg-node:focus-visible,.mg-icon-btn:focus-visible,.mg-import-btn:focus-visible,.mg-ghost-btn:focus-visible,.mg-group-chip:focus-visible,.mg-round-btn:focus-visible,.mg-hover-add:focus-visible,.mg-link-chip:focus-visible,.mg-mention-item:focus-visible,.mg-panel-icon-btn:focus-visible,.mg-section-head:focus-visible{outline:2px solid var(--mg-accent);outline-offset:2px}

@media (max-width:960px){
  .mgraph{--mg-node-scale:.92}
  .mg-inspector{right:auto;left:14px;top:56px;width:min(300px,calc(100% - 28px))}
  .mg-hint{display:none}
}
@media (max-width:680px){
  .mg-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;max-height:52%;border-radius:16px 16px 12px 12px}
  .mg-inspector{left:8px;right:8px;top:auto;bottom:calc(52% + 16px);width:auto;max-height:34%}
  .mg-dock{bottom:12px;width:calc(100% - 24px)}.mg-dock.expanded{width:calc(100% - 24px);bottom:16px}
  .mg-legend{gap:4px 10px;padding:6px 9px}.mg-legend-item{font-size:10px}
  .mg-panel-icon-btn{width:34px;height:34px}.mg-clear{width:24px;height:24px}
  .mg-icon-btn,.mg-import-btn,.mg-round-btn{height:38px}.mg-icon-btn,.mg-round-btn{width:38px}
  .mg-switch{width:40px;height:24px}.mg-slider::before{width:20px;height:20px}.mg-switch input:checked + .mg-slider::before{transform:translateX(16px)}
}
@media (prefers-reduced-motion:reduce){.mgraph *{transition:none!important;animation:none!important}}
`;
