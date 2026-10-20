import { describe, expect, it } from 'vitest'
import {
  cleanCoverUrl,
  normalizeSearch,
  normalizeVolume,
  stripHtml,
} from '../../supabase/functions/_shared/google-books.ts'

const volume = {
  id: 'abc123',
  volumeInfo: {
    title: 'The Left Hand of Darkness',
    authors: ['Ursula K. Le Guin'],
    publisher: 'Ace',
    publishedDate: '1987-03-15',
    description:
      '<p>An envoy arrives on <b>Gethen</b>.</p><p>Ice &amp; politics.</p>',
    pageCount: 304,
    categories: ['Fiction / Science Fiction'],
    industryIdentifiers: [
      { type: 'ISBN_10', identifier: '0441478123' },
      { type: 'ISBN_13', identifier: '9780441478125' },
    ],
    imageLinks: {
      thumbnail:
        'http://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1&edge=curl',
    },
  },
}

describe('normalizeVolume', () => {
  it('maps the fields the app uses', () => {
    expect(normalizeVolume(volume)).toEqual({
      googleBooksId: 'abc123',
      title: 'The Left Hand of Darkness',
      subtitle: null,
      authors: ['Ursula K. Le Guin'],
      coverUrl:
        'https://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1',
      isbn13: '9780441478125',
      pageCount: 304,
      publishedDate: '1987-03-15',
      description: 'An envoy arrives on Gethen.\n\nIce & politics.',
      publisher: 'Ace',
      categories: ['Fiction / Science Fiction'],
    })
  })
  it('skips volumes without a title', () => {
    expect(normalizeVolume({ id: 'x', volumeInfo: {} })).toBeNull()
  })
  it('treats a zero page count as unknown', () => {
    expect(
      normalizeVolume({ id: 'x', volumeInfo: { title: 'T', pageCount: 0 } })
        ?.pageCount,
    ).toBeNull()
  })
})

describe('normalizeSearch', () => {
  it('drops duplicates and untitled results', () => {
    expect(
      normalizeSearch([volume, volume, { id: 'y' }]).map(
        (b) => b.googleBooksId,
      ),
    ).toEqual(['abc123'])
    expect(normalizeSearch(undefined)).toEqual([])
  })
})

describe('helpers', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtml('A<br>B &quot;C&quot; &#39;D&#39;')).toBe('A\nB "C" \'D\'')
  })
  it('returns null for a missing cover', () => {
    expect(cleanCoverUrl(undefined)).toBeNull()
  })
})
