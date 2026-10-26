// Open Library → our book shape. The backup source when Google Books is down.
// Ids are stored with an "ol:" prefix (e.g. "ol:OL45804W") in the same column as
// Google ids. Pure TypeScript so the app's unit tests can import it too.
import type { Book } from './google-books.ts'

export const OL_PREFIX = 'ol:'
const SITE = 'https://openlibrary.org'

export const SEARCH_FIELDS =
  'key,title,subtitle,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,publisher,subject'

export function isOpenLibraryId(id: string) {
  return id.startsWith(OL_PREFIX)
}

/** "ol:OL45804W" → "OL45804W"; null for anything that isn't a work id. */
export function workId(id: string): string | null {
  const bare = id.slice(OL_PREFIX.length)
  return isOpenLibraryId(id) && /^OL\d+W$/.test(bare) ? bare : null
}

export function coverUrl(coverId: number | undefined): string | null {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

export function searchUrl(query: string) {
  const url = new URL(`${SITE}/search.json`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '20')
  url.searchParams.set('fields', SEARCH_FIELDS)
  return url
}

type SearchDoc = {
  key?: string
  title?: string
  subtitle?: string
  author_name?: string[]
  cover_i?: number
  isbn?: string[]
  number_of_pages_median?: number
  first_publish_year?: number
  publisher?: string[]
  subject?: string[]
}

const isbn13 = (isbns: string[] | undefined) =>
  isbns?.find((i) => /^97[89]\d{10}$/.test(i)) ?? null

export function normalizeDoc(doc: SearchDoc): Book | null {
  const id = doc.key?.match(/^\/works\/(OL\d+W)$/)?.[1]
  if (!id || !doc.title) return null
  return {
    googleBooksId: OL_PREFIX + id,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name ?? [],
    coverUrl: coverUrl(doc.cover_i),
    isbn13: isbn13(doc.isbn),
    pageCount: doc.number_of_pages_median ?? null,
    publishedDate: doc.first_publish_year
      ? String(doc.first_publish_year)
      : null,
    description: null,
    publisher: doc.publisher?.[0] ?? null,
    categories: (doc.subject ?? []).slice(0, 3),
  }
}

export function normalizeSearchDocs(docs: SearchDoc[] | undefined): Book[] {
  const seen = new Set<string>()
  const out: Book[] = []
  for (const doc of docs ?? []) {
    const book = normalizeDoc(doc)
    if (book && !seen.has(book.googleBooksId)) {
      seen.add(book.googleBooksId)
      out.push(book)
    }
  }
  return out
}

export function workUrl(id: string) {
  return `${SITE}/works/${id}.json`
}

export function authorUrl(key: string) {
  return `${SITE}${key}.json`
}

export type Work = {
  title?: string
  subtitle?: string
  description?: string | { value?: string }
  covers?: number[]
  subjects?: string[]
  first_publish_date?: string
  authors?: { author?: { key?: string } }[]
}

/** The author keys on a work, at most three ("/authors/OL23919A"). */
export function workAuthorKeys(work: Work): string[] {
  return (work.authors ?? [])
    .map((a) => a.author?.key)
    .filter((k): k is string => !!k && /^\/authors\/OL\d+A$/.test(k))
    .slice(0, 3)
}

export function normalizeWork(
  id: string,
  work: Work,
  authors: string[],
): Book | null {
  if (!work.title) return null
  const description =
    typeof work.description === 'string'
      ? work.description
      : (work.description?.value ?? null)
  return {
    googleBooksId: OL_PREFIX + id,
    title: work.title,
    subtitle: work.subtitle ?? null,
    authors,
    coverUrl: coverUrl(work.covers?.find((c) => c > 0)),
    isbn13: null,
    pageCount: null,
    publishedDate: work.first_publish_date ?? null,
    description: description?.trim() || null,
    publisher: null,
    categories: (work.subjects ?? []).slice(0, 3),
  }
}
