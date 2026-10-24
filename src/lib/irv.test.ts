import { describe, expect, it } from 'vitest'
import { finishNote, runIrv } from '../../supabase/functions/_shared/irv.ts'
import type {
  Finisher,
  IrvResult,
} from '../../supabase/functions/_shared/irv.ts'

type Decided = Exclude<IrvResult, { method: 'cancelled' }>

function decided(r: IrvResult): Decided {
  if (r.method === 'cancelled') throw new Error('expected a winner')
  return r
}

const notes = (r: Decided) =>
  r.finishingOrder.map((f) => [f.id, finishNote(f, r.method)])

describe('runIrv edge cases', () => {
  it('cancels a round with no nominations', () => {
    expect(runIrv({ nominations: [], ballots: [['a']], seed: 's' })).toEqual({
      method: 'cancelled',
    })
  })

  it('a single nomination wins automatically', () => {
    const r = decided(runIrv({ nominations: ['a'], ballots: [], seed: 's' }))
    expect(r.method).toBe('single')
    expect(r.winner).toBe('a')
    expect(finishNote(r.finishingOrder[0], r.method)).toBe(
      'Winner · only nomination',
    )
  })

  it('picks at random, reproducibly, when nobody voted', () => {
    const input = {
      nominations: ['a', 'b', 'c', 'd'],
      ballots: [],
      seed: 'seed-1',
    }
    const r1 = decided(runIrv(input))
    const r2 = decided(runIrv({ ...input, nominations: ['d', 'c', 'b', 'a'] }))
    expect(r1.method).toBe('random')
    expect(r1.winner).toBe(r2.winner)
    expect(r1.finishingOrder.map((f) => f.id).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(finishNote(r1.finishingOrder[0], 'random')).toBe('Picked at random')
    // Different seeds can pick differently.
    const winners = new Set(
      ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'].map(
        (seed) => decided(runIrv({ ...input, seed })).winner,
      ),
    )
    expect(winners.size).toBeGreaterThan(1)
  })

  it('treats ballots that rank only removed nominations as no ballots', () => {
    const r = decided(
      runIrv({ nominations: ['a', 'b'], ballots: [['gone']], seed: 's' }),
    )
    expect(r.method).toBe('random')
  })

  it('ignores duplicate and unknown ids within a ballot', () => {
    const r = decided(
      runIrv({
        nominations: ['a', 'b'],
        ballots: [['a', 'a', 'zzz', 'b'], ['b'], ['a']],
        seed: 's',
      }),
    )
    expect(r.counts[0].votes).toEqual({ a: 2, b: 1 })
    expect(r.winner).toBe('a')
  })
})

describe('runIrv counting', () => {
  it('declares an outright first-count majority', () => {
    const r = decided(
      runIrv({
        nominations: ['a', 'b', 'c'],
        ballots: [['a'], ['a'], ['b'], ['a', 'c']],
        seed: 's',
      }),
    )
    expect(r.counts).toHaveLength(1)
    expect(r.winner).toBe('a')
    expect(notes(r)).toEqual([
      ['a', 'Winner · more than half'],
      ['b', 'Runner-up'],
      ['c', 'Still in at the end'],
    ])
  })

  it('transfers votes until someone has more than half (the mockup example)', () => {
    // 6 ballots. Piranesi (p) wins 4–2 against Hail Mary (h) after Left Hand (l) then Klara (k) go out.
    const ballots = [
      ['p', 'h'],
      ['p'],
      ['h', 'k'],
      ['h'],
      ['k', 'p'],
      ['l', 'p'],
    ]
    const r = decided(
      runIrv({ nominations: ['p', 'h', 'k', 'l'], ballots, seed: 's' }),
    )
    expect(r.winner).toBe('p')
    expect(r.counts.map((c) => c.votes)).toEqual([
      { p: 2, h: 2, k: 1, l: 1 },
      { p: 3, h: 2, k: 1 },
      { p: 4, h: 2 },
    ])
    expect(notes(r)).toEqual([
      ['p', 'Winner · more than half'],
      ['h', 'Runner-up'],
      ['k', 'Knocked out second'],
      ['l', 'Knocked out first (tied, but on fewer ballots)'],
    ])
    expect(r.finishingOrder.map((f: Finisher) => f.finalVotes)).toEqual([
      4, 2, 1, 1,
    ])
  })

  it('drops exhausted ballots from the majority threshold', () => {
    // After c goes out, its single-choice ballot is exhausted: a has 2 of 3 active ballots.
    const ballots = [['a'], ['a'], ['b'], ['c']]
    const r = decided(
      runIrv({ nominations: ['a', 'b', 'c'], ballots, seed: 's' }),
    )
    // Count 1: a=2 of 4 is not more than half.
    expect(r.counts[0].votes).toEqual({ a: 2, b: 1, c: 1 })
    expect(r.counts.at(-1)?.exhausted).toBeGreaterThan(0)
    expect(r.winner).toBe('a')
  })

  it('breaks a tie using an earlier count first', () => {
    // Count 1: a=3 b=3 c=2 d=1 → d out (transfers to c).
    // Count 2: a=3 b=3 c=3 → three-way tie; in count 1 c had fewest → c out.
    const ballots = [
      ['a'],
      ['a'],
      ['a'],
      ['b'],
      ['b'],
      ['b'],
      ['c'],
      ['c'],
      ['d', 'c'],
    ]
    const r = decided(
      runIrv({ nominations: ['a', 'b', 'c', 'd'], ballots, seed: 's' }),
    )
    expect(r.counts[1].eliminated).toBe('c')
    expect(r.counts[1].tiebreak).toBe('previous')
    expect(notes(r).find(([id]) => id === 'c')?.[1]).toBe(
      'Knocked out second (tied, but behind in an earlier count)',
    )
  })

  it('falls back to a seeded draw when every tiebreak is level', () => {
    const input = {
      nominations: ['a', 'b'],
      ballots: [['a'], ['b']],
      seed: 'draw',
    }
    const r = decided(runIrv(input))
    expect(r.counts[0].tiebreak).toBe('random')
    expect(decided(runIrv(input)).winner).toBe(r.winner)
    expect(notes(r)[1][1]).toBe('Runner-up')
  })

  it('still finishes when every remaining nomination has no votes', () => {
    // Nobody ranked c or d; they go out first, then a/b decide it.
    const r = decided(
      runIrv({
        nominations: ['a', 'b', 'c', 'd'],
        ballots: [['a'], ['a'], ['b']],
        seed: 's',
      }),
    )
    expect(r.winner).toBe('a')
    expect(r.finishingOrder).toHaveLength(4)
  })
})
