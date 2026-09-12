import { createHash } from "node:crypto";

export function randomFor(seed, step) {
  let n = createHash("sha256").update(`${seed}:${step}`).digest().readUInt32LE(0);
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function transition(action, all) {
  return `${all.find((a) => a.id === action.parent_id)?.kind ?? "root"}->${action.kind}`;
}

function draw(items, weight, random) {
  const weights = items.map(weight);
  let n = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    n -= weights[i];
    if (n < 0) return items[i];
  }
  return items.at(-1);
}

export function chooseAction(all, trails, config, step) {
  const frontier = all.filter((a) => a.status === "pending" &&
    (a.parent_id === null || all.some((p) => p.id === a.parent_id && p.status === "done")));
  if (!frontier.length) return null;
  frontier.sort((a, b) => a.id - b.id);
  if (config.policy === "greedy") {
    const action = [...frontier].sort((a, b) => b.eta - a.eta || a.id - b.id)[0];
    return { action, trace: { policy: "greedy", eligible: frontier.map((a) => a.id) } };
  }
  const random = randomFor(config.seed, step);
  const weight = (a) => (trails[transition(a, all)] ?? 1) ** config.alpha * a.eta ** config.beta;
  const paths = [];
  const votes = new Map(frontier.map((a) => [a.id, 0]));
  // Cheap traversals of the pending dependency graph; only the selected first
  // action executes. Simulated paths never earn pheromone deposits.
  for (let ant = 0; ant < config.ants; ant++) {
    let action = random() < config.epsilon
      ? frontier[Math.floor(random() * frontier.length)] : draw(frontier, weight, random);
    const path = [action];
    for (let hop = 1; hop < config.hops; hop++) {
      const children = all.filter((a) => a.parent_id === action.id && a.status === "pending");
      if (!children.length) break;
      action = draw(children, weight, random);
      path.push(action);
    }
    const utility = path.reduce((sum, a) => sum + a.eta, 0) / path.length;
    votes.set(path[0].id, votes.get(path[0].id) + utility);
    paths.push(path.map((a) => a.id));
  }
  const action = draw(frontier, (a) => votes.get(a.id) + 0.01, random);
  return { action, trace: { policy: "aco", paths, votes: Object.fromEntries(votes), selected: action.id } };
}

export function relevance(question, paper) {
  const terms = (text) => new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const query = terms(question);
  const text = terms(`${paper.title} ${paper.abstract}`);
  return query.size ? [...query].filter((t) => text.has(t)).length / query.size : 0;
}
