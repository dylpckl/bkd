import { describe, expect, it } from 'vitest'
import { colorFor, initials } from './initials'

describe('initials', () => {
  it('uses the first letters of the first two words', () => {
    expect(initials('Dylan Smith')).toBe('DS')
    expect(initials('Jimmy')).toBe('J')
    expect(initials('  ')).toBe('?')
  })
  it('skips articles for club names', () => {
    expect(initials('The Overdue Society', { skipArticles: true })).toBe('OS')
    expect(initials('The', { skipArticles: true })).toBe('T')
  })
})

describe('colorFor', () => {
  it('is stable per id', () => {
    expect(colorFor('abc')).toBe(colorFor('abc'))
  })
})
