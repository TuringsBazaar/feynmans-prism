// The problem graph on disk: nodes, dependency edges and the queue of
// human-proposed subproblems. SQLite via node:sqlite (no native dependency),
// so it survives restarts and can be inspected with any sqlite client.
//
// Only the coordinator writes. Every other pear keeps the snapshot the
// coordinator broadcasts (restructure.ts), and a pear that becomes
// coordinator absorbs that snapshot into its own file first, so the graph
// outlives any single coordinator.

import { DatabaseSync } from 'node:sqlite'
import { PLACEHOLDER, type Problem } from './data.ts'
import {
  clampWeight,
  nextId,
  WEIGHT_FLOOR,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshot,
  type NodeOrigin,
  type NodeStatus,
  type Proposal,
} from './tree.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
  problem_id TEXT NOT NULL, id TEXT NOT NULL, parent_id TEXT, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', origin TEXT NOT NULL, proposer TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (problem_id, id));
CREATE TABLE IF NOT EXISTS edges (
  problem_id TEXT NOT NULL, src TEXT NOT NULL, dst TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1, PRIMARY KEY (problem_id, src, dst));
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY, problem_id TEXT NOT NULL, parent_id TEXT, text TEXT NOT NULL,
  proposer TEXT NOT NULL, submitted_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
