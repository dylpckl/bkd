export type BookInfo = {
  google_books_id: string
  title: string
  subtitle?: string | null
  authors: string[]
  cover_url: string | null
  isbn13: string | null
  page_count: number | null
  published_date: string | null
  description: string | null
  publisher: string | null
  categories: string[]
}

type SearchResult = {
  googleBooksId: string
  title: string
  subtitle: string | null
  authors: string[]
  coverUrl: string | null
  isbn13: string | null
  pageCount: number | null
  publishedDate: string | null
  description: string | null
  publisher: string | null
  categories: string[]
}

/** search-books results use camelCase; the books table uses snake_case. */
export function fromSearchResult(r: SearchResult): BookInfo {
  return {
    google_books_id: r.googleBooksId,
    title: r.title,
    subtitle: r.subtitle,
    authors: r.authors,
    cover_url: r.coverUrl,
    isbn13: r.isbn13,
    page_count: r.pageCount,
    published_date: r.publishedDate,
    description: r.description,
    publisher: r.publisher,
    categories: r.categories,
  }
}
export type { SearchResult }

/** About 1.4 minutes a page: 304 pages ≈ 7 hr. */
export function readingTime(pages: number | null) {
  if (!pages) return null
  const hours = Math.max(1, Math.round((pages * 1.4) / 60))
  return `~${hours} hr`
}

export function publishedYear(date: string | null) {
  return date?.slice(0, 4) || null
}

export function authorLine(authors: string[]) {
  if (authors.length === 0) return 'Unknown author'
  if (authors.length <= 2) return authors.join(' & ')
  return `${authors[0]} and others`
}

export function googleBooksUrl(id: string) {
  return id.startsWith('fixture-')
    ? null
    : `https://books.google.com/books?id=${encodeURIComponent(id)}`
}

const COVERS = [
  '#2F5D7C',
  '#8A5A12',
  '#3F3D56',
  '#B4532A',
  '#7A3E65',
  '#5B6B3A',
  '#1F5E3B',
  '#9A3412',
]

/** Fallback cover color, stable per book. */
export function coverColor(key: string) {
  let h = 0
  for (const ch of key) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}
