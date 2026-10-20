import { useState } from 'react'
import { Check, Copy, Share } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { APP_NAME, inviteUrl } from '#/lib/config'

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function useInviteActions(token: string, clubName: string) {
  const url = inviteUrl(token)
  const [copied, setCopied] = useState(false)

  const doCopy = async () => {
    if (await copy(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Couldn't copy. Select the link and copy it yourself.")
    }
  }

  /** Native share sheet where there is one, copying everywhere else. */
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join ${clubName} on ${APP_NAME}`,
          text: `Join ${clubName} on ${APP_NAME}`,
          url,
        })
        return
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
      }
    }
    if (await copy(url))
      toast.success('Link copied. Paste it in your group chat.')
  }

  return { url, copied, copy: doCopy, share }
}

/** Read-only link field with a copy button next to it. */
export function InviteLinkField({
  url,
  copied,
  onCopy,
  compact = false,
}: {
  url: string
  copied: boolean
  onCopy: () => void
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Input
        readOnly
        value={url.replace(/^https?:\/\//, '')}
        aria-label="Invite link"
        className="font-mono text-[13px]"
        onFocus={(e) => e.currentTarget.select()}
      />
      {compact ? (
        <Button
          variant="outline"
          size="icon"
          className="size-12"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="min-w-21"
          onClick={onCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}
    </div>
  )
}

export { Share as ShareIcon }