`

// node:sqlite rows are snake_case; the rest of the pear speaks camelCase.
type Row = Record<string, unknown>
const toNode = (r: Row): GraphNode => ({
  problemId: r.problem_id as string,
  id: r.id as string,
  parentId: (r.parent_id as string | null) ?? null,
  text: r.text as string,
  status: r.status as NodeStatus,
  origin: r.origin as NodeOrigin,
  proposer: (r.proposer as string | null) ?? null,
  createdAt: r.created_at as number,
})
const toEdge = (r: Row): GraphEdge => ({
  problemId: r.problem_id as string,
  src: r.src as string,
  dst: r.dst as string,
  weight: r.weight as number,
})
const toProposal = (r: Row): Proposal => ({
  id: r.id as number,
  problemId: r.problem_id as string,
  parentId: (r.parent_id as string | null) ?? null,
  text: r.text as string,
  proposer: r.proposer as string,
  submittedAt: r.submitted_at as number,
  status: r.status as Proposal['status'],
})

export interface AddNodeOptions {
  id?: string
  parentId?: string | null
  origin: NodeOrigin
  proposer?: string | null
  status?: NodeStatus
}

export class Graph {
  private db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
    this.db.exec(SCHEMA)
  }

  close() {
    this.db.close()
  }

  // Idempotent: the hardcoded subproblems in data.ts become `q1…qN` once;
  // later runs leave whatever the graph has grown into alone.
  seed(problems: Problem[]) {
    const ins = this.db.prepare(
      `INSERT OR IGNORE INTO nodes (problem_id, id, parent_id, text, status, origin, proposer, created_at)
       VALUES (?, ?, NULL, ?, 'open', 'seed', NULL, ?)`,
    )
    for (const p of problems) {
      if (p.subproblems === PLACEHOLDER) continue
      p.subproblems.forEach((s, i) => ins.run(p.id, `q${i + 1}`, s.text, Date.now()))
    }
  }

  problems(): string[] {
    const rows = this.db.prepare('SELECT DISTINCT problem_id FROM nodes ORDER BY problem_id').all() as Row[]
    return rows.map((r) => r.problem_id as string)
  }

  node(problemId: string, id: string): GraphNode | null {
    const r = this.db.prepare('SELECT * FROM nodes WHERE problem_id = ? AND id = ?').get(problemId, id) as
      Row | undefined
    return r ? toNode(r) : null
  }

  nodes(problemId: string): GraphNode[] {
    const rows = this.db
      .prepare('SELECT * FROM nodes WHERE problem_id = ? ORDER BY created_at, id')
      .all(problemId)
    return (rows as Row[]).map(toNode)
  }

  edges(problemId: string): GraphEdge[] {
    const rows = this.db.prepare('SELECT * FROM edges WHERE problem_id = ? ORDER BY src, dst').all(problemId)
    return (rows as Row[]).map(toEdge)
  }

  addNode(problemId: string, text: string, opts: AddNodeOptions): GraphNode {
    const id = opts.id ?? nextId(this.nodes(problemId))
    this.db
      .prepare(
        `INSERT INTO nodes (problem_id, id, parent_id, text, status, origin, proposer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        problemId,
        id,
        opts.parentId ?? null,
        text,
        opts.status ?? 'open',
        opts.origin,
        opts.proposer ?? null,
        Date.now(),
      )
    return this.node(problemId, id) as GraphNode
  }

  setStatus(problemId: string, id: string, status: NodeStatus) {
    this.db.prepare('UPDATE nodes SET status = ? WHERE problem_id = ? AND id = ?').run(status, problemId, id)
  }

  // src requires dst. Re-linking resets the weight.
  link(problemId: string, src: string, dst: string, weight = 1) {
    this.db
      .prepare('INSERT OR REPLACE INTO edges (problem_id, src, dst, weight) VALUES (?, ?, ?, ?)')
      .run(problemId, src, dst, clampWeight(weight))
  }

  unlink(problemId: string, src: string, dst: string) {
    this.db.prepare('DELETE FROM edges WHERE problem_id = ? AND src = ? AND dst = ?').run(problemId, src, dst)
  }

  // Scale every road into `dst` by the amplification its solution produced.
  // Roads that decay to the floor are dropped and returned: a dependency that
  // never sped anything up was not a dependency.
  reinforce(problemId: string, dst: string, factor: number): GraphEdge[] {
    const dropped: GraphEdge[] = []
    for (const e of this.edges(problemId)) {
      if (e.dst !== dst) continue
      const w = e.weight * factor
      if (w < WEIGHT_FLOOR) {
        this.unlink(problemId, e.src, e.dst)
        dropped.push({ ...e, weight: w })
      } else this.link(problemId, e.src, e.dst, w)
    }
    return dropped
  }

  // ---- proposals: humans propose, the batch is reviewed later -------------

  propose(problemId: string, parentId: string | null, text: string, proposer: string): Proposal {
    const r = this.db
      .prepare(
        `INSERT INTO proposals (problem_id, parent_id, text, proposer, submitted_at)
         VALUES (?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(problemId, parentId, text, proposer, Date.now()) as Row
    return toProposal(r)
  }

  pending(problemId?: string): Proposal[] {
    const rows = problemId
      ? this.db
          .prepare(`SELECT * FROM proposals WHERE status = 'pending' AND problem_id = ? ORDER BY id`)
          .all(problemId)
      : this.db.prepare(`SELECT * FROM proposals WHERE status = 'pending' ORDER BY id`).all()
    return (rows as Row[]).map(toProposal)
  }

  // Settle a batch. Approved proposals become nodes (a parent that no longer
  // exists is dropped rather than failing the batch). Returns what changed.
  review(ids: number[], verdict: 'approved' | 'rejected'): Proposal[] {
    const settled: Proposal[] = []
    for (const id of ids) {
      const r = this.db.prepare(`SELECT * FROM proposals WHERE id = ? AND status = 'pending'`).get(id) as
        Row | undefined
      if (!r) continue
      const p = { ...toProposal(r), status: verdict }
      this.db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run(verdict, id)
      if (verdict === 'approved') this.materialize(p)
      settled.push(p)
    }
    return settled
  }

  private materialize(p: Proposal) {
    const parentId = p.parentId && this.node(p.problemId, p.parentId) ? p.parentId : null
    const n = this.addNode(p.problemId, p.text, { parentId, origin: 'proposal', proposer: p.proposer })
    if (parentId) this.link(p.problemId, n.id, parentId)
  }

  // ---- snapshots ----------------------------------------------------------

  snapshot(problemId: string): GraphSnapshot {
    return {
      problemId,
      nodes: this.nodes(problemId),
      edges: this.edges(problemId),
      pending: this.pending(problemId),
    }
  }

  // Take over a broadcast snapshot verbatim: what a new coordinator does
  // with the last state it saw from the previous one.
  absorb(snap: GraphSnapshot) {
    const upsertNode = this.db.prepare(
      `INSERT OR REPLACE INTO nodes (problem_id, id, parent_id, text, status, origin, proposer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const upsertProposal = this.db.prepare(
      `INSERT OR REPLACE INTO proposals (id, problem_id, parent_id, text, proposer, submitted_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    this.db.exec('BEGIN')
    this.db.prepare('DELETE FROM edges WHERE problem_id = ?').run(snap.problemId)
    for (const n of snap.nodes)
      upsertNode.run(n.problemId, n.id, n.parentId, n.text, n.status, n.origin, n.proposer, n.createdAt)
    for (const e of snap.edges) this.link(e.problemId, e.src, e.dst, e.weight)
    for (const p of snap.pending)
      upsertProposal.run(p.id, p.problemId, p.parentId, p.text, p.proposer, p.submittedAt, p.status)
    this.db.exec('COMMIT')
  }
}
