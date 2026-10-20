// Instant-runoff voting. Pure TypeScript with no runtime APIs, so the close-round
// edge function and the app (results page, unit tests) share one implementation.
//
// Rules (docs/PLAN.md §3):
// - Each count tallies every ballot's highest-ranked remaining nomination.
// - A nomination with more than half of the non-exhausted ballots wins.
// - Otherwise the nomination with the fewest votes is knocked out. Ties go to:
//   1. fewest votes in earlier counts, walking back one count at a time,
//   2. fewest total appearances across all ballots,
//   3. a seeded random pick (the seed is stored with the results).
// - 0 nominations: cancelled. 1 nomination: it wins. No ballots: random pick.

export type Tiebreak = 'previous' | 'appearances' | 'random'

export type Count = {
  /** Votes per remaining nomination in this count. */
  votes: Record<string, number>
  /** Ballots with no remaining nominations ranked. */
  exhausted: number
  /** Knocked out at the end of this count (absent on the final count). */
  eliminated?: string
  tiebreak?: Tiebreak
}

export type Finisher = {
  id: string
  /** 1 = winner. */
  place: number
  /** Votes in the last count this nomination took part in. */
  finalVotes: number
  outcome: 'winner' | 'runner-up' | 'still-in' | 'knocked-out' | 'not-picked'
  /** 1 = first knocked out. Only for outcome 'knocked-out'. */
  knockedOutOrder?: number
  tiebreak?: Tiebreak
}

export type IrvResult =
  | { method: 'cancelled' }
  | {
      method: 'single' | 'random' | 'irv'
      winner: string
      /** Ballots that ranked at least one nomination. */
      ballots: number
      counts: Count[]
      finishingOrder: Finisher[]
      seed: string
    }

export type IrvInput = {
  /** Every nomination in the round, in nomination order. */
  nominations: string[]
  /** Each ballot ranks nomination ids, best first. */
  ballots: string[][]
  seed: string
}

