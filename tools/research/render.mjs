function short(text) { return text.replace(/\s+/g, " "); }

export function renderTree(root) {
  const lines = [];
  const visit = (node, prefix, last, isRoot = false) => {
    lines.push(`${prefix}${isRoot ? "" : last ? "└─ " : "├─ "}[${node.id}] ${node.kind}: ${short(node.label)}${node.data.status ? ` (${node.data.status})` : ""}`);
    const next = prefix + (isRoot ? "" : last ? "   " : "│  ");
    node.children.forEach((child, i) => visit(child, next, i === node.children.length - 1));
  };
  visit(root, "", true, true);
  return lines.join("\n");
}

function cite(item, source) {
  const e = item.evidence;
  return `[${source.paper_key}, snapshot ${source.content_hash.slice(0, 12)}, chars ${e.start}–${e.end}](${source.url})`;
}

export function renderAnswer(store) {
  const run = store.run();
  const lines = [`# ${run.question}`, "", `Run status: ${run.status}. Evidence judgments are model-reviewed, not independently established scientific truth.`, "", "## Papers and central arguments", ""];
  const entries = store.sources().map((s) => ({ source: s, argument: store.graph(s.id) }))
    .filter((e) => e.argument?.review)
    .sort((a, b) => Number(b.argument.graph.match.level === "direct") - Number(a.argument.graph.match.level === "direct") || a.source.id - b.source.id);
  if (!entries.length) lines.push("No source has completed evidence review. Inspect the action errors and stored tree.", "");
  for (const { source, argument } of entries) {
    const graph = argument.graph;
    const verdict = Object.fromEntries(argument.review.items.map((i) => [i.id, i.verdict]));
    lines.push(`### ${source.title}`, "", `${source.url}`, "");
    lines.push(`Source match: **${graph.match.level}** (${verdict.match}). ${graph.match.reason} ${cite(graph.match, source)}`, "");
    const nodes = graph.nodes.filter((n) => verdict[n.id] === "supported");
    for (const n of nodes) lines.push(`- **${n.id} · ${n.kind} · ${n.origin}:** ${n.statement} ${cite(n, source)}`);
    for (const i of graph.inferences.filter((i) => verdict[i.id] === "supported")) {
      lines.push(`- **${i.id}:** {${i.premises.join(" AND ")}} → ${i.conclusion} (${i.kind}). ${cite(i, source)}`);
    }
    if (!nodes.length) lines.push("No argument nodes were supported by this review.");
    lines.push("", "#### Remaining open questions", "");
    const questions = graph.open_questions.filter((q) => verdict[q.id] === "supported");
    for (const q of questions) lines.push(`- ${q.statement} (${q.origin}; limitation ${q.limitation_node}). ${cite(q, source)}`);
    if (!questions.length) lines.push("No open question was supported by the supplied excerpts and review; this does not establish that none exist.");
    lines.push("", "#### Related papers and browsing leads", "");
    const related = graph.related_papers.filter((p) => verdict[p.id] === "supported");
    for (const p of related) lines.push(`- **${p.title}** (${p.relationship}). ${p.rationale} ${cite(p, source)}`);
    if (!related.length) lines.push("No browsing lead completed support review.");
    const omitted = argument.review.items.filter((i) => i.verdict !== "supported").length;
    lines.push("", `${omitted} uncertain or unsupported items remain visible in the tree. Open-question status is scoped to the stored source snapshot.`, "");
    if (graph.validation_issues?.length) lines.push(`${graph.validation_issues.length} malformed structural links were quarantined before review and remain in the tree for inspection.`, "");
  }
  const userNodes = store.db.prepare("SELECT id,parent_id,label,data FROM tree_nodes WHERE origin='user' ORDER BY id").all();
  if (userNodes.length) {
    lines.push("## Appended analysis", "");
    for (const n of userNodes) lines.push(`- [${n.id}, parent ${n.parent_id}] **${n.label}:** ${JSON.parse(n.data).statement} (user-added; outside automated review)`);
  }
  const stats = store.stats();
  lines.push("", "## Execution", "", `${stats.sources} sources; ${stats.model_calls} model calls; ${stats.tokens_reported} reported tokens; ${stats.tokens_reserved_unknown} tokens reserved for incomplete usage receipts; ${stats.elapsed_ms} ms of recorded action time.`);
  for (const failure of stats.failed) lines.push(`- Action ${failure.id} (${failure.kind}): ${failure.error}`);
  return lines.join("\n");
}
