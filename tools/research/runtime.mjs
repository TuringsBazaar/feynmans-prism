import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Import leaf APIs from a Feynman installation; never import its entry point.
export async function loadRuntime(root, authPath) {
  if (!root || !existsSync(join(root, "package.json"))) {
    throw new Error("--runtime-root must name the Feynman app directory containing package.json and node_modules");
  }
  const load = (name) => {
    const segments = name.split("/");
    const packageName = segments.slice(0, 2).join("/");
    const subpath = segments.length === 2 ? "." : `./${segments.slice(2).join("/")}`;
    const directory = join(resolve(root), "node_modules", packageName);
    const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    const entry = metadata.exports?.[subpath];
    const target = typeof entry === "string" ? entry : entry?.import ?? entry?.default;
    if (typeof target !== "string") throw new Error(`No public import export for ${name}`);
    return import(pathToFileURL(join(directory, target)).href);
  };
  const { ModelRuntime } = await load("@earendil-works/pi-coding-agent");
  const auth = resolve(authPath ?? join(process.env.FEYNMAN_HOME ?? homedir(), ".feynman/agent/auth.json"));
  const runtime = await ModelRuntime.create({
    authPath: auth,
    modelsPath: join(dirname(auth), "models.json"),
    allowModelNetwork: false,
  });
  return { runtime, load };
}

export async function doctor(root, authPath) {
  const { runtime } = await loadRuntime(root, authPath);
  return runtime.getProviders().map((p) => typeof p === "string" ? p : p.id)
    .filter((id) => runtime.getProviderAuthStatus(id).configured)
    .map((id) => ({
      provider: id,
      models: runtime.getModels(id).map((m) => m.id)
        .filter((id) => /haiku|flash|mini|sonnet|gpt-5|deepseek/i.test(id)).slice(0, 20),
    }));
}

export function paperKey(value) {
  const match = String(value ?? "").match(/(?:^|\/)(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?(?:$|[?#])/i);
  if (!match) throw new Error(`Unsupported arXiv identifier: ${value}`);
  return match[1];
}

export function contentText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).join("\n");
  if (value && typeof value === "object") {
    for (const key of ["fullText", "full_text", "text", "markdown", "content"]) {
      if (value[key] !== undefined) return contentText(value[key]);
    }
  }
  throw new Error("Paper endpoint returned no recognizable text field");
}

export async function createBackend(config) {
  const { runtime, load } = await loadRuntime(config.runtimeRoot, config.authPath);
  const model = runtime.getModel(config.provider, config.model);
  if (!model) throw new Error(`Unknown model ${config.provider}/${config.model}; use doctor`);
  if (!runtime.getProviderAuthStatus(config.provider).configured) {
    throw new Error(`No configured credentials for ${config.provider}; configure them in Feynman`);
  }
  const usePublic = config.retrieval === "public";
  const alpha = usePublic ? null : await load("@companion-ai/alpha-hub/lib");
  const papers = usePublic ? null : await load("@companion-ai/alpha-hub/lib/alphaxiv");
  const backend = {
    async search(query, limit) {
      const response = await alpha.searchPapers(query, "semantic", { includeRaw: true });
      const seen = new Set();
      const sources = [];
      for (const item of response.results ?? []) {
        let key;
        try { key = paperKey(item.arxivId ?? item.arxivUrl); } catch { continue; }
        if (seen.has(key) || !item.title) continue;
        seen.add(key);
        sources.push({ key, title: item.title, url: `https://arxiv.org/abs/${key}`, abstract: item.abstract ?? "", metadata: item });
        if (sources.length === limit) break;
      }
      if (!sources.length) throw new Error("Paper search returned no usable arXiv sources");
      return { sources, raw: response.raw ?? response, provider: "alpha-semantic" };
    },
    async fetch(source) {
      const raw = await papers.getPaperContent(source.url, { fullText: true });
      const text = contentText(raw).replace(/\r\n/g, "\n").trim();
      if (text.length < 1000) throw new Error("Full-text response is too short for argument reconstruction");
      if (text.length > 2_000_000) throw new Error("Full-text response exceeds the prototype's 2M-character limit");
      return { text, raw, provider: "alpha-full-text", fetchedAt: new Date().toISOString() };
    },
    async complete(system, data, maxTokens, signal) {
      const message = await runtime.completeSimple(model, {
        systemPrompt: system,
        messages: [{ role: "user", content: JSON.stringify(data), timestamp: Date.now() }],
      }, { maxTokens, reasoning: "minimal", signal });
      // Retain terminal metadata and usage even for errors or truncation.
      return {
        text: message.content.filter((p) => p.type === "text").map((p) => p.text).join("\n"),
        usage: message.usage ?? null,
        stopReason: message.stopReason,
        error: message.errorMessage ?? null,
        provider: message.provider ?? config.provider,
        model: message.model ?? config.model,
      };
    },
    close: () => papers?.disconnect(),
  };
  if (usePublic) Object.assign(backend, (await import("./public-retrieval.mjs")).publicRetrieval());
  return backend;
}
