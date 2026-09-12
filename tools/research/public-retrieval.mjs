import { paperKey } from "./runtime.mjs";

function entities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", minus: "−", hellip: "…" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name.startsWith("#")) {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return named[name] ?? whole;
  });
}

export function articleText(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (!article) throw new Error("HTML response has no paper article");
  return entities(article
    .replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<math\b[^>]*alttext="([^"]*)"[^>]*>[\s\S]*?<\/math>/gi, (_, latex) => ` $${latex}$ `)
    .replace(/<h[1-6]\b[^>]*>/gi, "\n\n# ")
    .replace(/<\/(?:p|div|section|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function getText(url, fetcher) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(40000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${new URL(url).hostname}`);
  const reader = response.body.getReader();
  const parts = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_000_000) throw new Error("Retrieval exceeds 8MB limit");
      parts.push(value);
    }
  } finally { await reader.cancel(); }
  return { text: Buffer.concat(parts).toString("utf8"), url: response.url };
}

export function publicRetrieval(fetcher = fetch) {
  return {
    async search(query, limit) {
      const url = new URL("https://api.alphaxiv.org/search/v2/paper/fast");
      url.searchParams.set("q", query); url.searchParams.set("includePrivate", "false");
      const response = await getText(url, fetcher);
      const raw = JSON.parse(response.text);
      if (!Array.isArray(raw)) throw new Error("Public search returned an unexpected response shape");
      const sources = []; const seen = new Set();
      for (const item of raw) {
        let key;
        try { key = paperKey(item.paperId ?? item.link?.replace(/^\/abs\//, "")); } catch { continue; }
        if (seen.has(key) || typeof item.title !== "string") continue;
        seen.add(key);
        sources.push({ key, title: item.title, url: `https://arxiv.org/abs/${key}`,
          abstract: item.snippet ?? "", metadata: item });
        if (sources.length === limit) break;
      }
      if (!sources.length) throw new Error("Public search returned no arXiv candidates");
      return { sources, raw, query, url: url.href, provider: "alphaxiv-public-fast" };
    },
    async fetch(source) {
      const errors = [];
      for (const host of ["https://arxiv.org/html/", "https://ar5iv.labs.arxiv.org/html/"]) {
        try {
          const response = await getText(`${host}${paperKey(source.paper_key)}`, fetcher);
          const text = articleText(response.text);
          if (text.length < 1000 || text.length > 2_000_000) throw new Error("Unusable article text length");
          return { text, raw: response.text, url: response.url, provider: "arxiv-html", parser: "article-text-v1", fetchedAt: new Date().toISOString() };
        } catch (error) { errors.push(error.message); }
      }
      // A durable unsuccessful retrieval receipt lets independent candidates
      // continue; failed HTML availability must not masquerade as paper content.
      return { error: errors.join("; "), provider: "arxiv-html" };
    },
  };
}
