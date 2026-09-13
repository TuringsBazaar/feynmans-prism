// Serialized into the standalone HTML by buildView; keep browser code self-contained.
export function mountView(DATA) {
  const $ = (id) => document.getElementById(id);
  const nodes = new Map(), parents = new Map(), papers = new Map();
  const sources = new Map(DATA.sources.map((s) => [s.id, s]));
  const collapsed = new Set();
  let selected = DATA.tree.id, zoom = 1, treeWidth = 1, treeHeight = 1;
  const colors = { paper: "#c4a0ff", assumption: "#b3a0e8", conclusion: "#e0b9ff", limitation: "#dc91d0", inference: "#a78be0", open_question: "#ccadf5", related_paper: "#f0c7ff" };
  function index(n, parent, paper) {
    nodes.set(n.id, n);
    if (parent) parents.set(n.id, parent);
    if (n.kind === "paper") paper = n;
    if (paper) papers.set(n.id, paper);
    (n.children || []).forEach((child) => index(child, n, paper));
  }
  index(DATA.tree);
  // Start with the question and papers visible, rather than an enormous canvas.
  (DATA.tree.children || []).forEach((n) => { if (n.children?.length) collapsed.add(n.id); });

  function element(tag, text, attrs = {}) {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
    return e;
  }
  function svgElement(tag, attrs = {}, text) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
    if (text != null) e.textContent = text;
    return e;
  }
  function safeLink(url, title) {
    try {
      const parsed = new URL(url);
      if (["https:", "http:"].includes(parsed.protocol)) return element("a", title || url, { href: parsed.href, target: "_blank", rel: "noopener noreferrer" });
    } catch {}
    return element("span", title || url || "Unavailable");
  }
  function row(box, name, value) {
    if (value == null || value === "") return;
    const r = element("section", null, { class: "row" });
    r.append(element("h3", name, { class: "k" }));
    const content = element("div", null, { class: "v" });
    content.append(typeof value === "object" ? value : element("span", value));
    r.append(content); box.append(r);
  }
  function nodeLink(id, prefix = "") {
    const n = nodes.get(id);
    return element(n ? "button" : "span", `${prefix}[${id}] ${n?.label || "Unavailable node"}`, n ? { type: "button", "data-select": id, class: "node-link" } : {});
  }
  function links(box, label, ids) {
    const unique = [...new Set(ids)].filter((id) => id !== selected && nodes.has(id));
    if (!unique.length) return;
    const list = element("div", null, { class: "node-links" });
    unique.forEach((id) => list.append(nodeLink(id)));
    row(box, label, list);
  }
  function evidence(box, anchor, label) {
    if (!anchor) return;
    const src = sources.get(anchor.source_id);
    const valid = src && anchor.content_hash === src.content_hash && Number.isInteger(anchor.start) && Number.isInteger(anchor.end) && anchor.start >= 0 && anchor.end > anchor.start && anchor.end <= (src.body?.length || 0);
    row(box, label, valid ? element("blockquote", src.body.slice(anchor.start, anchor.end)) : "The matching source passage is unavailable in this export.");
    row(box, "Evidence location", `${src?.paper_key || anchor.source_id} · UTF-16 offsets ${anchor.start}–${anchor.end} · snapshot ${anchor.content_hash || "unknown"}`);
  }
  function detail(id) {
    const n = nodes.get(id);
    if (!n) return;
    selected = id;
    const d = n.data || {}, paper = papers.get(id), src = sources.get(n.source_id || paper?.source_id);
    const box = $("selection-detail");
    box.replaceChildren(element("div", `Node ${id} · ${n.kind.replaceAll("_", " ")}`, { class: "eyebrow" }), element("h2", n.label));
    row(box, "Review status", d.status || "Not reviewed");
    row(box, "Origin", d.origin);
    if (d.statement && d.statement !== n.label) row(box, "Statement", d.statement);
    row(box, "Review reasoning", d.review_reason);
    row(box, "Rationale", d.rationale);
    row(box, "Relationship", d.relationship);
    row(box, "Validation issue", d.reason || d.error);
    if (src) row(box, "Source paper", safeLink(src.url, `${src.paper_key} · ${src.title}`));
    if (d.match) row(box, "Relevance to the question", `${d.match.level} — ${d.match.reason || ""}`);
    if (d.match_review) row(box, "Model review of relevance", `${d.match_review.verdict} — ${d.match_review.reason || ""}`);
    evidence(box, d.evidence, "Quoted source passage");
    evidence(box, d.match?.evidence, "Passage supporting relevance");
    if (n.kind === "paper") row(box, "Evaluation scope", "This is the run’s model review against the question and retrieved passage. It does not compare this paper with the Emergent Mind reference papers.");
    links(box, "Parent", [parents.get(id)?.id]);
    if (paper && paper.id !== id && parents.get(id)?.id !== paper.id) links(box, "Paper context", [paper.id]);
    links(box, "Children", (n.children || []).map((child) => child.id));
    links(box, "Premises", d.premise_node_ids || []);
    links(box, "Conclusion", [d.conclusion_node_id]);
    links(box, "Limitation", [d.limitation_node_id]);
    links(box, "References", d.reference_ids || []);
    const incoming = [], outgoing = [], questions = [], references = [], shared = [];
    nodes.forEach((other) => {
      const data = other.data || {};
      if (data.conclusion_node_id === id) incoming.push(other.id, ...(data.premise_node_ids || []));
      if (data.premise_node_ids?.includes(id)) outgoing.push(other.id, data.conclusion_node_id);
      if (data.limitation_node_id === id) questions.push(other.id);
      if (data.reference_ids?.includes(id)) references.push(other.id);
      const a = d.evidence || d.match?.evidence, b = data.evidence || data.match?.evidence;
      if (a && b && a.source_id === b.source_id && a.content_hash === b.content_hash && a.start < b.end && b.start < a.end) shared.push(other.id);
    });
    links(box, "Supporting inferences and premises", incoming);
    links(box, "Dependent inferences and conclusions", outgoing);
    links(box, "Questions arising from this limitation", questions);
    links(box, "Referenced by", references);
    links(box, "Nodes citing overlapping source passages", shared);
    document.querySelectorAll(".diagram-node").forEach((g) => {
      const isSelected = Number(g.getAttribute("data-select")) === selected;
      g.classList.toggle("selected", isSelected);
      g.setAttribute("aria-pressed", String(isSelected));
    });
    $("detail").scrollTop = 0;
  }

  function labelLines(label) {
    const lines = [];
    let line = "";
    for (const word of label.trim().split(/\s+/)) {
      if (line && line.length + word.length + 1 > 48) { lines.push(line); line = ""; }
      let rest = word;
      while (rest.length > 48) { lines.push(rest.slice(0, 48)); rest = rest.slice(48); }
      line += (line ? " " : "") + rest;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  const nodeHeight = (n) => 28 + labelLines(n.label).length * 18;
  function nodeGraphic(svg, n, x, y, tree = false) {
    const g = svgElement("g", { transform: `translate(${x},${y})`, class: "diagram-node", "data-select": n.id, tabindex: "0", role: "button", "aria-label": `Node ${n.id}: ${n.label}`, "aria-pressed": String(n.id === selected) });
    g.classList.toggle("selected", n.id === selected);
    g.append(svgElement("title", {}, n.label));
    const height = nodeHeight(n), top = -height / 2;
    g.append(svgElement("rect", { x: -14, y: top, width: 394, height, rx: 6, class: "node-hit" }));
    g.append(svgElement("circle", { r: 12, class: "node-halo" }));
    g.append(svgElement("circle", { r: 5, fill: colors[n.kind] || "#b9a0d6", class: "node-dot" }));
    g.append(svgElement("text", { x: 20, y: top + 15, class: "node-kind" }, `${n.id} · ${n.kind.replaceAll("_", " ")} · ${n.data?.status || ""}`));
    labelLines(n.label).forEach((line, i) => g.append(svgElement("text", { x: 20, y: top + 34 + i * 18, class: "node-label" }, line)));
    svg.append(g);
    if (tree && n.children?.length) {
      const toggle = svgElement("g", { transform: `translate(${x - 26},${y})`, class: "collapse-control", "data-toggle": n.id, role: "button", tabindex: "0", "aria-label": `${collapsed.has(n.id) ? "Expand" : "Collapse"} node ${n.id}`, "aria-expanded": String(!collapsed.has(n.id)) });
      toggle.append(svgElement("circle", { r: 11 }), svgElement("text", { "text-anchor": "middle", y: 4 }, collapsed.has(n.id) ? "+" : "−"));
      svg.append(toggle);
    }
  }
  function size(svg, width, height) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    treeWidth = width; treeHeight = height;
    applyZoom();
  }
  function applyZoom() {
    const svg = $("tree-svg");
    svg.style.width = `${treeWidth * zoom}px`;
    svg.style.height = `${treeHeight * zoom}px`;
    $("zoom-level").textContent = `${Math.round(zoom * 100)}%`;
    $("zoom-out").disabled = zoom <= 0.35;
    $("zoom-in").disabled = zoom >= 2.5;
  }
  function setZoom(next, clientX, clientY) {
    const stage = $("stage"), rect = stage.getBoundingClientRect();
    const x = clientX == null ? stage.clientWidth / 2 : clientX - rect.left;
    const y = clientY == null ? stage.clientHeight / 2 : clientY - rect.top;
    const logicalX = (stage.scrollLeft + x) / zoom;
    const logicalY = (stage.scrollTop + y) / zoom;
    zoom = Math.min(2.5, Math.max(0.35, Math.round(next * 100) / 100));
    applyZoom();
    stage.scrollLeft = logicalX * zoom - x;
    stage.scrollTop = logicalY * zoom - y;
  }
  function renderTree() {
    const svg = $("tree-svg"), positions = new Map(), visible = [], heights = new Map();
    let maxDepth = 0;
    const children = (n) => collapsed.has(n.id) ? [] : (n.children || []);
    function measure(n) {
      const kids = children(n);
      const height = Math.max(nodeHeight(n) + 28, kids.reduce((sum, child) => sum + measure(child), 0));
      heights.set(n.id, height); return height;
    }
    function visit(n, depth, top) {
      maxDepth = Math.max(maxDepth, depth);
      const kids = children(n), height = heights.get(n.id);
      let childTop = top + (height - kids.reduce((sum, child) => sum + heights.get(child.id), 0)) / 2;
      kids.forEach((child) => { visit(child, depth + 1, childTop); childTop += heights.get(child.id); });
      positions.set(n.id, { x: 48 + depth * 430, y: top + height / 2 }); visible.push(n);
    }
    const height = measure(DATA.tree);
    visit(DATA.tree, 0, 20); svg.replaceChildren();
    visible.forEach((n) => {
      const parent = parents.get(n.id), p = positions.get(parent?.id), c = positions.get(n.id);
      if (p) svg.append(svgElement("path", { d: `M${p.x},${p.y} C${p.x + 390},${p.y} ${c.x - 45},${c.y} ${c.x - 7},${c.y}`, class: "tree-edge" }));
    });
    visible.forEach((n) => { const p = positions.get(n.id); nodeGraphic(svg, n, p.x, p.y, true); });
    size(svg, 450 + maxDepth * 430, Math.max(180, height + 40));
  }
  function select(id, reveal = false) {
    if (!nodes.has(id)) return;
    if (reveal) {
      let parent = parents.get(id);
      while (parent) { collapsed.delete(parent.id); parent = parents.get(parent.id); }
      renderTree();
    }
    detail(id);
    if (reveal) {
      $("tree-svg").querySelector(`[data-select="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  function activate(event) {
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    const target = event.target.closest("[data-toggle], [data-select]");
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute("data-toggle")) {
      const id = Number(target.getAttribute("data-toggle"));
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      renderTree(); detail(selected);
      $("tree-svg").querySelector(`[data-toggle="${id}"]`)?.focus();
    } else select(Number(target.getAttribute("data-select")), !target.closest("svg"));
  }
  document.addEventListener("click", activate); document.addEventListener("keydown", activate);
  $("question").textContent = DATA.run.question;
  $("meta").textContent = `${DATA.run.status} · ${DATA.stats.sources} sources · ${DATA.stats.model_calls} model calls · ${DATA.stats.tokens_reported} reported tokens`;
  $("zoom-in").onclick = () => setZoom(zoom + 0.15);
  $("zoom-out").onclick = () => setZoom(zoom - 0.15);
  $("zoom-reset").onclick = () => setZoom(1);
  $("stage").addEventListener("wheel", (event) => {
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? $("stage").clientHeight : 1;
    setZoom(zoom * Math.exp(-delta * unit * 0.0015), event.clientX, event.clientY);
  }, { passive: false });
  let pan = null;
  $("stage").addEventListener("mousedown", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    pan = { x: event.clientX, y: event.clientY, left: $("stage").scrollLeft, top: $("stage").scrollTop };
    $("stage").classList.add("panning");
  });
  document.addEventListener("mousemove", (event) => {
    if (!pan) return;
    event.preventDefault();
    $("stage").scrollLeft = pan.left - (event.clientX - pan.x);
    $("stage").scrollTop = pan.top - (event.clientY - pan.y);
  });
  document.addEventListener("mouseup", (event) => {
    if (!pan || event.button !== 1) return;
    pan = null;
    $("stage").classList.remove("panning");
  });
  $("stage").addEventListener("auxclick", (event) => { if (event.button === 1) event.preventDefault(); });
  $("expand-all").onclick = () => { collapsed.clear(); renderTree(); detail(selected); };
  $("collapse-all").onclick = () => {
    collapsed.clear();
    (DATA.tree.children || []).forEach((n) => { if (n.children?.length) collapsed.add(n.id); });
    renderTree(); detail(selected);
  };
  renderTree(); detail(selected);
}
