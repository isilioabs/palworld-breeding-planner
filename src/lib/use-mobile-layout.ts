import { useEffect, useState } from 'react'

// Matches the breakpoint where the desktop sidebar becomes the mobile bottom
// navigation, keeping the entire planner in one coherent responsive mode.
const MOBILE_QUERY = '(max-width: 819px)'

/**
 * Shared mobile-layout signal for places where CSS hiding is not enough.
 * Expensive secondary interfaces use this hook so their DOM is never mounted
 * on a phone until the player explicitly requests it.
 */
export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  ))

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return mobile
}
