const AUTH_SYNC_KEY = 'clovia_auth_sync'
const SESSION_ACTIVITY_KEY = 'clovia_session_activity'

type AuthSyncType = 'login' | 'logout'

interface AuthSyncEvent {
  type: AuthSyncType
  at: number
}

export const broadcastAuthSync = (type: AuthSyncType): void => {
  try {
    const payload: AuthSyncEvent = { type, at: Date.now() }
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures; same-tab auth still works.
  }
}

export const onAuthSync = (handler: (type: AuthSyncType) => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_KEY || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue) as AuthSyncEvent
      if (parsed?.type === 'login' || parsed?.type === 'logout') {
        handler(parsed.type)
      }
    } catch {
      // Ignore malformed sync payloads.
    }
  }

  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

export const getLastSessionActivity = (): number => {
  try {
    const raw = localStorage.getItem(SESSION_ACTIVITY_KEY)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now()
  } catch {
    return Date.now()
  }
}

export const broadcastSessionActivity = (at = Date.now()): number => {
  try {
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(at))
  } catch {
    // Ignore storage failures; timers will still work in the current tab.
  }
  return at
}

export const onSessionActivity = (handler: (at: number) => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== SESSION_ACTIVITY_KEY || !event.newValue) return
    const at = Number(event.newValue)
    if (Number.isFinite(at) && at > 0) {
      handler(at)
    }
  }

  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
