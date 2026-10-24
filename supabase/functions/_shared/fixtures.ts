// Offline stand-in for Google Books, used when GOOGLE_BOOKS_API_KEY is unset and
// GOOGLE_BOOKS_FIXTURES=true (local development and tests only).
import type { Book } from './google-books.ts'

const book = (
  id: string,
  title: string,
  author: string,
  year: string,
  pages: number,
  isbn13: string,
  description: string,
  categories: string[] = ['Fiction'],
): Book => ({
  googleBooksId: `fixture-${id}`,
  title,
  subtitle: null,
  authors: [author],
  coverUrl: null,
  isbn13,
  pageCount: pages,
  publishedDate: year,
  description,
  publisher: null,
  categories,
})

export const FIXTURE_BOOKS: Book[] = [
  book(
    'left-hand',
    'The Left Hand of Darkness',
    'Ursula K. Le Guin',
    '1969',
    304,
    '9780441478125',
    'An envoy from a league of worlds arrives on Gethen, an icy planet whose people have no fixed sex, and has to earn the trust of its rival nations.',
    ['Science fiction'],
  ),
  book(
    'dispossessed',
    'The Dispossessed',
    'Ursula K. Le Guin',
    '1974',
    387,
    '9780061054884',
    'A physicist leaves his anarchist moon to visit its wealthy twin planet, and each world shows up the flaws of the other.',
    ['Science fiction'],
  ),
  book(
    'earthsea',
    'A Wizard of Earthsea',
    'Ursula K. Le Guin',
    '1968',
    183,
    '9780547722023',
    'A gifted, proud young mage unleashes a shadow on the world and must chase it across an archipelago.',
    ['Fantasy'],
  ),
  book(
    'lathe',
    'The Lathe of Heaven',
    'Ursula K. Le Guin',
    '1971',
    184,
    '9781416556961',
    'A man whose dreams change reality falls into the hands of a psychiatrist with big plans.',
    ['Science fiction'],
  ),
  book(
    'hail-mary',
    'Project Hail Mary',
    'Andy Weir',
    '2021',
    496,
    '9780593135204',
    'A lone astronaut wakes up on a ship with no memory and a mission to save Earth.',
    ['Science fiction'],
  ),
  book(
    'klara',
    'Klara and the Sun',
    'Kazuo Ishiguro',
    '2021',
    303,
    '9780571364886',
    'An Artificial Friend watches the world from a store window, hoping to be chosen.',
  ),
  book(
    'remains',
    'The Remains of the Day',
    'Kazuo Ishiguro',
    '1989',
    245,
    '9780679731726',
    'An English butler takes a motoring trip and looks back on a life of service.',
  ),
  book(
    'tomorrow',
    'Tomorrow, and Tomorrow, and Tomorrow',
    'Gabrielle Zevin',
    '2022',
    416,
    '9780593321201',
    'Two friends build video games together over thirty years.',
  ),
  book(
    'station-eleven',
    'Station Eleven',
    'Emily St. John Mandel',
    '2014',
    333,
    '9780804172448',
    'A traveling theater troupe performs Shakespeare after a pandemic ends the world as we knew it.',
  ),
  book(
    'piranesi',
    'Piranesi',
    'Susanna Clarke',
    '2020',
    272,
    '9781635575637',
    'A man lives in a house of endless halls and tides, keeping careful journals.',
    ['Fantasy'],
  ),
  book(
    'hyperion',
    'Hyperion',
    'Dan Simmons',
    '1989',
    482,
    '9780553283686',
    'Seven pilgrims travel to the Time Tombs, each telling their story on the way.',
    ['Science fiction'],
  ),
  book(
    'circe',
    'Circe',
    'Madeline Miller',
    '2018',
    393,
    '9780316556347',
    'The witch of Aiaia tells her own story, from the halls of the gods to her island exile.',
    ['Fantasy'],
  ),
]

export function searchFixtures(query: string): Book[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return FIXTURE_BOOKS.filter((b) => {
    const haystack = `${b.title} ${b.authors.join(' ')}`.toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
}

export function getFixture(id: string): Book | null {
  return FIXTURE_BOOKS.find((b) => b.googleBooksId === id) ?? null
}
