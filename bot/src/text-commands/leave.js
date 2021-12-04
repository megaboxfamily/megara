import { getBot } from '../cache-bot.js'
import {
  getIdForJoinableChannel,
  getCommandLevelForChannel,
} from '../repositories/channels.js'

export default async function (message, commandSymbol, channelName) {
  const commandLevel = await getCommandLevelForChannel(message.channel.id)

  if ([`prohibited`, `restricted`].includes(commandLevel)) {
    const commandChannels = await getFormatedCommandChannels(
      message.guild.id,
      `unrestricted`
    )

    message.reply(
      `
        Sorry the \`${commandSymbol}leave\` command is prohibited in this channel 😔\
        \nBut here's a list of channels you can use it in: ${commandChannels}
      `
    )

    return
  }

  if (!channelName) {
    message.reply(
      `
        Sorry the \`${commandSymbol}leave\` command requires a channel name (ex: \`${commandSymbol}leave minecraft\`) 😔\
      `
    )

    return
  }

  const joinableChannelId = await getIdForJoinableChannel(channelName),
    channel = getBot().channels.cache.get(joinableChannelId)

  if (joinableChannelId) {
    if (
      channel.permissionOverwrites.cache.filter(
        permissionOverwrite => permissionOverwrite.id === message.author.id
      ).size > 0
    ) {
      channel.permissionOverwrites
        .delete(message.author.id)
        .then(() =>
          message.reply(`You have been removed from <#${joinableChannelId}> 👋`)
        )
    } else message.reply(`You can't leave a channel you aren't a part of 🤔`)
  } else message.reply(`Sorry, ${channelName} does not exist 😔`)
}
