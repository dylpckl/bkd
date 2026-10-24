import { describe, expect, it } from 'vitest'
import { authorLine, googleBooksUrl, publishedYear, readingTime } from './books'

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
  it('has no Google link for fixture books', () => {
    expect(googleBooksUrl('fixture-x')).toBeNull()
    expect(googleBooksUrl('abc')).toBe('https://books.google.com/books?id=abc')
  })
})
