// Closes voting and counts the votes with instant-runoff.
//   POST {}            with the service-role key (pg_cron): closes every overdue round
//   POST { round_id }  with an admin's JWT: closes that round now ("End early")
// Idempotent: a round that is already closed (or being closed) is skipped.
import { corsHeaders, json } from '../_shared/http.ts'
import { asService, asUser, isServiceCall } from '../_shared/rest.ts'
import { runIrv } from '../_shared/irv.ts'

type Claim = {
  round_id: string
  nominations: string[]
  ballots: string[][]
} | null

async function closeRound(roundId: string, early: boolean) {
  const { data: claim, error } = await asService.rpc<Claim>(
    'claim_round_close',
    { p_round_id: roundId, p_early: early },
  )
  if (error) throw new Error(`claim ${roundId}: ${error.message}`)
  if (!claim) return { round_id: roundId, status: 'skipped' as const }

  const result = runIrv({
    nominations: claim.nominations,
    ballots: claim.ballots,
    seed: crypto.randomUUID(),
  })
  const { data: clubBookId, error: finalizeError } = await asService.rpc<
    string | null
  >('finalize_round', {
    p_round_id: roundId,
    p_result: result,
  })
  if (finalizeError)
    throw new Error(`finalize ${roundId}: ${finalizeError.message}`)
  return {
    round_id: roundId,
    status:
      result.method === 'cancelled'
        ? ('cancelled' as const)
        : ('closed' as const),
    club_book_id: clubBookId,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'not_authenticated' }, 401)
  let body: { round_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is fine for cron calls.
  }

  try {
    if (isServiceCall(authorization)) {
      const { data: due, error } = await asService.rpc<string[]>(
        'rounds_due_for_close',
        {},
      )
      if (error) throw new Error(error.message)
      const ids = body.round_id ? [body.round_id] : (due ?? [])
      const results = []
      for (const id of ids) {
        try {
          results.push(await closeRound(id, false))
        } catch (e) {
          // One bad round shouldn't block the rest; the next cron run retries it.
          console.error(e)
          results.push({ round_id: id, status: 'error' as const })
        }
      }
      return json({ results })
    }

    if (!body.round_id) return json({ error: 'bad_request' }, 400)
    const { data: allowed } = await asUser(authorization).rpc<boolean>(
      'can_close_round',
      { p_round_id: body.round_id },
    )
    if (!allowed) return json({ error: 'not_allowed' }, 403)
    return json(await closeRound(body.round_id, true))
  } catch (e) {
    console.error(e)
    return json({ error: 'server_error' }, 500)
  }
})
