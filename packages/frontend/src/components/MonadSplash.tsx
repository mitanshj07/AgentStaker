import { useEffect, useState } from 'react'

export function MonadSplash() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setIsVisible(false), 300)
    return () => window.clearTimeout(hideTimer)
  }, [])

  if (!isVisible) return null

  return (
    <div aria-label="Loading Monad ArenaX" aria-live="polite" className="launch-screen" role="status">
      <img alt="Monad ArenaX prediction exchange on Monad testnet" className="launch-logo" src="/monad-arenax-logo.png" />
    </div>
  )
}
