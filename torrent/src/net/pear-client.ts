import type { ClientMessage, StateMessage } from '../types'

interface Handlers {
  onState: (msg: StateMessage) => void
  onOpen: () => void
  onClose: () => void
}

// Default to the local sidecar; override with VITE_PEAR_WS_URL when needed.
const WS_URL = (import.meta.env.VITE_PEAR_WS_URL as string | undefined) ?? 'ws://127.0.0.1:8787'

let socket: WebSocket | null = null
let handlers: Handlers | null = null

export function connect(next: Handlers): { close: () => void } {
  handlers = next
  const ws = new WebSocket(WS_URL)
  socket = ws

  ws.onopen = () => handlers?.onOpen()
  ws.onmessage = (event: MessageEvent<string>) => {
    if (handlers !== next) return
    const msg: unknown = JSON.parse(event.data)
    if (isStateMessage(msg)) handlers.onState(msg)
  }
  ws.onclose = () => {
    if (socket === ws) socket = null
    handlers?.onClose()
  }
  ws.onerror = () => {}

  return {
    close: () => {
      if (socket !== ws) return
      socket = null
      ws.close()
    },
  }
}

export function send(msg: ClientMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}

function isStateMessage(msg: unknown): msg is StateMessage {
  return typeof msg === 'object' && msg !== null && (msg as StateMessage).t === 'state'
}