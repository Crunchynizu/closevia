export const formatPHP = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'PHP 0.00'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

export const formatEstimatedValueRange = (
  min: number | null | undefined,
  max: number | null | undefined
): string => {
  const normalizedMin = Number(min)
  const normalizedMax = Number(max)

  if (!Number.isFinite(normalizedMin) && !Number.isFinite(normalizedMax)) {
    return 'PHP 0'
  }
  if (!Number.isFinite(normalizedMin)) {
    return formatPHP(normalizedMax).replace('.00', '')
  }
  if (!Number.isFinite(normalizedMax)) {
    return formatPHP(normalizedMin).replace('.00', '')
  }
  if (normalizedMin === normalizedMax) {
    return formatPHP(normalizedMin).replace('.00', '')
  }

  const formattedMin = formatPHP(normalizedMin).replace('.00', '')
  const formattedMax = formatPHP(normalizedMax).replace('.00', '')
  return `${formattedMin} - ${formattedMax}`
}
