import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js'
import type { Message } from 'discord.js'
import { fileURLToPath } from 'node:url'
import { loadPersonas } from '../src/personas.ts'
import { config } from '../src/discord/config.ts'
import { Store } from '../src/discord/store.ts'
import { openRouter } from '../src/discord/model.ts'
import { Runner } from '../src/discord/runner.ts'
import { chunks, routeMessage } from '../src/discord/routing.ts'

const options = config()
const store = new Store(fileURLToPath(new URL('../snapshots/discord/', import.meta.url)))
const runner = new Runner(
  store,
  loadPersonas(),
  openRouter(options.key, options.model, (data) => store.event('usage', data)),
)
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
if (options.content) intents.push(GatewayIntentBits.MessageContent)
const client = new Client({ intents, allowedMentions: { parse: [], repliedUser: false } })
let accepting = false

async function send(message: Message, text: string) {
  if (!message.channel.isSendable()) throw new Error('Cannot send in this channel')
  for (const content of chunks(text)) await message.channel.send({ content, allowedMentions: { parse: [] } })
}

async function receive(message: Message) {
  if (!accepting || !client.user || !message.inGuild() || message.author.bot || message.webhookId) return
  const parent = message.channel.isThread() ? message.channel.parentId : message.channelId
  if (parent !== options.channel || (options.users.length && !options.users.includes(message.author.id)))
    return
  const knownThread = message.channel.isThread() && !!store.sessions[message.channelId]
  const mentioned = message.mentions.users.has(client.user.id)
  if (!mentioned && !(options.content && knownThread)) return
  const route = routeMessage(message.content, client.user.id, store.sessions[message.channelId]?.target)
  if (!store.claim(message.id)) return
  if (!route.command && !message.channel.isThread() && route.text && route.text.length <= 6000) {
    const thread = message.hasThread
      ? message.thread!
      : await message.startThread({
          name: route.text.slice(0, 90),
          autoArchiveDuration: 1440,
        })
    await runner.handle(thread.id, message.author.id, route, async (text) => {
      for (const content of chunks(text)) await thread.send({ content, allowedMentions: { parse: [] } })
    })
  } else await runner.handle(message.channelId, message.author.id, route, (text) => send(message, text))
}

async function ready() {
  const channel = await client.channels.fetch(options.channel)
  if (!channel || channel.type !== ChannelType.GuildText)
    throw new Error('Configured channel must be a server text channel')
  const permissions = channel.permissionsFor(client.user!)
  const required = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.CreatePublicThreads,
    PermissionFlagsBits.SendMessagesInThreads,
    PermissionFlagsBits.ReadMessageHistory,
  ]
  if (!permissions?.has(required))
    throw new Error(
      'Bot needs View Channel, Send Messages, Create Public Threads, Send Messages in Threads and Read Message History',
    )
  console.log(`Ready as ${client.user?.tag} in channel ${options.channel}; model ${options.model}`)
  accepting = true
}

client.once(Events.ClientReady, () => {
  void ready().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
    shutdown()
  })
})
client.on(Events.MessageCreate, (message) => {
  void receive(message).catch(async () => {
    console.error('Discord message handling failed; check channel permissions and connectivity.')
    await send(
      message,
      'Could not complete this request. Check bot permissions/connectivity and try again.',
    ).catch(() => {})
  })
})
client.on(Events.Error, () => console.error('Discord client error; check connectivity.'))
const checkpoint = setInterval(() => store.save(), 30000)

function shutdown() {
  accepting = false
  clearInterval(checkpoint)
  runner.stopAll()
  client.destroy()
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, shutdown)
await client.login(options.token).catch(() => {
  console.error('Discord login failed. Check the bot token and enabled Gateway intents.')
  shutdown()
  process.exitCode = 1
})
