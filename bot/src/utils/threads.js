import { ChannelType } from 'discord.js'
import { queueApiCall } from '../api-queue.js'
import { getChannelRecordById } from '../repositories/channels.js'
import { checkIfMemberIsPermissible } from './channels.js'

export async function getThreadById(channel, threadId) {
  if (!channel || !threadId) return

  const { threads } = channel

  let thread = threads.cache.get(threadId)

  if (!thread) {
    const archivedPrivateThreads = await queueApiCall({
      apiCall: `fetchArchived`,
      djsObject: threads,
      parameters: { type: `private`, fetchAll: true },
    })

    const archivedPublicThreads = await queueApiCall({
      apiCall: `fetchArchived`,
      djsObject: threads,
      parameters: { type: `public`, fetchAll: true },
    })

    const privateThread = archivedPrivateThreads.threads.get(threadId),
      publicThread = archivedPublicThreads.threads.get(threadId)

    thread = privateThread ? privateThread : publicThread
  }

  return thread
}

export async function getThreadByName(channel, threadName) {
  if (!channel || !threadName) return

  let thread = channel.threads.cache.find(thread => thread.name === threadName)

  if (!thread && channel.type !== ChannelType.GuildForum) {
    const archivedPrivateThreads = await queueApiCall({
      apiCall: `fetchArchived`,
      djsObject: channel.threads,
      parameters: { type: `private`, fetchAll: true },
    }).catch(error =>
      console.log(
        `I was unable to fetch archived private threads, see error below.\n${error}`
      )
    )

    const archivedPublicThreads = await queueApiCall({
      apiCall: `fetchArchived`,
      djsObject: channel.threads,
      parameters: { type: `public`, fetchAll: true },
    }).catch(error =>
      console.log(
        `I was unable to fetch archived public threads, see error below.\n${error}`
      )
    )

    const privateThread = archivedPrivateThreads?.threads.find(
        thread => thread.name === threadName
      ),
      publicThread = archivedPublicThreads?.threads.find(
        thread => thread.name === threadName
      )

    thread = privateThread ? privateThread : publicThread
  }

  return thread
}

export async function unarchiveThread(thread) {
  if (!thread || !thread?.archived) return

  await queueApiCall({
    apiCall: `setArchived`,
    djsObject: thread,
    parameters: false,
  })
}

export async function addMemberToThread(thread, member) {
  if (!thread || !member || thread.members.cache.get(member.id)) return

  const addMessage = await thread.send(`${member}`)

  await addMessage.delete()

  // await newThread?.members
  //   .add(guildMember.id)
  //   .catch(error =>
  //     console.log(`Could not add member to thread, see error below\n${error}`)
  //   )
}

export async function addVoiceMemberToParentThread(voiceChannel, member) {
  if (!voiceChannel || !member) return

  const { guild } = voiceChannel,
    channelRecord = await getChannelRecordById(voiceChannel.id),
    { parentTextChannelId, parentThreadId } = channelRecord

  if (!parentThreadId) return

  const parentTextChannel = guild.channels.cache.get(parentTextChannelId)

  if (!parentTextChannel) return

  const memberIsPermissible = checkIfMemberIsPermissible(voiceChannel, member)

  if (!memberIsPermissible) return

  const thread = guild.channels.cache.get(parentThreadId)

  if (!thread) return

  await unarchiveThread(thread)

  const { members } = thread

  if (!members.cache.get(member.id))
    await queueApiCall({
      apiCall: `add`,
      djsObject: members,
      parameters: member.id,
    })
}
