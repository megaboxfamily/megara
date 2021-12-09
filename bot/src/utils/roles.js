import { Permissions } from 'discord.js'
import { getBot } from '../cache-bot.js'
import { getUserRoleQueue, getChannelRoleQueue } from './required-role-queue.js'
import { getRoleSorting, getAdminChannelId } from '../repositories/guilds.js'

Array.prototype.pushRoll = function (value) {
  this.push(value)
  if (this.length === 1) emptyRoleSortingQueue()
}

const roleSortingQueue = [],
  requiredRoles = [
    `verified`,
    `undergoing verification`,
    `!channel type: public`,
    `!channel type: joinable`,
    `!command Level: admin`,
    `!command Level: unrestricted`,
    `!command Level: restricted`,
    `!position override: 1`,
    `!position override: 2`,
    `!position override: 3`,
    `!position override: 4`,
    `!position override: 5`,
    `!position override: -1`,
    `!position override: -2`,
    `!position override: -3`,
    `!position override: -4`,
    `!position override: -5`,
  ]

export function requiredRoleDifference(guild, oldRoles, newRoles) {
  const _requiredRoles = guild.roles.cache.filter(guildRole =>
    requiredRoles.includes(guildRole.name)
  )

  return _requiredRoles.find(_requriedRole => {
    if (
      oldRoles.includes(_requriedRole.id) &&
      !newRoles.includes(_requriedRole.id)
    )
      return _requriedRole
  })
}

export async function sortRoles(guildId) {
  if (!(await getRoleSorting(guildId))) return

  const guild = getBot().guilds.cache.get(guildId),
    botRole = guild.roles.cache.find(
      role => role.name === getBot().user.username
    ),
    roles = guild.roles.cache.filter(role => role.position < botRole.position)

  let colorRoles = [],
    functionalRoles = [],
    normalRoles = []

  roles.forEach(role => {
    if (role.name.match(`^~.+~$`))
      colorRoles.push({ name: role.name, id: role.id })
    else if (role.name.match(`^!.+:`))
      functionalRoles.push({ name: role.name, id: role.id })
    else if (role.name !== `@everyone`)
      normalRoles.push({
        name: role.name,
        id: role.id,
      })
  })

  colorRoles.sort((a, b) => (a.name > b.name ? -1 : 1))
  functionalRoles.sort((a, b) => (a.name > b.name ? -1 : 1))
  normalRoles.sort((a, b) => (a.name > b.name ? -1 : 1))

  const sortedRoleArray = [...functionalRoles, ...normalRoles, ...colorRoles],
    finalRoleArray = sortedRoleArray.map((sortedRole, index) => {
      return { role: sortedRole.id, position: index + 1 }
    }),
    currentRolePositions = finalRoleArray.map(role => {
      const _role = guild.roles.cache.get(role.role)

      return { role: _role.id, position: _role.position }
    })

  console.log(`tried`)

  if (JSON.stringify(finalRoleArray) !== JSON.stringify(currentRolePositions)) {
    console.log(`sorted`)

    await guild.roles.setPositions(finalRoleArray)
  }
}

async function emptyRoleSortingQueue() {
  if (roleSortingQueue.length === 0) return

  await sortRoles(roleSortingQueue[0])

  roleSortingQueue.shift()

  emptyRoleSortingQueue()
}

export async function syncRoles(guild) {
  requiredRoles.forEach(async requiredRole => {
    if (guild.roles.cache.filter(role => role.name === requiredRole).size === 0)
      await guild.roles.create({
        name: requiredRole,
        permissions: [
          Permissions.FLAGS.VIEW_CHANNEL,
          Permissions.FLAGS.SEND_MESSAGES,
        ],
      })
    else if (
      guild.roles.cache.filter(role => role.name === requiredRole).size > 1
    ) {
      const roles = guild.roles.cache.filter(role => {
        if (role.name === requiredRole) return role
      })

      roles.sort((a, b) => (a.members.size > b.members.size ? -1 : 1))
      roles.delete([...roles.keys()][0])
      roles.forEach(role => role.delete())
    }
  })

  roleSortingQueue.pushRoll(guild.id)
}

export function balanceDisrupted(role) {
  if (
    requiredRoles.includes(role.name) &&
    role.guild.roles.cache.filter(_role => _role.name === role.name).size !== 1
  )
    return true
}

