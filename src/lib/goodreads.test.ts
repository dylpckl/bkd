import { describe, expect, it } from 'vitest'
import { goodreadsBookUrl, goodreadsStars, starsLabel } from './goodreads'

describe('goodreads', () => {
  it('links by ISBN, or searches by title and author', () => {
    expect(
      goodreadsBookUrl({
        isbn13: '9781635575637',
        title: 'Piranesi',
        authors: [],
      }),
    ).toBe('https://www.goodreads.com/book/isbn/9781635575637')
    expect(
      goodreadsBookUrl({
        isbn13: null,
        title: 'Piranesi',
        authors: ['Susanna Clarke'],
      }),
    ).toBe('https://www.goodreads.com/search?q=Piranesi%20Susanna%20Clarke')
  })
  it('rounds half stars up for Goodreads', () => {
    expect(goodreadsStars(9)).toBe(5)
    expect(goodreadsStars(8)).toBe(4)
    expect(goodreadsStars(1)).toBe(1)
  })
  it('labels ratings', () => {
    expect(starsLabel(9)).toBe('4.5 stars')
    expect(starsLabel(2)).toBe('1 star')
    expect(starsLabel(1)).toBe('0.5 stars')
  })
})
