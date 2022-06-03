export async function getThreadById(channel, threadId) {
  if (!channel || !threadId) return

  let thread = channel.threads.cache.get(threadId)

  if (!thread) {
    const archivedPrivateThreads = await channel.threads
      .fetchArchived({ type: `private`, fetchAll: true })
      .catch(error =>
        console.log(
          `I was unable to fetch archived private threads, see error below.\n${error}`
        )
      )

    const archivedPublicThreads = await channel.threads
      .fetchArchived({ type: `public`, fetchAll: true })
      .catch(error =>
        console.log(
          `I was unable to fetch archived public threads, see error below.\n${error}`
        )
      )

    const privateThread = archivedPrivateThreads.threads.get(threadId),
      publicThread = archivedPublicThreads.threads.get(threadId)

    thread = privateThread ? privateThread : publicThread
  }

  return thread
}

export async function getThreadByName(channel, threadName) {
  if (!channel || !threadName) return

  let thread = channel.threads.cache.find(thread => thread.name === threadName)

  if (!thread) {
    const archivedPrivateThreads = await channel.threads
      .fetchArchived({ type: `private`, fetchAll: true })
      .catch(error =>
        console.log(
          `I was unable to fetch archived private threads, see error below.\n${error}`
        )
      )

    const archivedPublicThreads = await channel.threads
      .fetchArchived({ type: `public`, fetchAll: true })
      .catch(error =>
        console.log(
          `I was unable to fetch archived public threads, see error below.\n${error}`
        )
      )

    const privateThread = archivedPrivateThreads.threads.find(
        thread => thread.name === threadName
      ),
      publicThread = archivedPublicThreads.threads.find(
        thread => thread.name === threadName
      )

    thread = privateThread ? privateThread : publicThread
  }

  return thread
}

export async function unarchiveThread(thread) {
  if (!thread || !thread?.archived) return

  await thread
    .setArchived(false)
    .catch(error =>
      console.log(
        `I was unable to unarchive a thread, see error below\n${error}`
      )
    )
}
