import { API_BASE_URL } from '../services/api'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

const getBackendAssetBaseUrl = (): string => {
  const configured = API_BASE_URL.replace(/\/$/, '')
  if (configured) return configured

  if (typeof window === 'undefined') {
    return 'http://localhost:4000'
  }

  const { protocol, hostname } = window.location
  const normalizedHost = hostname === '::1' ? '127.0.0.1' : hostname
  if (LOOPBACK_HOSTS.has(normalizedHost)) {
    return `${protocol}//${normalizedHost}:4000`
  }

  return ''
}

const backendUrl = getBackendAssetBaseUrl()
const LOCAL_IMAGE_FALLBACK = '/no-image.svg'
const CLIENT_PUBLIC_IMAGE_PREFIXES = ['/assets/', '/images/', '/icons/']
const CLIENT_PUBLIC_IMAGE_FILES = new Set(['/placeholder.svg', '/no-image.svg'])

const isLoopbackUploadUrl = (url: URL): boolean => {
  return LOOPBACK_HOSTS.has(url.hostname) && url.pathname.startsWith('/uploads/')
}

export const normalizeImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return ''
  const trimmedPath = imagePath.trim()
  if (!trimmedPath) return ''

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    try {
      const url = new URL(trimmedPath)
      if (isLoopbackUploadUrl(url)) {
        return `${backendUrl}${url.pathname}${url.search}${url.hash}`
      }
    } catch {
      return trimmedPath
    }
  }

  return trimmedPath
}

const isClientPublicImagePath = (path: string): boolean => {
  if (CLIENT_PUBLIC_IMAGE_FILES.has(path)) return true
  return CLIENT_PUBLIC_IMAGE_PREFIXES.some(prefix => path.startsWith(prefix))
}

// Cloudinary transformation helper - Build optimized URL with transformations
const buildCloudinaryUrl = (url: string, transformations: string): string => {
  const parts = url.split('/upload/')
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformations}/${parts[1]}`
  }
  return url
}

// Utility function to add Cloudinary transformations for optimized image loading
export const optimizeCloudinaryUrl = (url: string, options?: { width?: number; quality?: string; format?: string }): string => {
  if (!url.includes('cloudinary.com')) return url
  
  const { width = 200, quality = 'auto', format = 'auto' } = options || {}
  
  // Insert transformation parameters into Cloudinary URL
  // Format: https://res.cloudinary.com/{cloud_name}/image/upload/w_{width},q_{quality},f_{format}/{path}
  return buildCloudinaryUrl(url, `w_${width},q_${quality},f_${format}`)
}

// Generate responsive image srcset for Cloudinary images
export const generateCloudinarySrcSet = (url: string, baseWidth: number = 300): string => {
  if (!url.includes('cloudinary.com')) return url
  
  // Generate sizes: 1x, 1.5x (tablet), 2x (retina)
  const sizes = [
    { width: baseWidth, multiplier: 1 },
    { width: Math.round(baseWidth * 1.5), multiplier: 1.5 },
    { width: Math.round(baseWidth * 2), multiplier: 2 }
  ]
  
  return sizes
    .map(({ width }) => {
      const optimized = buildCloudinaryUrl(
        url,
        `w_${width},q_auto,f_auto`
      )
      return `${optimized} ${width}w`
    })
    .join(', ')
}

// Get WebP URL with fallback format
export const getOptimizedImageWithFallback = (url: string, width: number = 300): { webp: string; fallback: string } => {
  if (!url.includes('cloudinary.com')) {
    return { webp: url, fallback: url }
  }
  
  const webp = buildCloudinaryUrl(url, `w_${width},q_auto,f_webp`)
  const fallback = buildCloudinaryUrl(url, `w_${width},q_auto,f_jpg`)
  
  return { webp, fallback }
}

// Utility function to add cache busting to image URLs
export const addCacheBuster = (url: string | null | undefined): string => {
  if (!url) return ''
  
  const cacheBuster = `t=${Date.now()}`
  if (url.includes('?')) {
    return `${url}&${cacheBuster}`
  }
  return `${url}?${cacheBuster}`
}

// Utility function to construct proper image URLs with optimization
export const getImageUrl = (imagePath: string | null | undefined, cacheBust: boolean = false, optimize: boolean = false, width: number = 300): string => {
  if (!imagePath) {
    // Use a local static fallback to avoid external network failures
    return LOCAL_IMAGE_FALLBACK
  }

  const normalizedPath = normalizeImageUrl(imagePath)
  if (!normalizedPath) return LOCAL_IMAGE_FALLBACK
  if (isClientPublicImagePath(normalizedPath)) {
    return cacheBust ? addCacheBuster(normalizedPath) : normalizedPath
  }
  
  // If it's already a full URL, optionally optimize if Cloudinary
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    const optimized = optimize ? optimizeCloudinaryUrl(normalizedPath, { width, quality: 'auto' }) : normalizedPath
    return cacheBust ? addCacheBuster(optimized) : optimized
  }
  
  // If it's a relative path, prepend the backend URL
  const fullUrl = normalizedPath.startsWith('/uploads/') && backendUrl
    ? `${backendUrl}${normalizedPath}`
    : `${backendUrl}${normalizedPath}`
  return cacheBust ? addCacheBuster(fullUrl) : fullUrl
}

// Utility function to get the first image from an array with optional optimization
export const getFirstImage = (imageUrls: string[] | null | undefined, optimize: boolean = false, width: number = 300): string => {
  if (!imageUrls || imageUrls.length === 0) {
    // Use a local static fallback to avoid external network failures
    return LOCAL_IMAGE_FALLBACK
  }
  
  return getImageUrl(imageUrls[0], false, optimize, width)
}
