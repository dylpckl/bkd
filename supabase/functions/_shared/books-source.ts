// Where book data comes from: Google Books first, Open Library when Google is
// down (or has no key), and built-in fixtures for local development.
import { normalizeSearch, normalizeVolume } from './google-books.ts'
import type { Book } from './google-books.ts'
import { getFixture, searchFixtures } from './fixtures.ts'
import { fetchWithRetry } from './fetch-retry.ts'
import {
  authorUrl,
  isOpenLibraryId,
  normalizeSearchDocs,
  normalizeWork,
  searchUrl,
  workAuthorKeys,
  workId,
  workUrl,
} from './open-library.ts'
import type { Work } from './open-library.ts'

const API = 'https://www.googleapis.com/books/v1/volumes'
const key = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? ''
const useFixtures = !key && Deno.env.get('GOOGLE_BOOKS_FIXTURES') === 'true'

export class UpstreamError extends Error {}

async function getJson<T>(url: URL | string, source: string): Promise<T> {
  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch (e) {
    throw new UpstreamError(`${source}: ${e instanceof Error ? e.message : e}`)
  }
  if (!res.ok) throw new UpstreamError(`${source} ${res.status}`)
  return (await res.json()) as T
}

async function searchGoogle(query: string): Promise<Book[]> {
  const url = new URL(API)
  url.searchParams.set('q', query)
  url.searchParams.set('printType', 'books')
  url.searchParams.set('maxResults', '20')
  url.searchParams.set('key', key)
  const body = await getJson<{ items?: [] }>(url, 'Google Books')
  return normalizeSearch(body.items)
}

async function searchOpenLibrary(query: string): Promise<Book[]> {
  const body = await getJson<{ docs?: [] }>(searchUrl(query), 'Open Library')
  return normalizeSearchDocs(body.docs)
}

export async function searchBooks(query: string): Promise<Book[]> {
  if (useFixtures) return searchFixtures(query)
  if (key) {
    try {
      return await searchGoogle(query)
    } catch (e) {
      // Google Books answers 503 for minutes at a time; fall back rather than fail.
      console.warn(`${e instanceof Error ? e.message : e}; using Open Library`)
    }
  }
  return searchOpenLibrary(query)
}

async function getOpenLibraryBook(id: string): Promise<Book | null> {
  const work = workId(id)
  if (!work) return null
  let data: Work
  try {
    data = await getJson<Work>(workUrl(work), 'Open Library')
  } catch (e) {
    if (e instanceof UpstreamError && e.message.endsWith(' 404')) return null
    throw e
  }
  // Author names are separate documents; a missing one just drops that name.
  const authors = await Promise.all(
    workAuthorKeys(data).map((k) =>
      getJson<{ name?: string }>(authorUrl(k), 'Open Library').then(
        (a) => a.name ?? null,
        () => null,
      ),
    ),
  )
  return normalizeWork(
    work,
    data,
    authors.filter((a): a is string => !!a),
  )
}

export async function getBook(id: string): Promise<Book | null> {
  if (useFixtures) return getFixture(id)
  if (isOpenLibraryId(id)) return getOpenLibraryBook(id)
  if (!key) throw new UpstreamError('GOOGLE_BOOKS_API_KEY is not set')
  const url = new URL(`${API}/${encodeURIComponent(id)}`)
  url.searchParams.set('key', key)
  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch (e) {
    throw new UpstreamError(
      `Google Books: ${e instanceof Error ? e.message : e}`,
    )
  }
  if (res.status === 404) return null
  if (!res.ok) throw new UpstreamError(`Google Books ${res.status}`)
  return normalizeVolume(await res.json())
}
