// Reads auth emails from the Mailpit inbox that `supabase start` runs.
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

type Summary = { ID: string; To: { Address: string }[]; Created: string }

export async function latestLinkFor(
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    const { messages } = (await res.json()) as { messages: Summary[] }
    if (messages.length) {
      const msg = await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json()
      const html: string = msg.HTML || msg.Text
      const link =
        html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ??
        html.match(/(http\S*\/auth\/v1\/verify\S*)/)?.[1]
      if (link) return link.replaceAll('&amp;', '&')
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No auth email for ${email}`)
}
