import React from 'react'
import { Badge, Tooltip, Spinner, HStack, Icon, useColorModeValue } from '@chakra-ui/react'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DistanceResult } from '../types'

interface ProximityBadgeProps {
  type: 'user' | 'product'
  targetId: number
  showIcon?: boolean
  prefetchedDistanceKm?: number | null
  prefetchedDistanceLabel?: string | null
}

const AI_DISABLED = import.meta.env.VITE_DISABLE_AI === 'true'

const ProximityBadge: React.FC<ProximityBadgeProps> = ({
  type,
  targetId,
  showIcon = true,
  prefetchedDistanceKm,
  prefetchedDistanceLabel,
}) => {
  const { user, isAuthenticated } = useAuth()
  const badgeBg = useColorModeValue('whiteAlpha.900', 'blackAlpha.800')
  const badgeColor = useColorModeValue('brand.600', 'brand.300')
  const hasPrefetchedDistance = Number.isFinite(prefetchedDistanceKm) || !!prefetchedDistanceLabel
  const canFetchProximity = !!targetId && !AI_DISABLED && isAuthenticated && !hasPrefetchedDistance

  const { data: distance, isLoading: loading, error } = useQuery<DistanceResult | null>({
    queryKey: ['proximity', user?.id, type, targetId],
    queryFn: async () => {
      const response = await api.get('/api/ai/proximity', {
        params: { type, target_id: targetId },
      })
      if (response.data?.success && response.data?.data) {
        return response.data.data as DistanceResult
      }
      return null
    },
    enabled: canFetchProximity,
    staleTime: 1000 * 60 * 15, // 15 minutes — locked home locations rarely change
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const formatPrefetchedDistance = () => {
    if (prefetchedDistanceLabel && prefetchedDistanceLabel.trim()) {
      return prefetchedDistanceLabel.replace(/\s+/g, ' ').trim()
    }

    const km = prefetchedDistanceKm ?? 0
    if (!Number.isFinite(km)) return ''
    if (km < 1) {
      return `${Math.round(km * 1000)}m away`
    }
    if (km < 10) {
      return `${km.toFixed(1)}km away`
    }
    return `${Math.round(km)}km away`
  }

  if (hasPrefetchedDistance) {
    const displayLabel = formatPrefetchedDistance()
    if (!displayLabel) return null

    return (
      <Tooltip label={`Distance: ${Number.isFinite(prefetchedDistanceKm) ? prefetchedDistanceKm!.toFixed(2) : 'N/A'} km`}>
        <Badge
          bg={badgeBg}
          color={badgeColor}
          variant="solid"
          fontSize="10px"
          fontWeight="800"
          borderRadius="full"
          px={2.5}
          py={1}
          shadow="sm"
          backdropFilter="blur(8px)"
        >
          <HStack spacing={1}>
            {showIcon && <Icon as={FaMapMarkerAlt} />}
            <span>{displayLabel.toUpperCase()}</span>
          </HStack>
        </Badge>
      </Tooltip>
    )
  }

  if (!canFetchProximity) return null

  if (loading) {
    return (
      <Badge colorScheme="gray" variant="subtle">
        <Spinner size="xs" mr={1} />
        Calculating...
      </Badge>
    )
  }

  if (error || !distance || distance.distance_km == null) {
    return null // Don't show anything if there's an error or missing data
  }

  const formatDistance = () => {
    const km = distance.distance_km ?? 0
    const m = distance.distance_m ?? 0
    if (km < 1) {
      return `${Math.round(m)}m away`
    } else if (km < 10) {
      return `${km.toFixed(1)}km away`
    } else {
      return `${Math.round(km)}km away`
    }
  }

  const getColorScheme = () => {
    const km = distance.distance_km ?? 0
    if (km < 5) return 'green'
    if (km < 20) return 'blue'
    if (km < 50) return 'orange'
    return 'gray'
  }

  return (
    <Tooltip label={`Distance: ${(distance.distance_km ?? 0).toFixed(2)} km (${(distance.distance_miles ?? 0).toFixed(2)} miles)`}>
      <Badge 
        bg={badgeBg}
        color={badgeColor}
        variant="solid" 
        fontSize="10px"
        fontWeight="800"
        borderRadius="full"
        px={2.5}
        py={1}
        shadow="sm"
        backdropFilter="blur(8px)"
      >
        <HStack spacing={1}>
          {showIcon && <Icon as={FaMapMarkerAlt} />}
          <span>{formatDistance().toUpperCase()}</span>
        </HStack>
      </Badge>
    </Tooltip>
  )
}

export default ProximityBadge
