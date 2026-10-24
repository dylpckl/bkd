// Goodreads has had no public API since 2020, so the app links out instead.

type BookRef = { isbn13: string | null; title: string; authors: string[] }

export function goodreadsBookUrl(book: BookRef) {
  if (book.isbn13) return `https://www.goodreads.com/book/isbn/${book.isbn13}`
  const q = [book.title, book.authors[0]].filter(Boolean).join(' ')
  return `https://www.goodreads.com/search?q=${encodeURIComponent(q)}`
}

/** Goodreads only takes whole stars, so round half-stars up: 9 (4.5 stars) → 5. */
export function goodreadsStars(halfStars: number) {
  return Math.ceil(halfStars / 2)
}

/** "4.5 stars", "1 star". */
export function starsLabel(halfStars: number) {
  const stars = halfStars / 2
  return `${stars} ${stars === 1 ? 'star' : 'stars'}`
}
