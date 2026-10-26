// Only public menu content is persisted. Keys include the backend + restaurant.
// Versions come from database triggers, so editing Carta invalidates every device.
export async function loadVersionedCatalog({ key, version, fetchCatalog, storage = globalThis.localStorage }) {
  try {
    const cached = JSON.parse(storage.getItem(key) || 'null')
    if (version != null && cached?.version === String(version) && Array.isArray(cached.products) && Array.isArray(cached.categories)) return cached
  } catch { /* Storage disabled/full: continue online. */ }
  const data = await fetchCatalog()
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories) || data.version == null) throw new Error('No se pudo obtener el catálogo actualizado.')
  const catalog = { ...data, version: String(data.version) }
  try {
    const encoded = JSON.stringify(catalog)
    if (encoded.length < 1000000) storage.setItem(key, encoded)
    else storage.removeItem(key)
  } catch { /* Cache failure must not prevent viewing the menu. */ }
  return catalog
}
