import type { Product } from '../types'

const PRIVATE_HOME_LABELS = new Set([
  'private saved home location',
  'saved home location',
  'home location',
])

const looksLikeCoordinates = (value: string) => /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(value.trim())

const cleanLocationText = (value?: string) => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (PRIVATE_HOME_LABELS.has(text.toLowerCase())) return ''
  if (looksLikeCoordinates(text)) return ''
  return text
}

export const getProductLocationLabel = (product: Partial<Product> | null | undefined): string => {
  if (!product) return 'Location to be decided'

  const locationType = product.location_type || 'no_location'
  const pickupAddress = cleanLocationText(product.pickup_address)
  const location = cleanLocationText(product.location)

  if (locationType === 'pickup_location') {
    return pickupAddress || location
      ? `Pickup at ${pickupAddress || location}`
      : 'Pickup location saved'
  }

  if (locationType === 'current_location') {
    return location ? `Pickup near ${location}` : 'Pickup area saved'
  }

  // Fallback: use raw location text even when location_type is not explicitly set
  const rawLocation = pickupAddress || location
  return rawLocation || 'Location to be decided'
}

export const getProductRawLocation = (product: Partial<Product> | null | undefined): string | null => {
  if (!product) return null
  const pickupAddress = cleanLocationText(product.pickup_address)
  const location = cleanLocationText(product.location)
  return pickupAddress || location || null
}

export const getProductLocationKey = (product: Partial<Product> | null | undefined): string => {
  return getProductLocationLabel(product).toLowerCase().replace(/\s+/g, ' ').trim()
}
