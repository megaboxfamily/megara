import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { queueApiCall } from '../api-queue.js'

export const description = `Generates a modal that allows admins to set the vip assign message for this server.`
export const dmPermission = false,
  defaultMemberPermissions = `0`

export default async function (interaction) {
  const modal = new ModalBuilder()
      .setCustomId(`set-vip-assign-message`)
      .setTitle(`Set vip assign message`),
    nameGuidelines = new TextInputBuilder()
      .setCustomId('vip-assign-message-input')
      .setLabel('What should the vip assign message be?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(),
    firstActionRow = new ActionRowBuilder().addComponents(nameGuidelines)

  modal.addComponents(firstActionRow)

  await queueApiCall({
    apiCall: `showModal`,
    djsObject: interaction,
    parameters: modal,
  })
}
