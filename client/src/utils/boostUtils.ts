const HOUR_MS = 60 * 60 * 1000

type BoostableProduct = {
  boosted_at?: string | null
  boost_duration_hours?: number | null
  seller_premium_tier?: string | null
}

const normalizeBoostTimestamp = (value: string): number => {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

export const getBoostDurationMs = (sellerPremiumTier?: string | null): number => {
  return sellerPremiumTier === 'pro' ? 6 * HOUR_MS : 3 * HOUR_MS
}

export const getBoostStatus = (product: BoostableProduct) => {
  const configuredHours = Number(product.boost_duration_hours)
  const durationMs = Number.isFinite(configuredHours) && configuredHours > 0
    ? configuredHours * HOUR_MS
    : getBoostDurationMs(product.seller_premium_tier)

  if (!product.boosted_at) {
    return {
      isBoosted: false,
      expiresAt: 0,
      remainingMs: 0,
      durationMs,
    }
  }

  const boostedAt = normalizeBoostTimestamp(String(product.boosted_at))
  if (Number.isNaN(boostedAt)) {
    return {
      isBoosted: false,
      expiresAt: 0,
      remainingMs: 0,
      durationMs,
    }
  }

  const expiresAt = boostedAt + durationMs
  const remainingMs = Math.max(0, expiresAt - Date.now())

  return {
    isBoosted: remainingMs > 0,
    expiresAt,
    remainingMs,
    durationMs,
  }
}
