// Headscale REST client, just enough to mint invites: find-or-create a user
// and issue a single-use pre-auth key for it. Auth is a bearer API key from
// `headscale apikeys create`. Shapes follow headscale v0.29 (`/api/v1`).

interface User {
  id: string
  name: string
}

export class Headscale {
  private readonly base: string

  constructor(
    url: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.base = url.replace(/\/+$/, '')
  }

  // Errors carry status and path only, never the body: it may echo the key.
  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(this.base + path, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`headscale ${method} ${path}: HTTP ${res.status}`)
    return (await res.json()) as T
  }

  async userId(name: string): Promise<string> {
    const found = await this.call<{ users?: User[] }>('GET', `/api/v1/user?name=${encodeURIComponent(name)}`)
    const user = found.users?.find((u) => u.name === name)
    if (user) return user.id
    const created = await this.call<{ user: User }>('POST', '/api/v1/user', { name })
    return created.user.id
  }

  async createPreAuthKey(userId: string, hours: number): Promise<string> {
    const expiration = new Date(Date.now() + hours * 3_600_000).toISOString()
    const res = await this.call<{ preAuthKey: { key: string } }>('POST', '/api/v1/preauthkey', {
      user: userId,
      reusable: false,
      ephemeral: false,
      expiration,
      aclTags: [],
    })
    return res.preAuthKey.key
  }
}
