import {
  getButtonContext,
  getNotificationRoleBasename,
} from '../utils/validation.js'

export default async function (interaction) {
  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild,
    member = interaction.member,
    roleId = getButtonContext(interaction.customId),
    role = guild.roles.cache.get(roleId),
    roleBasename = getNotificationRoleBasename(role.name)

  if (!member._roles.includes(roleId)) {
    await member.roles.add(roleId)

    await interaction.editReply({
      content: `You are now subscribed to ${roleBasename} in the ${guild.name} server 🔔`,
      ephemeral: true,
    })
  } else
    await interaction.editReply({
      content: `You are already subscribed to ${roleBasename} in the ${guild.name} server 🤔`,
      ephemeral: true,
    })
}
