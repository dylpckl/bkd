import { describe, expect, it } from 'vitest'
import {
  normalizeDoc,
  normalizeSearchDocs,
  normalizeWork,
  searchUrl,
  workAuthorKeys,
  workId,
} from '../../supabase/functions/_shared/open-library.ts'

const doc = {
  key: '/works/OL15968460W',
  title: 'Thinking, Fast and Slow',
  author_name: ['Daniel Kahneman'],
  cover_i: 7116471,
  isbn: ['0374275637', '9780374275631', '9780141033570'],
  number_of_pages_median: 499,
  first_publish_year: 2011,
  publisher: ['Farrar, Straus and Giroux', 'Penguin'],
  subject: [
    'Psychology',
    'Decision making',
    'Thought and thinking',
    'Reasoning',
  ],
}

describe('Open Library search results', () => {
  it('maps a search doc to our book shape', () => {
    expect(normalizeDoc(doc)).toEqual({
      googleBooksId: 'ol:OL15968460W',
      title: 'Thinking, Fast and Slow',
      subtitle: null,
      authors: ['Daniel Kahneman'],
      coverUrl: 'https://covers.openlibrary.org/b/id/7116471-M.jpg',
      isbn13: '9780374275631',
      pageCount: 499,
      publishedDate: '2011',
      description: null,
      publisher: 'Farrar, Straus and Giroux',
      categories: ['Psychology', 'Decision making', 'Thought and thinking'],
    })
  })

  it('skips docs without a work key or title, and repeats', () => {
    expect(
      normalizeSearchDocs([
        doc,
        { ...doc },
        { title: 'No key' },
        { key: '/books/OL1M', title: 'An edition, not a work' },
        { key: '/works/OL2W' },
      ]).map((b) => b.googleBooksId),
    ).toEqual(['ol:OL15968460W'])
  })

  it('builds the search URL', () => {
    const url = searchUrl('thinking fast')
    expect(url.origin + url.pathname).toBe(
      'https://openlibrary.org/search.json',
    )
    expect(url.searchParams.get('q')).toBe('thinking fast')
    expect(url.searchParams.get('limit')).toBe('20')
  })
})

describe('Open Library works', () => {
  it('only accepts work ids', () => {
    expect(workId('ol:OL15968460W')).toBe('OL15968460W')
    expect(workId('ol:OL1M')).toBeNull()
    expect(workId('ol:../admin')).toBeNull()
    expect(workId('abc123')).toBeNull()
  })

  it('maps a work and its authors', () => {
    const work = {
      title: 'Thinking, Fast and Slow',
      description: {
        type: '/type/text',
        value: ' Two systems drive the way we think. ',
      },
      covers: [-1, 7116471],
      subjects: ['Psychology'],
      first_publish_date: '2011',
      authors: [
        { author: { key: '/authors/OL3307893A' } },
        { author: { key: 'javascript:alert(1)' } },
      ],
    }
    expect(workAuthorKeys(work)).toEqual(['/authors/OL3307893A'])
    expect(
      normalizeWork('OL15968460W', work, ['Daniel Kahneman']),
    ).toMatchObject({
      googleBooksId: 'ol:OL15968460W',
      authors: ['Daniel Kahneman'],
      coverUrl: 'https://covers.openlibrary.org/b/id/7116471-M.jpg',
      description: 'Two systems drive the way we think.',
      publishedDate: '2011',
    })
  })

  it('accepts a plain-string description and no title means no book', () => {
    expect(
      normalizeWork('OL1W', { title: 'T', description: 'Plain.' }, [])
        ?.description,
    ).toBe('Plain.')
    expect(normalizeWork('OL1W', {}, [])).toBeNull()
  })
})
