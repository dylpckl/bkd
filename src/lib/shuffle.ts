// FNV-1a: a small, stable string hash.
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Orders ids by a hash of seed + id: the same for the same person and vote on
 * every load, however the list arrives, but different between people, so an
 * untouched default order doesn't favor the books nominated first.
 */
export function seededOrder(ids: string[], seed: string) {
  return ids
    .map((id) => ({ id, key: hash(`${seed}:${id}`) }))
    .sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1))
    .map((x) => x.id)
}
