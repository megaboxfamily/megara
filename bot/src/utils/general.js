import { MessageActionRow, MessageButton } from 'discord.js'
import { cacheBot, getBot } from '../cache-bot.js'
import { readdirSync, existsSync } from 'fs'
import { basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { directMessageError } from '../utils/error-logging.js'
import { syncChannels } from './channels.js'
import { syncRoles, requiredRoleDifference } from './roles.js'
import { pushUserToQueue } from './required-role-queue.js'
import {
  syncGuilds,
  getCommandSymbol,
  getAnnouncementChannel,
  getVerificationChannel,
  getLogChannel,
  getRules,
  getNameGuidelines,
} from '../repositories/guilds.js'
import {
  removeActiveVoiceChannelId,
  getCategoryName,
  getFormatedCommandChannels,
  getActiveVoiceChannelIds,
  channelWithVoiceChannelIsJoinable,
} from '../repositories/channels.js'

const relativePath = dirname(fileURLToPath(import.meta.url)),
  srcPath = dirname(relativePath),
  textCommandFiles = readdirSync(`${srcPath}/text-commands`),
  textCommands = textCommandFiles.map(textCommandFile => {
    return {
      baseName: basename(textCommandFile, '.js').replace(/-/g, ``),
      fullPath: `${srcPath}/text-commands/${textCommandFile}`,
    }
  })

export const validCommandSymbols = [
  `!`,
  `$`,
  `%`,
  `^`,
  `&`,
  `(`,
  `)`,
  `-`,
  `+`,
  `=`,
  `{`,
  `}`,
  `[`,
  `]`,
  `?`,
  `,`,
  `.`,
]

export async function removeEmptyVoiceChannelsOnStartup() {
  const activeVoiceChannels = await getActiveVoiceChannelIds()

  activeVoiceChannels.forEach(channel => {
    setTimeout(async () => {
      const voiceChannel = await getBot().channels.cache.get(
        channel.activeVoiceChannelId
      )
      removeVoiceChannelIfEmpty(voiceChannel)
    }, 30000)
  })
}

export async function deleteNewRoles(guild) {
  const newRole = guild.roles.cache.find(role => role.name === `new role`)

  if (!newRole) return

  await newRole.delete().catch()

  await deleteNewRoles(guild)
}

export async function startup(bot) {
  console.log(`Logged in as ${bot.user.tag}!`)

  // const guild = bot.guilds.cache.get(`711043006253367426`)

  // console.log(
  //   guild.channels.cache
  //     .get(`914280421448105985`)
  //     .permissionOverwrites.cache.get(`917933076426928148`)
  // )

  cacheBot(bot)
  await syncGuilds(bot.guilds.cache)

  bot.guilds.cache.forEach(async guild => {
    await deleteNewRoles(guild)
    await syncChannels(guild)
    await syncRoles(guild)
  })

  await removeEmptyVoiceChannelsOnStartup()
}

export async function logMessageToChannel(message) {
  const logChannelId = getLogChannel(message.guild.id)

  if (!logChannelId) return

  const currentDateTime = new Date(),
    recipientId = message.channel.recipient.id,
    guildMember = getBot().members.cache.get(recipientId)

  if (guildMember.partial) {
    try {
      await getBot().members.fetch()
    } catch (err) {
      console.log('Error fetching users: ', err)
    }
  }

  const userDisplayName = guildMember.nickname
    ? guildMember.nickname + ` (${message.channel.recipient.tag})`
    : message.channel.recipient.tag

  const messagePrefix = `**I sent the following message to ${userDisplayName} at ${currentDateTime.toISOString()}:**\n`

  getBot()
    .channels.cache.get(logChannelId)
    .send(messagePrefix + message.content)
}

export async function logErrorMessageToChannel(errorMessage, guild) {
  const logChannelId = await getLogChannel(guild.id)

  if (!logChannelId) return

  getBot().channels.cache.get(logChannelId).send(`Error: ${errorMessage}`)
}

export function removeVoiceChannelIfEmpty(voiceChannel) {
  const currentMembers = voiceChannel?.members.size

  if (!currentMembers)
    voiceChannel.delete().then(() => {
      removeActiveVoiceChannelId(voiceChannel.id)
    })
}

export async function announceNewChannel(newChannel) {
  const guild = newChannel.guild,
    announcementChannelId = await getAnnouncementChannel(guild.id)

  if (!announcementChannelId) return

  const commandChannels = await getFormatedCommandChannels(
      guild.id,
      `unrestricted`
    ),
    joinButtonRow = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(`!join-channel: ${newChannel.id}`)
        .setLabel(`Join ${newChannel.name}`)
        .setStyle('SUCCESS')
    ),
    categoryName = await getCategoryName(newChannel.parentId),
    announcementChannel = guild.channels.cache.get(announcementChannelId)

  if (announcementChannel)
    announcementChannel.send({
      content: `
        @everyone Hey guys! 😁\
        \nWe've added a new channel, <#${newChannel.id}>, in the '${categoryName}' category.\
        \nPress the button below, or use the \`!join\` command to join.\
        \nExample: \`!join ${newChannel.name}\`\

        \nThe \`!join\` command can be used in these channels: ${commandChannels}
      `,
      components: [joinButtonRow],
    })
}

