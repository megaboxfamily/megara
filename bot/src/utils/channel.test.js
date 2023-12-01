import { emptyChannelSortingQueue } from './channels.js'
// import * as channel from './channels.js'

describe('channel sorting queue', () => {
  // need fake channel sorting queue, need to be able to figure out what a Collection looks like.
  test('emptyChannelSortingQueue', () => {
    const channelSortingQueue = [{ guildId: 1, bypassComparison: true }]
    emptyChannelSortingQueue(channelSortingQueue)
    expect(channelSortingQueue).toEqual({})
  })
})

// async function emptyChannelSortingQueue() {
//   if (channelSortingQueue.size === 0) return

//   const context = channelSortingQueue.first(),
//     { guildId } = context

//   await sortChannels(context)

//   channelSortingQueue.delete(guildId)

//   emptyChannelSortingQueue()
// }
