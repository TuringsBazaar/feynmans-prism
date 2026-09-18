// Pure view of the problem graph: types shared by the wire, the SQLite store
// and the TUI, plus the readiness and tree computations. No I/O, so any
// module (and any test) can import it.
//
// A node is one subproblem, keyed (problemId, id) where id is the short
// `subproblemId` used on the wire (`q1`, `q2`, …). An edge src → dst means
// "src requires dst": src is ready to work on only once dst is solved. Edge
// weight is a pheromone (cf. `trails` in tools/research/schema.sql): it grows
// when solving dst measurably sped src up and decays when it did not.

export type NodeStatus = 'open' | 'solved' | 'retired'
export type NodeOrigin = 'seed' | 'fragment' | 'proposal'

export interface GraphNode {
  problemId: string
  id: string
  parentId: string | null
  text: string
  status: NodeStatus
  origin: NodeOrigin
  proposer: string | null
  createdAt: number
}

export interface GraphEdge {
  problemId: string
  src: string
  dst: string
  weight: number
}

export interface Proposal {
  id: number
  problemId: string
  parentId: string | null
  text: string
  proposer: string
  submittedAt: number
  status: 'pending' | 'approved' | 'rejected'
}

// What the coordinator broadcasts after every change; what every other pear
// renders. Small enough (tens of nodes) to resend whole rather than diff.
export interface GraphSnapshot {
  problemId: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  pending: Proposal[]
}

export interface TreeNode extends GraphNode {
  ready: boolean
  children: TreeNode[]
}

// Pheromone bounds, the same as tools/research: below the floor a road is
// dropped, above the ceiling it stops growing.
export const WEIGHT_FLOOR = 0.05
export const WEIGHT_CEIL = 10

export const clampWeight = (w: number) => Math.min(WEIGHT_CEIL, Math.max(WEIGHT_FLOOR, w))

// Open nodes whose every requirement is solved: the frontier a coordinator
// can hand out. Retired requirements count as satisfied — a dropped road is
// no longer a blocker.
export function readySet(snap: Pick<GraphSnapshot, 'nodes' | 'edges'>): Set<string> {
  const status = new Map(snap.nodes.map((n) => [n.id, n.status]))
  const blocked = new Set<string>()
  for (const e of snap.edges) {
    if (status.get(e.dst) === 'open') blocked.add(e.src)
  }
  const ready = new Set<string>()
  for (const n of snap.nodes) {
    if (n.status === 'open' && !blocked.has(n.id)) ready.add(n.id)
  }
  return ready
}

// Ids in `after` that were not ready `before`: what a fragment just unlocked.
export function newlyReady(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((id) => !before.has(id))
}

// Nodes as a forest ordered by id; a node whose parent is unknown is a root.
export function buildTree(snap: Pick<GraphSnapshot, 'nodes' | 'edges'>): TreeNode[] {
  const ready = readySet(snap)
  const byId = new Map<string, TreeNode>()
  for (const n of sortedByNumber(snap.nodes)) byId.set(n.id, { ...n, ready: ready.has(n.id), children: [] })
  const roots: TreeNode[] = []
  for (const t of byId.values()) {
    const parent = t.parentId ? byId.get(t.parentId) : undefined
    if (parent) parent.children.push(t)
    else roots.push(t)
  }
  return roots
}

// Next free `q<n>` for a problem. Counting from the highest existing number
// keeps ids stable when a node is retired.
export function nextId(nodes: Pick<GraphNode, 'id'>[]): string {
  let max = 0
  for (const n of nodes) {
    const m = /^q(\d+)$/.exec(n.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `q${max + 1}`
}

// `q2` before `q10`; anything not of that shape sorts after, alphabetically.
const qNumber = (id: string) => {
  const m = /^q(\d+)$/.exec(id)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}
function sortedByNumber<T extends { id: string }>(nodes: T[]): T[] {
  return nodes.toSorted((a, b) => qNumber(a.id) - qNumber(b.id) || a.id.localeCompare(b.id))
}

export function flatten(
  tree: TreeNode[],
  depth = 0,
): Array<{ node: TreeNode; depth: number; last: boolean }> {
  const out: Array<{ node: TreeNode; depth: number; last: boolean }> = []
  tree.forEach((node, i) => {
    out.push({ node, depth, last: i === tree.length - 1 })
    out.push(...flatten(node.children, depth + 1))
  })
  return out
}