export async function handleMessage(message) {
  if (message.author.bot) return
  if (!message?.guild) return

  const messageText = message.content

  if (!validCommandSymbols.includes(messageText.substring(0, 1))) return

  const commandSymbol = await getCommandSymbol(message.guild.id)

  if (messageText.substring(0, 1) !== commandSymbol) return

  const delimiter = messageText.split('').find(char => {
      if ([` `, `\n`].includes(char)) return char
      else return null
    }),
    command = delimiter
      ? messageText.substring(1, messageText.indexOf(delimiter)).toLowerCase()
      : messageText.substring(1).toLowerCase(),
    args = delimiter
      ? messageText.substring(messageText.indexOf(delimiter) + 1)
      : null,
    textCommand = textCommands.find(
      textCommand => textCommand.baseName === command
    )

  if (textCommand)
    import(textCommand.fullPath).then(module =>
      module.default(message, commandSymbol, args)
    )
  else
    message.reply(
      `
        Sorry, \`${commandSymbol}${command}\` is not a valid command 😔\
        \nUse the \`${commandSymbol}help\` command to get a valid list of commands 🥰
      `
    )
}

export async function sendVerificationInstructions(guildMember) {
  const guild = guildMember.guild,
    verificationChannelId = await getVerificationChannel(guild.id),
    verificationChannel = guild.channels.cache.get(verificationChannelId),
    undergoingVerificationRoleId = guild.roles.cache.find(
      role => role.name === `undergoing verification`
    )?.id,
    commandSymbol = await getCommandSymbol(guild.id),
    nameGuidelines = await getNameGuidelines(guild.id)

  if (!verificationChannel || !undergoingVerificationRoleId) return

  await guildMember.roles.add(undergoingVerificationRoleId)

  if (nameGuidelines)
    verificationChannel.send(
      `\
          \n<@${guildMember.id}>\
          \nBefore I can give you full access to the server you'll need to set your nickname, don't worry it's a piece of cake! 🍰\
  
          \nFirstly, please read over ${guild.name}'s name guidelines:\
          \n${nameGuidelines}\
  
          \nLastly, set your name by using the \`${commandSymbol}name\` command like this \`${commandSymbol}name [your name]\`, ex: \`${commandSymbol}name John\`\

          \n*Hint: if you're confused as to how this works, scroll up to see how others have been verified in this channel.*
        `
    )
  else
    verificationChannel.send(
      `\
          \n<@${guildMember.id}>\
          \nBefore I can give you full access to the server you'll need to set your nickname, don't worry it's a piece of cake! 🍰\
          \nTo set your name simply use the \`${commandSymbol}name\` command like this \`${commandSymbol}name [your name]\`, ex: \`${commandSymbol}name John\`\

          \n*Hint: if you're confused as to how this works, scroll up to see how others have been verified in this channel.*
        `
    )
}

export async function handleNewMember(guildMember) {
  const guild = guildMember.guild,
    rules = await getRules(guild.id),
    tosButtonRow = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(`!accept-rules: ${guildMember.guild.id}`)
        .setLabel(`Accept`)
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId(`!deny-rules: ${guildMember.guild.id}`)
        .setLabel(`Deny`)
        .setStyle('DANGER')
    )

  if (rules) {
    guildMember
      .send({
        content: `\
        \n👋 **You've been invited to join the ${guild.name} server!** 😄\

        \nBefore I can give you full access to the server's full functionality you'll need to accept their rules:\
        \n${rules}\

        \nDo you accept or deny their rules? Note that if you deny their rules you will be removed from their server.\

        \n*Hint: click one of the buttons below to accept or deny ${guild.name}'s rules.*
      `,
        components: [tosButtonRow],
      })
      .catch(error => directMessageError(error, guildMember))

    return
  }

  sendVerificationInstructions(guildMember)
}

export function modifyMember(oldMember, newMember) {
  const requiredRole = requiredRoleDifference(
    newMember.guild,
    oldMember._roles,
    newMember._roles
  )

  if (requiredRole)
    pushUserToQueue({
      guild: newMember.guild.id,
      role: requiredRole.name,
      user: newMember.id,
    })
}

export function handleInteraction(interaction) {
  if (interaction.isButton()) {
    const buttonFunctionPath = `${srcPath}/button-commands/${
      interaction.customId.match(`(?!!).+(?=:)`)[0]
    }.js`

    if (existsSync(buttonFunctionPath))
      import(buttonFunctionPath).then(module => module.default(interaction))
  }

  interaction.update({})
}

export async function checkVoiceChannelValidity(voiceState) {
  if (
    voiceState.channel &&
    (await channelWithVoiceChannelIsJoinable(voiceState.channelID)) &&
    voiceState.channel.members.size === 0
  ) {
    setTimeout(async () => {
      if (!voiceState.channel) return
      const voiceChannel = await voiceState.channel.guild.channels.cache.get(
        voiceState.channelID
      )
      removeVoiceChannelIfEmpty(voiceChannel)
    }, 30000)
  }
}