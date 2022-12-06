import { ApplicationCommandOptionType } from 'discord.js'
import { getWorldId, createWorld } from '../repositories/coordinates.js'

export const description = `Allows you to create a world record in the worlds table for Minecraft.`
export const dmPermission = false,
  defaultMemberPermissions = `0`,
  options = [
    {
      name: `world-name`,
      description: `The name of the world you'd like to create 😈`,
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ]

export default async function (interaction) {
  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild,
    member = interaction.member,
    options = interaction.options,
    worldName = options.getString(`world-name`).toLowerCase()

  if (worldName.length > 40) {
    await interaction.editReply({
      content: `World names must be under 40 characters, please try again (pro tip: hit ctrl-z).`,
    })

    return
  }

  const existingWorldId = await getWorldId(worldName, guild.id)

  if (existingWorldId) {
    await interaction.editReply({
      content: `A world named **${worldName}** already exists in **${guild.name}**, you cannot create multiple worlds with the same name 🤨`,
    })

    return
  }

  await createWorld(worldName, guild.id)

  await interaction.editReply({
    content: `A world with name **${worldName}** has been created 🌎`,
  })
}
