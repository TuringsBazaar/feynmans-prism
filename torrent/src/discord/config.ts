export function config(env = process.env) {
  const token = env.DISCORD_BOT_TOKEN
  const key = env.OPENROUTER_API_KEY
  const channel = env.DISCORD_CHANNEL_ID
  const model = env.PEAR_MODEL
  if (!token || !key || !channel || !model)
    throw new Error(
      'Set DISCORD_BOT_TOKEN, OPENROUTER_API_KEY, DISCORD_CHANNEL_ID and PEAR_MODEL before starting.',
    )
  if (!/^\d+$/.test(channel)) throw new Error('DISCORD_CHANNEL_ID must be a numeric Discord channel ID')
  return {
    token,
    key,
    channel,
    model,
    content: env.DISCORD_MESSAGE_CONTENT === '1',
    users:
      env.DISCORD_USER_IDS?.split(',')
        .map((id) => id.trim())
        .filter(Boolean) ?? [],
  }
}
