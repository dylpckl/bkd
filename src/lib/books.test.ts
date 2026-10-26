import { describe, expect, it } from 'vitest'
import { authorLine, bookSourceLink, publishedYear, readingTime } from './books'

describe('book helpers', () => {
  it('estimates reading time like the mockup', () => {
    expect(readingTime(304)).toBe('~7 hr')
    expect(readingTime(32)).toBe('~1 hr')
    expect(readingTime(null)).toBeNull()
  })
  it('formats authors and years', () => {
    expect(authorLine([])).toBe('Unknown author')
    expect(authorLine(['A', 'B'])).toBe('A & B')
    expect(authorLine(['A', 'B', 'C'])).toBe('A and others')
    expect(publishedYear('1969-01-01')).toBe('1969')
  })
  it('links to where the book came from', () => {
    expect(bookSourceLink('fixture-x')).toBeNull()
    expect(bookSourceLink('abc')).toEqual({
      href: 'https://books.google.com/books?id=abc',
      label: 'Google Books',
    })
    expect(bookSourceLink('ol:OL45804W')).toEqual({
      href: 'https://openlibrary.org/works/OL45804W',
      label: 'Open Library',
    })
  })
})
