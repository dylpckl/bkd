// Google Books → our book shape. Pure TypeScript so the app's unit tests can import it too.

export type Book = {
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

type Volume = {
  id?: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    printedPageCount?: number
    categories?: string[]
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: Record<string, string | undefined>
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Google serves http thumbnails with a page-curl effect; ask for a clean https cover. */
export function cleanCoverUrl(url: string | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:/, 'https:').replace(/&edge=curl/g, '')
}

export function normalizeVolume(volume: Volume): Book | null {
  const info = volume.volumeInfo
  if (!volume.id || !info?.title) return null
  const ids = info.industryIdentifiers ?? []
  const images = info.imageLinks ?? {}
  return {
    googleBooksId: volume.id,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    coverUrl: cleanCoverUrl(images.thumbnail ?? images.smallThumbnail),
    isbn13: ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null,
    pageCount: info.pageCount || info.printedPageCount || null,
    publishedDate: info.publishedDate ?? null,
    description: info.description ? stripHtml(info.description) : null,
    publisher: info.publisher ?? null,
    categories: info.categories ?? [],
  }
}

/** Drops results without a title and repeats of the same id. */
export function normalizeSearch(items: Volume[] | undefined): Book[] {
  const seen = new Set<string>()
  const out: Book[] = []
  for (const item of items ?? []) {
    const book = normalizeVolume(item)
    if (book && !seen.has(book.googleBooksId)) {
      seen.add(book.googleBooksId)
      out.push(book)
    }
  }
  return out
}

/** Column names for the books table. */
export function toBookRow(book: Book) {
  return {
    google_books_id: book.googleBooksId,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    cover_url: book.coverUrl,
    isbn13: book.isbn13,
    page_count: book.pageCount,
    published_date: book.publishedDate,
    description: book.description,
    publisher: book.publisher,
    categories: book.categories,
    updated_at: new Date().toISOString(),
  }
}
