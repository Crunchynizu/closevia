const TOKEN_KEY = 'clovia_token'
const USER_KEY = 'clovia_user'
const AUTHENTICATED_SESSION_KEY = 'clovia_authenticated_session'

export const getStoredToken = (): string | null => {
  try { sessionStorage.removeItem(TOKEN_KEY) } catch {}
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
  return null
}

export const setStoredToken = (token: string | null): void => {
  void token
  try { sessionStorage.removeItem(TOKEN_KEY) } catch {}
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

export const getStoredUser = (): string | null => {
  const localUser = localStorage.getItem(USER_KEY)
  if (localUser) return localUser

  const legacySessionUser = sessionStorage.getItem(USER_KEY)
  if (legacySessionUser) {
    localStorage.setItem(USER_KEY, legacySessionUser)
    sessionStorage.removeItem(USER_KEY)
    return legacySessionUser
  }

  return null
}

export const setStoredUser = (value: string | null): void => {
  if (value) {
    localStorage.setItem(USER_KEY, value)
  } else {
    localStorage.removeItem(USER_KEY)
  }
  try { sessionStorage.removeItem(USER_KEY) } catch {}
}

export const hasStoredAuthenticatedSession = (): boolean => {
  try {
    return localStorage.getItem(AUTHENTICATED_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

export const setStoredAuthenticatedSession = (value: boolean): void => {
  try {
    if (value) {
      localStorage.setItem(AUTHENTICATED_SESSION_KEY, 'true')
    } else {
      localStorage.removeItem(AUTHENTICATED_SESSION_KEY)
    }
  } catch {
    // Ignore storage failures; auth still works in-memory for the current tab.
  }
}

export const clearStoredAuth = (): void => {
  setStoredToken(null)
  setStoredUser(null)
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
  try { sessionStorage.removeItem(TOKEN_KEY) } catch {}
  try { sessionStorage.removeItem(USER_KEY) } catch {}
}
