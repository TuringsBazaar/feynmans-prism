// Browser visualizer for a SQLite research tree.
//
// Distinct from render.mjs: render.mjs produces CLI text (a Unicode tree and a
// Markdown answer). This module produces a single self-contained HTML page that
// renders the same data as an interactive SVG diagram with no external
// dependencies (no D3, no CDN). Layouts are computed once per interaction
// (static, on demand) — there is no simulation and no continuous animation.

import { mountView } from "./view-client.mjs";

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; background: #120d1c; color: #eee6f8; font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
body { display: flex; flex-direction: column; }
header { padding: 12px 18px; border-bottom: 1px solid #3b2953; }
header h1 { margin: 0 0 4px; font-size: 15px; }
.meta, .eyebrow { color: #bba6ce; font-size: 12px; }
#toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 18px; }
button { font: inherit; color: inherit; background: #241632; border: 1px solid #654880; border-radius: 6px; padding: 6px 12px; }
button { cursor: pointer; }
button:hover { background: #402457; }
button.active { background: #633687; }
button:disabled { cursor: default; opacity: .45; }
.section-title { font-size: 13px; font-weight: 650; letter-spacing: .03em; margin-right: 4px; }
#zoom-controls { display: inline-flex; align-items: center; gap: 5px; padding-left: 7px; border-left: 1px solid #3b2953; }
#zoom-controls button { min-width: 34px; padding-inline: 9px; }
#zoom-level { min-width: 48px; text-align: center; color: #bba6ce; font-variant-numeric: tabular-nums; }
.hint { margin-left: auto; color: #bba6ce; font-size: 12px; }
#main { display: grid; grid-template-columns: minmax(0, 1fr) clamp(320px, 36vw, 520px); flex: 1; min-height: 0; border-top: 1px solid #3b2953; }
#stage { min-width: 0; overflow: auto; padding: 12px; }
#stage.panning, #stage.panning * { cursor: grabbing !important; user-select: none; }
.canvas-help-wrap { position: sticky; top: 0; left: 0; z-index: 5; height: 0; pointer-events: none; }
.canvas-help { display: inline-block; margin: 8px; padding: 6px 9px; color: #d9c3eb; background: rgba(36, 22, 50, .92); border: 1px solid #654880; border-radius: 7px; box-shadow: 0 4px 14px rgba(0, 0, 0, .25); }
svg { display: block; background: #170f22; border-radius: 8px; }
svg text { fill: #f1e8fc; }
.node-kind { font-size: 10px; fill: #b99cd4; }
.node-label { font-size: 13px; }
.node-label, .node-kind { paint-order: stroke; stroke: #170f22; stroke-width: 5px; stroke-linejoin: round; }
.node-hit { fill: transparent; stroke: none; }
.node-dot { stroke: #dec4f5; stroke-width: 1; }
.node-halo { fill: transparent; stroke: transparent; stroke-width: 2; }
.diagram-node, .collapse-control { cursor: pointer; }
.diagram-node:hover .node-halo, .diagram-node:focus .node-halo { stroke: #8861aa; }
.diagram-node.selected .node-halo { fill: #603486; stroke: #d2a7f5; }
.diagram-node.selected .node-label { fill: #e1b8ff; }
.collapse-control circle { fill: #2d1b40; stroke: #bd90e8; }
.collapse-control:focus circle { stroke: white; stroke-width: 3; }
.tree-edge { fill: none; stroke: #6c4c85; stroke-width: 2; }
#detail { min-width: 0; border-left: 1px solid #3b2953; padding: 18px; overflow-y: auto; overflow-wrap: anywhere; }
#detail h2 { font-size: 18px; line-height: 1.4; margin: 6px 0 20px; }
.row { margin: 0 0 18px; }
.k { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #bba6ce; }
.v { white-space: pre-wrap; }
a { color: #d5aaff; }
blockquote { margin: 0; border-left: 3px solid #a16bcc; padding: 8px 12px; background: #21152f; white-space: pre-wrap; }
.node-links { display: grid; gap: 7px; }
.node-link { display: block; width: 100%; padding: 9px 10px; text-align: left; white-space: normal; overflow-wrap: anywhere; }
:focus-visible { outline: 2px solid #e4c2ff; outline-offset: 3px; }
@media (max-width: 700px) {
  #main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(160px, 44%) minmax(0, 1fr); }
  #detail { border-left: 0; border-top: 1px solid #3b2953; padding: 14px; }
  header h1 { font-size: 13px; max-height: 80px; overflow: auto; }
  .hint { margin-left: 0; }
}
`;

export function buildView(store) {
  const run = store.run();
  const sources = store.sources().map((s) => ({
    id: s.id,
    title: s.title,
    url: s.url,
    paper_key: s.paper_key,
    content_hash: s.content_hash,
    body: s.body,
  }));
  const tree = store.tree();
  const stats = store.stats();
  const data = {
    run: { question: run.question, status: run.status },
    stats,
    sources,
    tree,
  };

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>research tree — view</title>",
    "<style>" + CSS + "</style>",
    "</head>",
    "<body>",
    '<header><h1 id="question"></h1><div class="meta" id="meta"></div></header>',
    '<div id="toolbar">',
    '<span class="section-title">Tree</span>',
    '<span><button id="expand-all">Expand all</button> <button id="collapse-all">Paper overview</button></span>',
    '<span id="zoom-controls" aria-label="Tree zoom controls"><button id="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button id="zoom-reset" title="Reset zoom"><span id="zoom-level">100%</span></button><button id="zoom-in" title="Zoom in" aria-label="Zoom in">+</button></span>',
    '<span class="hint">Scroll to zoom · press the mouse wheel and drag to pan</span>',
    "</div>",
    '<div id="main">',
    '<div id="stage">',
    '<div class="canvas-help-wrap"><div class="canvas-help">Scroll wheel: zoom · Hold mouse wheel + drag: pan</div></div>',
    '<div id="tree-panel"><svg id="tree-svg"></svg></div>',
    "</div>",
    '<aside id="detail" aria-label="Selected node details"><div id="selection-detail" aria-live="polite"></div></aside>',
    "</div>",
    "<script>",
    "var DATA = " + escapeJson(data) + ";\n(" + mountView.toString() + ")(DATA);",
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");
}
