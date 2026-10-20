import { normalizeSearch, normalizeVolume } from './google-books.ts'
import type { Book } from './google-books.ts'
import { getFixture, searchFixtures } from './fixtures.ts'

const API = 'https://www.googleapis.com/books/v1/volumes'
const key = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? ''
const useFixtures = !key && Deno.env.get('GOOGLE_BOOKS_FIXTURES') === 'true'

export class UpstreamError extends Error {}

export async function searchBooks(query: string): Promise<Book[]> {
  if (useFixtures) return searchFixtures(query)
  const url = new URL(API)
  url.searchParams.set('q', query)
  url.searchParams.set('printType', 'books')
  url.searchParams.set('maxResults', '20')
  if (key) url.searchParams.set('key', key)
  const res = await fetch(url)
  if (!res.ok) throw new UpstreamError(`Google Books ${res.status}`)
  const body = await res.json()
  return normalizeSearch(body.items)
}

export async function getBook(googleBooksId: string): Promise<Book | null> {
  if (useFixtures) return getFixture(googleBooksId)
  const url = new URL(`${API}/${encodeURIComponent(googleBooksId)}`)
  if (key) url.searchParams.set('key', key)
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new UpstreamError(`Google Books ${res.status}`)
  return normalizeVolume(await res.json())
}
