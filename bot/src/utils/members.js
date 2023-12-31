import { addToBatchRoleQueue } from './roles.js'
import {
  getAdminChannel,
  getVipRoleId,
  setVipRoleId,
  getWelcomeChannel,
  getNameGuidelines,
  getVipAssignMessage,
  getVipRemoveMessage,
} from '../repositories/guilds.js'
import {
  getVipOverriedId,
  getVipUserIdArray,
} from '../repositories/vip-user-overrides.js'
import { getTotalBatchRoleQueueMembers } from './roles.js'
import { getCommandByName } from './slash-commands.js'
import { queueApiCall } from '../api-queue.js'

export const pauseDuation = 5

export async function getVipMemberArray(guild) {
  const vipMemberArray = []

  guild.members.cache.forEach(member => {
    const memberHasPremiumRole = member.premiumSinceTimestamp

    if (memberHasPremiumRole) vipMemberArray.push(member)
  })

  guild.roles.cache
    .find(role => role.name === `Premium Members` && role.tags?.integrationId)
    ?.members.forEach(member => vipMemberArray.push(member))

  const vipUserOverrideIds = await getVipUserIdArray(guild.id)

  vipUserOverrideIds.forEach(vipUserId => {
    const vipUser = guild.members.cache.get(vipUserId)

    if (vipUser) vipMemberArray.push(vipUser)
  })

  return vipMemberArray
}

export function getExpectedRunTime(vipMemberCount) {
  const totalSeconds = vipMemberCount * pauseDuation,
    hours = Math.floor(totalSeconds / 3600),
    minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60

  let alphaRunTime

  if (hours === 0 && minutes === 0) {
    alphaRunTime = `${seconds} seconds`
  } else if (hours === 0 && seconds === 0) {
    alphaRunTime = `${minutes} minutes`
  } else if (minutes === 0 && seconds === 0) {
    alphaRunTime = `${hours} hours`
  } else if (hours === 0) {
    alphaRunTime = `${minutes} minutes, and ${seconds} seconds`
  } else if (minutes === 0) {
    alphaRunTime = `${hours} hours, and ${seconds} seconds`
  } else if (seconds === 0) {
    alphaRunTime = `${hours} hours, and ${minutes} minutes`
  } else {
    alphaRunTime = `${hours} hours, ${minutes} minutes, and ${seconds} seconds`
  }

  return alphaRunTime
}

export async function syncVipMembers(guild) {
  const vipRoleId = await getVipRoleId(guild.id)

  if (!vipRoleId) return

  const vipRole = guild.roles.cache.get(vipRoleId),
    adminChannelId = await getAdminChannel(guild.id),
    adminChannel = adminChannelId
      ? guild.channels.cache.get(adminChannelId)
      : null

  if (!vipRole) {
    await setVipRoleId(guild.id, null)

    if (adminChannel) {
      adminChannel.send(
        `You have a VIP role ID set, but the cooresponding role no longer exists 😬` +
          `\nPlease set a new VIP role using the \`/set-vip-roll\` function, until then, VIP functionality is no longer automated.`
      )
    }

    return
  }

  const vipMemberArray = await getVipMemberArray(guild),
    newVipMembers = vipMemberArray.filter(
      member => !member._roles.includes(vipRole.id)
    ),
    noLongerVipMembers = guild.members.cache
      .filter(
        member =>
          !vipMemberArray.includes(member) && member._roles.includes(vipRole.id)
      )
      .map(member => member)

  if (newVipMembers.length > 0) {
    addToBatchRoleQueue(vipRole.id, {
      addOrRemove: `add`,
      members: newVipMembers,
      role: vipRole,
    })

    const totalQueuedMembers = getTotalBatchRoleQueueMembers(),
      alphaRunTime = getExpectedRunTime(totalQueuedMembers)

    adminChannel?.send(
      `Some VIP members do not have the VIP role, attributing ${newVipMembers.length} member(s) the VIP role.` +
        `\nThere is currently a total of ${totalQueuedMembers} members in the batch role queue, it should take me around ${alphaRunTime} to complete this action 🕑`
    )
  }

  if (noLongerVipMembers.length > 0) {
    addToBatchRoleQueue(vipRole.id, {
      addOrRemove: `remove`,
      members: noLongerVipMembers,
      role: vipRole,
    })

    const totalQueuedMembers = getTotalBatchRoleQueueMembers(),
      alphaRunTime = getExpectedRunTime(totalQueuedMembers)

    adminChannel?.send(
      `Some members no longer qualify for VIP status, removing the VIP role from ${noLongerVipMembers.length} member(s).` +
        `\nThere is currently a total of ${totalQueuedMembers} members in the batch role queue, it should take me around ${alphaRunTime} to complete this action 🕑`
    )
  }
}

