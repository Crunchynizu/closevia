import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
const PWA_INSTALLED_KEY = 'clovia_pwa_installed'
const PWA_DISMISSED_KEY = 'clovia_install_dismissed'

export const isRunningStandalone = (): boolean => {
  // Check for standalone display (PWA)
  const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches
  
  // Check for iOS standalone
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  
  // Check for TWA (Trusted Web Activity) - Android native app
  const isTWA = (window as any).navigator.userAgent?.includes('Chrome/') && 
                (window as any).navigationInterface !== undefined
  
  // Check for Android app wrapper (Capacitor, etc.)
  const isAndroidApp = (window as any).Capacitor !== undefined
  
  // Check if running in Chrome Custom Tab (TWA uses this)
  const isChromeCustomTab = window.matchMedia('(display-mode: minimal-ui)').matches ||
                            (window as any).navigator.userAgent?.includes('NoStaticShellMode') === true
  
  return isStandaloneDisplay || isIosStandalone || isTWA || isAndroidApp || isChromeCustomTab
}

export const isAppInstalled = (): boolean => {
  try {
    return isRunningStandalone() || localStorage.getItem(PWA_INSTALLED_KEY) === 'true'
  } catch {
    return isRunningStandalone()
  }
}

export const markInstallDismissed = (): void => {
  try { localStorage.setItem(PWA_DISMISSED_KEY, 'true') } catch {}
}

export const wasInstallDismissed = (): boolean => {
  try { return localStorage.getItem(PWA_DISMISSED_KEY) === 'true' } catch { return false }
}

export const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD) {
    // If a service worker was previously registered (e.g. after running a production build),
    // it may continue to serve cached assets and make localhost appear "stuck" on old UI.
    // In dev, proactively unregister and clear caches.
    try {
      const hadActiveController = !!navigator.serviceWorker?.controller
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          Promise.all(regs.map((r) => r.unregister())).then(() => {
            if (
              hadActiveController &&
              !sessionStorage.getItem('clovia_dev_sw_reloaded')
            ) {
              sessionStorage.setItem('clovia_dev_sw_reloaded', 'true')
              window.location.reload()
            }
          })
        })
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => caches.delete(k))
        })
      }
    } catch {
      // ignore
    }
    return
  }

  registerSW({
    immediate: true,
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      if (registration && import.meta.env.DEV) {
        console.info('Service worker registered')
      }
    },
    onRegisterError(error: unknown) {
      console.error('Service worker registration failed:', error)
    },
  })
}

export const initializeInstallPrompt = (onChange?: (isAvailable: boolean) => void): (() => void) => {
  if (!import.meta.env.PROD) {
    return () => {}
  }

  const handleBeforeInstallPrompt = (event: Event) => {
    if (isAppInstalled()) {
      deferredInstallPrompt = null
      onChange?.(false)
      return
    }
    event.preventDefault()
    deferredInstallPrompt = event as BeforeInstallPromptEvent
    onChange?.(!wasInstallDismissed())
  }

  const handleAppInstalled = () => {
    deferredInstallPrompt = null
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true')
      localStorage.removeItem(PWA_DISMISSED_KEY)
      localStorage.removeItem('app-download-banner-dismissed')
    } catch {}
    onChange?.(false)
    window.dispatchEvent(new Event('clovia:pwa-installed'))
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  }
}

export const canShowInstallPrompt = (): boolean => deferredInstallPrompt !== null && !isAppInstalled() && !wasInstallDismissed()

export const promptInstall = async (): Promise<boolean> => {
  if (!deferredInstallPrompt) {
    return false
  }

  await deferredInstallPrompt.prompt()
  const choice = await deferredInstallPrompt.userChoice
  const accepted = choice.outcome === 'accepted'

  if (accepted) {
    deferredInstallPrompt = null
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true')
      localStorage.removeItem(PWA_DISMISSED_KEY)
      localStorage.removeItem('app-download-banner-dismissed')
    } catch {}
    window.dispatchEvent(new Event('clovia:pwa-installed'))
  }

  return accepted
}
