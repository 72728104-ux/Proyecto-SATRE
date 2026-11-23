import { useEffect, useRef } from 'react'
import { STORAGE_PREFIX } from '../api/client'

const LAST_ACTIVITY_KEY = `${STORAGE_PREFIX}last_activity`
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
const WRITE_THROTTLE_MS = 5000
const CHECK_INTERVAL_MS = 15000

export function touchActivity() {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

/**
 * La última actividad se guarda en sessionStorage para sobrevivir a recargas y a pestañas suspendidas.
 */
export function useIdleTimeout({ enabled, timeoutMs, onIdle }) {
  const onIdleRef = useRef(onIdle)

  useEffect(() => {
    onIdleRef.current = onIdle
  })

  useEffect(() => {
    if (!enabled) return undefined

    if (!sessionStorage.getItem(LAST_ACTIVITY_KEY)) touchActivity()
    let lastWrite = 0
    let fired = false

    const check = () => {
      const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
      if (!fired && Date.now() - last >= timeoutMs) {
        fired = true
        onIdleRef.current?.()
      }
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite < WRITE_THROTTLE_MS) return
      check()
      if (fired) return
      lastWrite = now
      touchActivity()
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', check)

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled, timeoutMs])
}
