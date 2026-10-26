import { useEffect, useState } from 'react'

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('Copy this link:', text)
    }
  }

  return (
    <button type="button" className="button" onClick={copy}>
      {copied ? 'Copied!' : label}
    </button>
  )
}
