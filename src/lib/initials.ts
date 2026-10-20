const SKIP = /^(the|a|an|of|and)$/i

/** "The Overdue Society" → "OS", "Dylan Smith" → "DS", "Jimmy" → "J". */
export function initials(name: string, { skipArticles = false } = {}) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const picked = skipArticles ? words.filter((w) => !SKIP.test(w)) : words
  const source = picked.length ? picked : words
  if (!source.length) return '?'
  return source
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase()
}

const PALETTE = [
  '#1F5E3B',
  '#1D4ED8',
  '#B45309',
  '#7C3AED',
  '#BE185D',
  '#0F766E',
  '#3F3D56',
  '#9A3412',
]

/** A stable color for an id, from colors that keep white text readable. */
export function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
