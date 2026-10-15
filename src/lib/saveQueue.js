const queues = new Map()
const saved = new Map()
export function saveIfChanged(key, value, action) {
  const snapshot = JSON.stringify(value)
  const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    if (saved.get(key) === snapshot) return
    await action(JSON.parse(snapshot))
    saved.set(key, snapshot)
  })
  queues.set(key, task)
  task.finally(() => { if (queues.get(key) === task) queues.delete(key) }).catch(() => {})
  return task
}
