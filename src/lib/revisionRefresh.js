// Commit a version only after the entire refresh succeeds. Changes arriving
// during the request are picked up by the next tick. No overlapping refreshes.
export function createRevisionRefresh(readVersion, refresh) {
  let committed, pending
  return function check() {
    if (pending) return pending
    pending = (async () => {
      const version = await readVersion()
      if (version == null) throw new Error('No se pudo comprobar la versión de datos. Verificá el SQL optimizar_trafico_v2.sql y los permisos.')
      if (committed !== String(version)) {
        await refresh()
        committed = String(version)
      }
    })().finally(() => { pending = null })
    return pending
  }
}