// cyrb53-style string hash → mulberry32 generator. Deterministic for a given seed.
function seededRandom(seed: string) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  let a =
    (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>>
    0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Picks one id; sorts first so the result depends only on the seed, not input order. */
function pick(ids: string[], random: () => number) {
  const sorted = [...ids].sort()
  return sorted[Math.floor(random() * sorted.length)]
}

function shuffle(ids: string[], random: () => number) {
  const out = [...ids].sort()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Keeps known nominations, first occurrence only, and drops ballots left empty. */
function cleanBallots(ballots: string[][], nominations: Set<string>) {
  return ballots
    .map((b) => {
      const seen = new Set<string>()
      return b.filter(
        (id) => nominations.has(id) && !seen.has(id) && seen.add(id),
      )
    })
    .filter((b) => b.length > 0)
}

export function runIrv({
  nominations,
  ballots: rawBallots,
  seed,
}: IrvInput): IrvResult {
  const all = [...new Set(nominations)]
  if (all.length === 0) return { method: 'cancelled' }

  const random = seededRandom(seed)
  const ballots = cleanBallots(rawBallots, new Set(all))

  if (all.length === 1) {
    const votes = { [all[0]]: ballots.length }
    return {
      method: 'single',
      winner: all[0],
      ballots: ballots.length,
      counts: [{ votes, exhausted: 0 }],
      finishingOrder: [
        { id: all[0], place: 1, finalVotes: ballots.length, outcome: 'winner' },
      ],
      seed,
    }
  }

  if (ballots.length === 0) {
    const order = shuffle(all, random)
    return {
      method: 'random',
      winner: order[0],
      ballots: 0,
      counts: [],
      finishingOrder: order.map((id, i) => ({
        id,
        place: i + 1,
        finalVotes: 0,
        outcome: i === 0 ? 'winner' : 'not-picked',
      })),
      seed,
    }
  }

  const appearances = new Map(all.map((id) => [id, 0]))
  for (const b of ballots)
    for (const id of b) appearances.set(id, (appearances.get(id) ?? 0) + 1)

  const remaining = new Set(all)
  const counts: Count[] = []
  const lastVotes = new Map<string, number>()
  const knockedOut: { id: string; tiebreak?: Tiebreak }[] = []
  let winner: string | null = null

  while (winner === null) {
    const votes: Record<string, number> = {}
    for (const id of remaining) votes[id] = 0
    let exhausted = 0
    for (const b of ballots) {
      const top = b.find((id) => remaining.has(id))
      if (top) votes[top] += 1
      else exhausted += 1
    }
    for (const id of remaining) lastVotes.set(id, votes[id])

    const count: Count = { votes, exhausted }
    counts.push(count)

    const active = ballots.length - exhausted
    const leader = [...remaining].find((id) => votes[id] * 2 > active)
    if (leader) {
      winner = leader
      break
    }
    if (remaining.size === 1) {
      winner = [...remaining][0]
      break
    }

    const fewest = Math.min(...[...remaining].map((id) => votes[id]))
    let tied = [...remaining].filter((id) => votes[id] === fewest)
    let tiebreak: Tiebreak | undefined

    if (tied.length > 1) {
      // 1. Walk back through earlier counts.
      for (let k = counts.length - 2; k >= 0 && tied.length > 1; k--) {
        const earlier = counts[k].votes
        const low = Math.min(...tied.map((id) => earlier[id] ?? 0))
        const narrowed = tied.filter((id) => (earlier[id] ?? 0) === low)
        if (narrowed.length < tied.length) {
          tied = narrowed
          if (tied.length === 1) tiebreak = 'previous'
        }
      }
    }
    if (tied.length > 1) {
      // 2. Fewest appearances on any ballot.
      const low = Math.min(...tied.map((id) => appearances.get(id) ?? 0))
      const narrowed = tied.filter((id) => (appearances.get(id) ?? 0) === low)
      if (narrowed.length < tied.length) {
        tied = narrowed
        if (tied.length === 1) tiebreak = 'appearances'
      }
    }
    if (tied.length > 1) {
      // 3. Seeded random.
      tied = [pick(tied, random)]
      tiebreak = 'random'
    }

    const out = tied[0]
    count.eliminated = out
    if (tiebreak) count.tiebreak = tiebreak
    knockedOut.push({ id: out, tiebreak })
    remaining.delete(out)
  }

  // Winner first, then anything still in at the end (by final votes, then
  // appearances), then knocked-out nominations, last knocked out first.
  const stillIn = [...remaining]
    .filter((id) => id !== winner)
    .sort(
      (a, b) =>
        (lastVotes.get(b) ?? 0) - (lastVotes.get(a) ?? 0) ||
        (appearances.get(b) ?? 0) - (appearances.get(a) ?? 0) ||
        all.indexOf(a) - all.indexOf(b),
    )
  const finishingOrder: Finisher[] = [
    {
      id: winner,
      place: 1,
      finalVotes: lastVotes.get(winner) ?? 0,
      outcome: 'winner',
    },
    ...stillIn.map((id): Finisher => ({
      id,
      place: 0,
      finalVotes: lastVotes.get(id) ?? 0,
      outcome: 'still-in',
    })),
    ...knockedOut
      .map((k, i): Finisher => ({
        id: k.id,
        place: 0,
        finalVotes: lastVotes.get(k.id) ?? 0,
        outcome: 'knocked-out',
        knockedOutOrder: i + 1,
        ...(k.tiebreak ? { tiebreak: k.tiebreak } : {}),
      }))
      .reverse(),
  ]
  finishingOrder.forEach((f, i) => {
    f.place = i + 1
    if (i === 1 && f.outcome === 'still-in') f.outcome = 'runner-up'
  })
  // When the race went down to two, the last one knocked out is the runner-up.
  if (
    finishingOrder[1]?.outcome === 'knocked-out' &&
    finishingOrder[1].knockedOutOrder === knockedOut.length
  ) {
    finishingOrder[1].outcome = 'runner-up'
  }

  return {
    method: 'irv',
    winner,
    ballots: ballots.length,
    counts,
    finishingOrder,
    seed,
  }
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
]

const TIEBREAK_NOTE: Record<Tiebreak, string> = {
  previous: 'tied, but behind in an earlier count',
  appearances: 'tied, but on fewer ballots',
  random: 'tied, and lost a random draw',
}

/** The short note on the results page: "Winner · more than half", "Knocked out first (tied, but on fewer ballots)". */
export function finishNote(
  f: Finisher,
  method: 'single' | 'random' | 'irv',
): string {
  if (f.outcome === 'winner') {
    if (method === 'random') return 'Picked at random'
    if (method === 'single') return 'Winner · only nomination'
    return 'Winner · more than half'
  }
  if (f.outcome === 'runner-up') return 'Runner-up'
  if (f.outcome === 'still-in') return 'Still in at the end'
  if (f.outcome === 'not-picked') return 'Not picked'
  const nth = ORDINALS[(f.knockedOutOrder ?? 1) - 1] ?? `#${f.knockedOutOrder}`
  return `Knocked out ${nth}${f.tiebreak ? ` (${TIEBREAK_NOTE[f.tiebreak]})` : ''}`
}