export async function handlePremiumRole(oldMember, newMember) {
  const guild = newMember.guild,
    wasPremium = oldMember.premiumSinceTimestamp,
    isPremium = newMember.premiumSinceTimestamp

  if ((!wasPremium && !isPremium) || (wasPremium && isPremium)) return

  const vipRoleId = await getVipRoleId(guild.id)

  if (!vipRoleId) return

  const vipRole = guild.roles.cache.get(vipRoleId)

  if (!vipRole) {
    await setVipRoleId(guild.id, null)

    const adminChannelId = await getAdminChannel(guild.id),
      adminChannel = adminChannelId
        ? guild.channels.cache.get(adminChannelId)
        : null

    if (adminChannel)
      adminChannel.send(
        `We weren't able to asign the VIP role for this server to ${newMember}.` +
          `\nThe VIP role ID was set, but the role itself no longer exists in this server, we have cleared the ID from the VIP role table.` +
          `\nPlease use the \`/set-vip-role\` command to set a new VIP role, until you do, automated VIP functionality will no longer work in this server.`
      )

    return
  }

  const memberHasVipRole = newMember._roles.includes(vipRole.id)

  if (!wasPremium && isPremium) {
    if (!memberHasVipRole) newMember.roles.add(vipRole)
  } else {
    const memberVipOverrideId = await getVipOverriedId(newMember.id, guild.id)

    if (!memberVipOverrideId && memberHasVipRole)
      newMember.roles.remove(vipRole)
  }
}

export async function handleVipRole(oldMember, newMember) {
  const guild = newMember.guild,
    vipRoleId = await getVipRoleId(guild.id),
    vipRole = guild.roles.cache.get(vipRoleId)

  if (!vipRoleId) return

  const wasVip = oldMember._roles.includes(vipRoleId),
    isVip = newMember._roles.includes(vipRoleId)

  if ((!wasVip && !isVip) || (wasVip && isVip)) return

  const vipMemberArray = await getVipMemberArray(guild),
    adminChannelId = await getAdminChannel(guild.id),
    adminChannel = adminChannelId
      ? guild.channels.cache.get(adminChannelId)
      : null

  if (!wasVip && isVip) {
    if (vipMemberArray.includes(newMember)) {
      const vipAssignMessage = await getVipAssignMessage(guild.id)

      await queueApiCall({
        apiCall: `send`,
        djsObject: newMember,
        parameters:
          `Congratulations, you've been attributed the vip role (**@${vipRole?.name}**) in the **${guild}** server! 🎉` +
          `\n\nHere's a message from **${guild}** with additional information:` +
          `\n>>> ${vipAssignMessage}`,
      })

      return
    }

    newMember.roles.remove(vipRoleId)

    await queueApiCall({
      apiCall: `send`,
      djsObject: adminChannel,
      parameters:
        `Somone tried giving ${oldMember} the VIP role but they do not qualify for VIP status, it has automatically been removed 🤔` +
        `\nIf you'd like to give a member who does not typically qualify for VIP status the VIP role, please use the \`/vip-user-override\` command.`,
    })
  } else {
    if (!vipMemberArray.includes(newMember)) {
      const vipRemoveMessage = await getVipRemoveMessage(guild.id)

      await queueApiCall({
        apiCall: `send`,
        djsObject: newMember,
        parameters:
          `You're no longer a vip member in the **${guild}** server. 😢` +
          `\n\nHere's a message from **${guild}** with additional information:` +
          `\n>>> ${vipRemoveMessage}`,
      })

      return
    }

    await queueApiCall({
      apiCall: `send`,
      djsObject: adminChannel,
      parameters: `Somone tried removing the VIP role from ${oldMember} but they still qualify for VIP status, it has been automatically re-added 🤔`,
    })

    newMember.roles.add(vipRoleId)
  }
}

export async function handlePremiumSub(oldMember, newMember) {
  const guild = newMember.guild,
    premiumRole = guild.roles.cache.find(
      role => role.name === `Premium Members` && role.tags?.integrationId
    ),
    oldRoles = oldMember._roles,
    newRoles = newMember._roles

  if (
    !oldRoles.includes(premiumRole?.id) &&
    !newRoles.includes(premiumRole?.id)
  )
    return
  if (oldRoles.includes(premiumRole?.id) && newRoles.includes(premiumRole?.id))
    return

  const vipRoleId = await getVipRoleId(guild.id)

  if (!vipRoleId) return

  const vipRole = guild.roles.cache.get(vipRoleId)

  if (!vipRole) {
    await setVipRoleId(guild.id, null)

    const adminChannelId = await getAdminChannel(guild.id),
      adminChannel = adminChannelId
        ? guild.channels.cache.get(adminChannelId)
        : null

    if (adminChannel)
      adminChannel?.send(`
        We weren't able to asign the VIP role for this server to ${newMember}.\
        \nThe VIP role ID was set, but the role itself no longer exists in this server, we have cleared the ID from the VIP role table.
        \nPlease use the \`/set-vip-role\` command to set a new VIP role, until you do, automated VIP functionality will no longer work in this server.
      `)

    return
  }

  if (!oldRoles.includes(premiumRole.id) && newRoles.includes(premiumRole.id)) {
    const memberHasVipRole = newRoles.includes(vipRole.id)

    if (!memberHasVipRole)
      queueApiCall({
        apiCall: `add`,
        djsObject: newMember.roles,
        parameters: vipRole,
      })
  } else {
    const memberHasVipRole = newRoles.includes(vipRole.id)

    if (memberHasVipRole)
      queueApiCall({
        apiCall: `remove`,
        djsObject: newMember.roles,
        parameters: vipRole,
      })
  }
}

export function getNicknameOrUsername(member, user) {
  const { nickname, user: memberUser } = member || {},
    _user = memberUser ? memberUser : user,
    name = nickname ? nickname : _user?.username

  return name
}