export async function createRole(role) {
  const guild = role.guild,
    botRole = guild.roles.cache.find(
      role => role.name === getBot().user.username
    )

  if (balanceDisrupted(role)) {
    const roleName = role.name

    role.delete()

    const adminChannel = guild.channels.cache.get(
      await getAdminChannelId(guild.id)
    )

    if (adminChannel)
      adminChannel.send(
        `
          \n@here\
          \nSomeone tried creating a duplicate of the \`${roleName}\` role, which I need to function 😡\

          \nIt's okay, I forgive you guys 😇\
          \nBut I did have to delete that new role...
        `
      )
    return
  } else if (role.name.match(`^~.+~$`)) {
    //update color list
  }

  if (
    role.position < botRole.position &&
    !roleSortingQueue.includes(guild.id)
  ) {
    roleSortingQueue.pushRoll(guild.id)
  }
}

export async function modifyRole(oldRole, newRole) {
  const guild = newRole.guild,
    botRole = guild.roles.cache.find(
      role => role.name === getBot().user.username
    )

  if (
    oldRole.name !== newRole.name &&
    (balanceDisrupted(oldRole) || balanceDisrupted(newRole))
  ) {
    const roleName = newRole.name

    newRole.setName(oldRole.name)

    const adminChannel = getBot().channels.cache.get(
      await getAdminChannelId(guild.id)
    )

    if (adminChannel)
      adminChannel.send(
        `
          \n@here\
          \nSomeone tried modifying or overwritting the \`${roleName}\` role which I need to function 😡\

          \nIt's okay, I forgive you guys 😇\
          \nBut I had to rename said role back to what it was.
        `
      )
  } else if (oldRole.name.match(`^~.+~$`) || newRole.name.match(`^~.+~$`)) {
    //update color list
  }

  if (
    oldRole.rawPosition !== newRole.rawPosition &&
    newRole.position < botRole.position &&
    !roleSortingQueue.includes(guild.id)
  ) {
    roleSortingQueue.pushRoll(guild.id)
  }
}

export async function deleteRole(role) {
  const guild = role.guild

  if (balanceDisrupted(role)) {
    const newRole = await guild.roles.create(role),
      UserRoleQueue = getUserRoleQueue(),
      userArray = UserRoleQueue
        ? UserRoleQueue.filter(
            record =>
              record.guild === newRole.guild.id && record.role === newRole.name
          ).map(record => record.user)
        : null,
      channelRoleQueue = getChannelRoleQueue(),
      channelArray = channelRoleQueue
        ? channelRoleQueue
            .filter(
              record =>
                record.guild === newRole.guild.id &&
                record.role === newRole.name
            )
            .map(record => {
              return {
                channelId: record.channel,
                overwrite: record.permissionOverwrite,
              }
            })
        : null

    if (userArray)
      userArray.forEach(user =>
        guild.members.cache.get(user).roles.add(newRole)
      )

    if (channelArray)
      channelArray.forEach(channel => {
        channel.overwrite.allow = channel.overwrite.allow.serialize()
        channel.overwrite.deny = channel.overwrite.deny.serialize()

        const permissionKeys = Object.keys(channel.overwrite.allow),
          finalPermissionObject = {}

        permissionKeys.forEach(key => {
          if (channel.overwrite.allow[key] !== channel.overwrite.deny[key])
            finalPermissionObject[key] = channel.overwrite.allow[key]
        })

        guild.channels.cache
          .get(channel.channelId)
          .permissionOverwrites.create(newRole.id, finalPermissionObject)
      })

    const adminChannel = guild.channels.cache.get(
      await getAdminChannelId(guild.id)
    )

    if (adminChannel)
      adminChannel.send(
        `
          \n@here\
          \nSomeone tried deleting the \`${newRole.name}\` role, which I need to function 😡\

          \nIt's okay, I forgive you guys 😇\
          \nI did my best to restore the role and re-assign it to users and channels, but I may have missed something.\
          
          \nIf you recently removed this role from a user or channel it's possible that it was re-added, I'd peek around to make sure everything is okay 👀\
        `
      )

    if (!roleSortingQueue.includes(guild.id))
      roleSortingQueue.pushRoll(guild.id)
  } else if (role.name.match(`^~.+~$`)) {
    //update color list

    if (!roleSortingQueue.includes(guild.id))
      roleSortingQueue.pushRoll(guild.id)
  }
}
