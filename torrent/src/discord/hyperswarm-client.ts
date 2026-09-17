// Discord bot's connection to a Hyperswarm room. Listens for fragment activity
// and peer events, records them, and can inject messages back into the swarm.

import Hyperswarm from 'hyperswarm'
import { peerId, readLines, writeAll, type PeerSocket } from '../room.ts'
import { parseChat, parseControl, type Control } from '../wire.ts'
import { encodeControl } from '../wire.ts'

export interface RoomEvent {
  kind: 'fragment-submit' | 'fragment-velocity' | 'compute-provide' | 'peer-join' | 'peer-leave' | 'chat'
  timestamp: number
  data: Record<string, unknown>
}

export class DiscordHyperswarmClient {
  private swarm: Hyperswarm | null = null
  private peers = new Map<string, PeerSocket>()
  private events: RoomEvent[] = []
  private maxEvents = 100

  private handleSubmitFragmentMsg(m: Extract<Control, { t: 'submit-fragment' }>) {
    this.recordEvent('fragment-submit', {
      problemId: m.problemId,
      subproblemId: m.subproblemId,
      contentPreview: m.content.slice(0, 100),
    })
  }

  private handleReportVelocityMsg(m: Extract<Control, { t: 'report-velocity' }>) {
    this.recordEvent('fragment-velocity', {
      fragmentId: m.fragmentId,
      amplificationFactor: m.amplificationFactor,
    })
  }

  private handleComputeProvideMsg(m: Extract<Control, { t: 'compute-provide' }>) {
    this.recordEvent('compute-provide', {
      computeUnits: m.computeUnits,
      role: m.role,
    })
  }

  private handleAssignFragmentMsg(m: Extract<Control, { t: 'assign-fragment' }>) {
    this.recordEvent('fragment-submit', {
      problemId: m.problemId,
      subproblemId: m.subproblemId,
      contentPreview: 'assignment',
    })
  }

  private handleControlMessage(msg: Partial<Control> & { t: string }) {
    switch (msg.t) {
      case 'submit-fragment':
        return this.handleSubmitFragmentMsg(msg as Extract<Control, { t: 'submit-fragment' }>)
      case 'report-velocity':
        return this.handleReportVelocityMsg(msg as Extract<Control, { t: 'report-velocity' }>)
      case 'compute-provide':
        return this.handleComputeProvideMsg(msg as Extract<Control, { t: 'compute-provide' }>)
      case 'assign-fragment':
        return this.handleAssignFragmentMsg(msg as Extract<Control, { t: 'assign-fragment' }>)
    }
  }

  async connect(roomTopic: string): Promise<void> {
    this.swarm = new Hyperswarm()
    const discovery = this.swarm.join(Buffer.from(roomTopic, 'utf8'), { client: true, server: false })
    this.swarm.on('connection', (socket) => this.onConnection(socket))
    await discovery.flushed()
  }

  private onConnection(socket: PeerSocket) {
    const rid = peerId(socket)
    this.peers.set(rid, socket)
    readLines(socket, (raw) => {
      const msg = parseControl(raw)
      if (msg === null) {
        const chat = parseChat(raw)
        if (chat) this.recordEvent('chat', { from: chat.from, text: chat.text })
        return
      }
      this.handleControlMessage(msg)
    })
  }

  private recordEvent(kind: RoomEvent['kind'], data: Record<string, unknown>) {
    this.events.push({ kind, timestamp: Date.now(), data })
    if (this.events.length > this.maxEvents) this.events.shift()
  }

  getRecent(limit: number = 20): RoomEvent[] {
    return this.events.slice(-limit)
  }

  broadcast(msg: Control): void {
    if (!this.swarm) return
    writeAll(this.swarm.connections, encodeControl(msg))
  }

  async disconnect(): Promise<void> {
    if (this.swarm) {
      await this.swarm.destroy()
      this.swarm = null
    }
    this.peers.clear()
  }
}
