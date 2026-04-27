import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Heading, VStack, HStack, Text, Badge, Button, useToast, Tabs, TabList, TabPanels, Tab, TabPanel, Select, useColorModeValue, Slide, ScaleFade, Icon, Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, Textarea, VisuallyHidden, SimpleGrid, IconButton, Tooltip, Skeleton } from '@chakra-ui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FaHandshake, FaTimes, FaMapMarkerAlt, FaTruck } from 'react-icons/fa'
import { FiGrid, FiList } from 'react-icons/fi'
import { api } from '../services/api'
import { fetchTrades as fetchTradesList } from '../services/tradeService'
import { Trade, TradeAction } from '../types'
import OfferDetailsModal from '../components/OfferDetailsModal'
import TradeCompletionModal from '../components/TradeCompletionModal'
import ViewTradeModal from '../components/ViewTradeModal'

const getErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = error as { response?: { data?: { error?: string } } }
  return apiError.response?.data?.error || fallback
}

const Offers: React.FC = () => {
  const navigate = useNavigate()
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [viewTradeModalOpen, setViewTradeModalOpen] = useState(false)
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [tradeToCancel, setTradeToCancel] = useState<Trade | null>(null)
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [tradeToDecline, setTradeToDecline] = useState<Trade | null>(null)
  const [declineFeedback, setDeclineFeedback] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentUserId] = useState<number | undefined>(() => {
    const userId = localStorage.getItem('userId')
    return userId ? parseInt(userId, 10) : undefined
  })
  const toast = useToast()
  const queryClient = useQueryClient()
  
  const cardBg = useColorModeValue('#FDFDFD', 'gray.800')
  const softAccent = useColorModeValue('#F8F9FA', 'gray.700')

  const offersQuery = useQuery({
    queryKey: ['offers', 'trades'],
    queryFn: async () => {
      const [incomingTrades, outgoingTrades] = await Promise.all([
        fetchTradesList({ direction: 'incoming', limit: 100 }),
        fetchTradesList({ direction: 'outgoing', limit: 100 }),
      ])

      return {
        incoming: incomingTrades,
        outgoing: outgoingTrades,
      }
    },
    refetchInterval: 30000,
    staleTime: 30000,
  })

  const incoming = offersQuery.data?.incoming || []
  const outgoing = offersQuery.data?.outgoing || []
  const loading = offersQuery.isLoading

  const fetchAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['offers', 'trades'] })
  }

  const getProductTitle = (productId: number, fallbackTitle?: string): string => {
    if (fallbackTitle) return fallbackTitle
    return `Item #${productId}`
  }

  const getSellerRequestedItems = (trade: Trade) => {
    return (trade.items || []).filter((item) => {
      const itemWithAliases = item as typeof item & { offeredBy?: string }
      const offeredBy = (itemWithAliases.offered_by ?? itemWithAliases.offeredBy ?? '').toLowerCase()
      return offeredBy === 'seller'
    })
  }

  const getRequestedBundleCount = (trade: Trade) => 1 + getSellerRequestedItems(trade).length

  const getRequestedBundleTitle = (trade: Trade) => {
    const count = getRequestedBundleCount(trade)
    const title = getProductTitle(trade.target_product_id, trade.product_title)
    return count > 1 ? `${title} + ${count - 1} more` : title
  }

  useEffect(() => {
    if (!offersQuery.error) return
    toast({
      id: "offers-error", title: 'Error', description: getErrorMessage(offersQuery.error, 'Failed to load offers'), status: 'error' })
  }, [offersQuery.error, toast])

  const updateTrade = async (id: number, action: TradeAction) => {
    // Prevent multiple concurrent requests
    if (isProcessing) {
      return
    }
    try {
      setIsProcessing(true)
      const response = await api.put(`/api/trades/${id}`, action)
      toast({
        id: "offers-success", title: 'Success', description: 'Offer updated', status: 'success' })
      fetchAll()
      return response.data
    } catch (e: unknown) {
      toast({
        id: "offers-error-2", title: 'Error', description: getErrorMessage(e, 'Failed to update offer'), status: 'error' })
      throw e
    } finally {
      setIsProcessing(false)
    }
  }

  const openTradeDetails = (trade: Trade) => {
    setSelectedTrade(trade)
    if (['accepted', 'active', 'awaiting_confirmation', 'completed', 'auto_completed'].includes(trade.status)) {
      setViewTradeModalOpen(true)
    } else {
      setDetailsOpen(true)
    }
  }

  const handleCompleteTradeClick = (trade: Trade) => {
    setSelectedTrade(trade)
    setCompletionModalOpen(true)
  }

  const handleCancelTradeClick = (trade: Trade) => {
    setTradeToCancel(trade)
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!tradeToCancel) return
    
    setIsProcessing(true)
    try {
      await updateTrade(tradeToCancel.id, { action: 'cancel' })
      setCancelModalOpen(false)
      setTradeToCancel(null)
      toast({
        id: "offers-offer-cancelled",
        title: 'Offer cancelled',
        description: 'The offer has been successfully cancelled',
        status: 'success',
        duration: 3000
      })
    } catch (error: unknown) {
      toast({
        id: "offers-error-3",
        title: 'Error',
        description: getErrorMessage(error, 'Failed to cancel offer'),
        status: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeclineTradeClick = (trade: Trade) => {
    setTradeToDecline(trade)
    setDeclineFeedback('')
    setDeclineModalOpen(true)
  }

  const handleConfirmDecline = async () => {
    if (!tradeToDecline) return
    
    setIsProcessing(true)
    try {
      await updateTrade(tradeToDecline.id, { 
        action: 'decline',
        message: declineFeedback.trim() || undefined
      })
      setDeclineModalOpen(false)
      setTradeToDecline(null)
      setDeclineFeedback('')
      toast({
        id: "offers-offer-declined",
        title: 'Offer declined',
        description: 'The offer has been successfully declined',
        status: 'success',
        duration: 3000
      })
    } catch (error: unknown) {
      toast({
        id: "offers-error-4",
        title: 'Error',
        description: getErrorMessage(error, 'Failed to decline offer'),
        status: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConvertToMultiWay = async () => {
    if (!tradeToDecline) {
      setDeclineModalOpen(false)
      return
    }

    setIsProcessing(true)
    setDeclineModalOpen(false)

    try {
      const result = await updateTrade(tradeToDecline.id, {
        action: 'convert_to_multiway'
      })

      setTradeToDecline(null)
      setDeclineFeedback('')

      if (result?.multiway?.match_found) {
        toast({
          id: 'success-convert-multiway-match',
          title: 'Connection Found!',
          description: 'A 3-way Trade Connect was found immediately! Redirecting to your multi-way dashboard...',
          status: 'success',
          duration: 5000
        })
        
        // Redirect to dashboard multi-way tab
        setTimeout(() => {
          navigate('/dashboard?tab=2')
        }, 2000)
      } else {
        toast({
          id: 'success-convert-multiway',
          title: 'Converting to Multi-Way',
          description: 'Your offer has been converted to multi-way! We\'re searching for matching trade loops...',
          status: 'success',
          duration: 5000
        })
        
        // Redirect to dashboard multi-way tab
        setTimeout(() => {
          navigate('/dashboard?tab=2')
        }, 2000)
      }

      // Refresh trades after conversion
      setTimeout(() => {
        setIsProcessing(false)
      }, 1000)
    } catch (error: unknown) {
      setIsProcessing(false)

      const errorMsg = getErrorMessage(error, 'Failed to convert to multi-way')

      toast({
        id: 'error-convert-multiway',
        title: 'Error',
        description: errorMsg,
        status: 'error'
      })
    }
  }

  const sortList = (list: Trade[]) => {
    const sorted = [...list]
    sorted.sort((a, b) => {
      const at = new Date(a.created_at).getTime()
      const bt = new Date(b.created_at).getTime()
      return sort === 'newest' ? bt - at : at - bt
    })
    return sorted
  }

  const incomingSorted = useMemo(() => sortList(incoming), [incoming, sort])
  const outgoingSorted = useMemo(() => sortList(outgoing), [outgoing, sort])
  // statuses that should be treated as "history"
  const historyStatuses = ['declined', 'cancelled', 'completed', 'auto_completed', 'awaiting_other_party']
  const archiveStatuses = ['expired']
  const ongoingStatuses: Trade['status'][] = ['accepted', 'active', 'ongoing', 'awaiting_confirmation', 'multiway_active']
  const isOngoingTrade = (trade: Trade) => ongoingStatuses.includes(trade.status)

  // visible lists for the two main tabs (exclude history and active/accepted items)
  const offersReceivedVisible = incomingSorted.filter(t => !historyStatuses.includes(t.status) && !archiveStatuses.includes(t.status) && !isOngoingTrade(t) && t.status !== 'pending_multiway')
  const offersSentVisible = outgoingSorted.filter(t => !historyStatuses.includes(t.status) && !archiveStatuses.includes(t.status) && !isOngoingTrade(t))

  // Priority ranking: countered first, then pending, then others
  const statusRank = (s?: string) => {
    if (!s) return 3
    const v = s.toLowerCase()
    if (v === 'countered') return 0
    if (v === 'pending' || v === 'pending_multiway') return 1
    return 2
  }

  const compareDatesBySort = (a: Trade, b: Trade) => {
    const at = new Date(a.created_at).getTime()
    const bt = new Date(b.created_at).getTime()
    return sort === 'newest' ? bt - at : at - bt
  }

  const offersReceivedSorted = useMemo(() => {
    return [...offersReceivedVisible].sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status)
      if (r !== 0) return r
      return compareDatesBySort(a, b)
    })
  }, [offersReceivedVisible, sort])

  const offersSentSorted = useMemo(() => {
    return [...offersSentVisible].sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status)
      if (r !== 0) return r
      return compareDatesBySort(a, b)
    })
  }, [offersSentVisible, sort])

  const isPickupOffer = (trade: Trade) => trade.trade_option === 'meetup' && trade.meeting_type === 'pickup'
  const offersReceivedPickup = offersReceivedSorted.filter(isPickupOffer)
  const offersReceivedOther = offersReceivedSorted.filter(t => !isPickupOffer(t))

  // history list: combine history-status trades from incoming+outgoing and tag source for UX
  type SourceTrade = Trade & { source: 'Offers Received' | 'Offers Sent' }
  const historyItems: SourceTrade[] = [
    ...incomingSorted.filter(t => historyStatuses.includes(t.status)).map(t => ({ ...t, source: 'Offers Received' as const })),
    ...outgoingSorted.filter(t => historyStatuses.includes(t.status)).map(t => ({ ...t, source: 'Offers Sent' as const })),
  ]

  // archive list: expired/failed trades
  const archiveItems: SourceTrade[] = [
    ...incomingSorted.filter(t => archiveStatuses.includes(t.status)).map(t => ({ ...t, source: 'Offers Received' as const })),
    ...outgoingSorted.filter(t => archiveStatuses.includes(t.status)).map(t => ({ ...t, source: 'Offers Sent' as const })),
  ]
  const ongoingItems = incomingSorted.concat(outgoingSorted).filter(isOngoingTrade)

  const needsCurrentUserAcceptance = (trade: Trade) => {
    if (!currentUserId) return false
    return (
      trade.status === 'accepted_by_one' &&
      ((trade.buyer_id === currentUserId && !trade.buyer_accepted) ||
        (trade.seller_id === currentUserId && !trade.seller_accepted))
    )
  }

  const canActOnOffer = (trade: Trade) => (
    trade.status === 'pending' ||
    trade.status === 'pending_multiway' ||
    needsCurrentUserAcceptance(trade)
  )

  if (loading) {
    return (
      <Box minH="100vh" bg="#FFFDF1" px={8} py={20}>
        <HStack justify="space-between" mb={6} pl={24} mt={4}>
          <Skeleton h="34px" w="220px" borderRadius="md" />
          <HStack spacing={3}>
            <Skeleton h="14px" w="36px" />
            <Skeleton h="32px" w="140px" borderRadius="md" />
            <Skeleton h="32px" w="32px" borderRadius="md" />
          </HStack>
        </HStack>

        <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor="gray.100" overflow="hidden" boxShadow="sm">
          <HStack bg={softAccent} p={3} gap={2}>
            <Skeleton h="36px" w="170px" borderRadius="md" />
            <Skeleton h="36px" w="140px" borderRadius="md" />
            <Skeleton h="36px" w="120px" borderRadius="md" />
          </HStack>

          <VStack p={4} spacing={3} align="stretch">
            {[0, 1, 2, 3].map((idx) => (
              <Box key={idx} bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={4}>
                <HStack justify="space-between" mb={3}>
                  <Skeleton h="18px" w="130px" borderRadius="full" />
                  <Skeleton h="22px" w="92px" borderRadius="full" />
                </HStack>
                <VStack align="stretch" spacing={2}>
                  <Skeleton h="18px" w="65%" />
                  <Skeleton h="14px" w="45%" />
                  <Skeleton h="14px" w="50%" />
                </VStack>
                <HStack mt={4} spacing={2}>
                  <Skeleton h="30px" flex="1" borderRadius="md" />
                  <Skeleton h="30px" flex="1" borderRadius="md" />
                  <Skeleton h="30px" w="86px" borderRadius="md" />
                </HStack>
              </Box>
            ))}
          </VStack>
        </Box>
      </Box>
    )
  }

  const badgeColor = (status: Trade['status']) => {
    const statusMap: Record<string, { color: string; icon: string }> = {
      'pending': { color: 'yellow', icon: '🕓' },
      'accepted': { color: 'green', icon: '✓' },
      'declined': { color: 'red', icon: '✗' },
      'cancelled': { color: 'gray', icon: '✗' },
      'countered': { color: 'purple', icon: '🔁' },
      'expired': { color: 'gray', icon: '⌛' },
      'completed': { color: 'green', icon: '✓' },
      'active': { color: 'blue', icon: '💬' }
    }
    return statusMap[status.toLowerCase()] || { color: 'gray', icon: '•' }
  }
  
  const getStatusBadge = (status: Trade['status']) => {
    const { color, icon } = badgeColor(status)
    const statusText = status.charAt(0).toUpperCase() + status.slice(1)
    return (
      <Badge 
        colorScheme={color} 
        variant="subtle"
        display="flex"
        alignItems="center"
        gap={1.5}
        px={2.5}
        py={1}
        rounded="full"
        fontSize="xs"
        fontWeight="medium"
        textTransform="none"
        boxShadow="sm"
      >
        <Text as="span" fontSize="0.9em">{icon}</Text>
        <Text as="span">{statusText}</Text>
      </Badge>
    )
  }

  const formatTimePH = (time?: string | null): string => {
    if (!time) return ''
    const parts = time.split(':')
    if (parts.length < 2) return time
    const hour24 = Number.parseInt(parts[0], 10)
    const minute = parts[1]
    if (Number.isNaN(hour24)) return time
    const suffix = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = ((hour24 + 11) % 12) + 1
    if (minute === '00') return `${hour12} ${suffix}`
    return `${hour12}:${minute} ${suffix}`
  }

  const normalizeTimeValue = (value: string): string => {
    const trimmed = value.trim()
    const match = trimmed.match(/^(\d{2}:\d{2})/)
    return match ? match[1] : trimmed
  }

  const splitMeetupDateTime = (value?: string | null): { date: string | null; time: string | null } => {
    if (!value) return { date: null, time: null }
    const trimmed = value.trim()
    if (!trimmed) return { date: null, time: null }
    if (trimmed.includes('T')) {
      const [datePart, timePart] = trimmed.split('T')
      return {
        date: datePart || null,
        time: timePart ? normalizeTimeValue(timePart) : null,
      }
    }
    if (trimmed.includes(' ')) {
      const [datePart, timePart] = trimmed.split(' ')
      return {
        date: datePart || null,
        time: timePart ? normalizeTimeValue(timePart) : null,
      }
    }
    return { date: null, time: normalizeTimeValue(trimmed) }
  }

  const buildMeetupKey = (location?: string | null, date?: string | null, time?: string | null): string | null => {
    if (!location || !time) return null
    const normalizedLocation = location.trim().toLowerCase()
    const normalizedDate = (date || '').trim()
    const normalizedTime = time.trim()
    return `${normalizedLocation}|${normalizedDate}|${normalizedTime}`
  }

  const getPickupScheduleInfo = (trade: Trade) => {
    if (trade.meeting_type !== 'pickup') return null

    if (['completed', 'auto_completed'].includes(trade.status)) {
      return { label: 'Completed Pickup', color: 'green' as const }
    }

    const buyerSelection = splitMeetupDateTime(trade.buyer_meetup_time || null)
    const sellerSelection = splitMeetupDateTime(trade.seller_meetup_time || null)
    const buyerKey = buildMeetupKey(trade.buyer_meetup_location || null, buyerSelection.date, buyerSelection.time)
    const sellerKey = buildMeetupKey(trade.seller_meetup_location || null, sellerSelection.date, sellerSelection.time)
    const bothConfirmed = !!trade.buyer_meetup_confirmed && !!trade.seller_meetup_confirmed
    const matches = !!buyerKey && buyerKey === sellerKey

    if (bothConfirmed && matches) {
      return {
        label: 'Scheduled',
        color: 'green' as const,
        date: buyerSelection.date || sellerSelection.date,
        time: buyerSelection.time || sellerSelection.time,
      }
    }

    if (trade.buyer_meetup_confirmed || trade.seller_meetup_confirmed) {
      const selection = trade.buyer_meetup_confirmed ? buyerSelection : sellerSelection
      return {
        label: 'Awaiting Confirmation',
        color: 'orange' as const,
        date: selection.date,
        time: selection.time,
      }
    }

    return { label: 'Pending Schedule', color: 'yellow' as const }
  }

  // Grid Card Component for offers
  const OfferGridCard = React.memo(({ trade, type, onViewDetails, onAction, onSecondaryAction }: {
    trade: Trade
    type: 'received' | 'sent' | 'progress'
    onViewDetails: () => void
    onAction?: () => void
    onSecondaryAction?: () => void
  }) => {
    const borderColorMap = {
      'pending': 'yellow.400',
      'countered': 'purple.400',
      'accepted': 'green.400',
      'active': 'green.400',
      'declined': 'red.400',
      'cancelled': 'orange.400',
      'completed': 'teal.400'
    }
    const borderColor = borderColorMap[trade.status.toLowerCase() as keyof typeof borderColorMap] || 'gray.200'
    const pickupInfo = getPickupScheduleInfo(trade)

    return (
      <ScaleFade in={true}>
        <Box
          bg="white"
          borderWidth="1px"
          borderColor={borderColor}
          rounded="md"
          overflow="hidden"
          boxShadow="sm"
          _hover={{
            boxShadow: 'md',
            borderColor: borderColor === 'gray.200' ? 'gray.300' : borderColor,
          }}
          transition="all 0.2s ease"
          h="100%"
          display="flex"
          flexDirection="column"
        >
          {/* Header with badge and status */}
          <Box p={2.5} bg="linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)" borderBottomWidth="1px" borderColor="gray.200">
            <HStack justify="space-between" spacing={2}>
              <Badge colorScheme="blue" variant="subtle" fontSize="11px" px={2} py={0.5}>
                {type === 'received' ? '💬' : type === 'sent' ? '📤' : '🔄'} {type === 'received' ? 'Received' : type === 'sent' ? 'Sent' : 'Progress'}
              </Badge>
              {getStatusBadge(trade.status)}
            </HStack>
          </Box>

          {/* Content */}
          <Box p={3} flex="1" display="flex" flexDirection="column" gap={2}>
            <VStack align="start" spacing={2} h="100%" w="100%">
              {/* Product Title */}
              <Box w="100%">
                <Text fontWeight="600" fontSize="sm" noOfLines={2} color="gray.800">
                  {getRequestedBundleTitle(trade)}
                </Text>
                {getRequestedBundleCount(trade) > 1 && (
                  <Badge colorScheme="blue" variant="subtle" fontSize="9px" mt={1}>
                    {getRequestedBundleCount(trade)} requested items
                  </Badge>
                )}
              </Box>

              {/* Trade Option Badge */}
              {trade.trade_option && (
                <Badge 
                  colorScheme={trade.trade_option === 'meetup' ? (trade?.meeting_type === 'pickup' ? 'orange' : 'blue') : trade.trade_option === 'delivery' ? 'green' : 'purple'}
                  variant="outline"
                  fontSize="10px"
                  px={2}
                  py={1}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <Icon as={trade.trade_option === 'meetup' ? (trade?.meeting_type === 'pickup' ? FaMapMarkerAlt : FaHandshake) : trade.trade_option === 'delivery' ? FaTruck : FaHandshake} boxSize={3} />
                  {trade.trade_option === 'meetup' ? (trade?.meeting_type === 'pickup' ? 'Pickup' : 'Meetup') : trade.trade_option === 'delivery' ? 'Delivery' : 'Buyout'}
                </Badge>
              )}

              {pickupInfo && (
                <VStack align="start" spacing={1} w="100%">
                  <Badge colorScheme={pickupInfo.color} variant="subtle" fontSize="10px" px={2} py={0.5}>
                    Pickup: {pickupInfo.label}
                  </Badge>
                  {(pickupInfo.date || pickupInfo.time) && (
                    <Text fontSize="10px" color="gray.500">
                      {pickupInfo.date ? new Date(pickupInfo.date).toLocaleDateString() : ''}
                      {pickupInfo.date && pickupInfo.time ? ' • ' : ''}
                      {pickupInfo.time ? formatTimePH(pickupInfo.time) : ''}
                    </Text>
                  )}
                </VStack>
              )}

              {/* User Info */}
              <Box w="100%" fontSize="11px" color="gray.600">
                <HStack spacing={1}>
                  {type === 'received' && <Text>From: <strong>{(trade.buyer_name || 'User').substring(0, 15)}</strong></Text>}
                  {type === 'sent' && <Text>To: <strong>{(trade.seller_name || 'User').substring(0, 15)}</strong></Text>}
                  {type === 'progress' && <Text><strong>{(trade.buyer_name || 'Trader').substring(0, 12)}</strong> ↔ <strong>{(trade.seller_name || 'Trader').substring(0, 12)}</strong></Text>}
                </HStack>
                <Text fontSize="10px" color="gray.500" mt={1}>{new Date(trade.created_at).toLocaleDateString()}</Text>
              </Box>

              <Box flex="1" />

              {/* Actions - Compact */}
              <HStack spacing={1.5} w="100%" pt={2}>
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="brand"
                  flex={1}
                  onClick={onViewDetails}
                  fontSize="11px"
                  h="28px"
                >
                  View
                </Button>
                {onAction && type !== 'sent' && (
                  <Button
                    size="xs"
                    colorScheme={onSecondaryAction ? 'green' : 'blue'}
                    variant="solid"
                    flex={1}
                    onClick={onAction}
                    fontSize="11px"
                    h="28px"
                    isDisabled={type === 'progress' ? false : !canActOnOffer(trade)}
                  >
                    {type === 'progress' ? 'Done' : 'Accept'}
                  </Button>
                )}
                {onAction && type === 'sent' && trade.status === 'pending' && (
                  <Button
                    size="xs"
                    colorScheme="red"
                    variant="outline"
                    flex={1}
                    onClick={onAction}
                    fontSize="11px"
                    h="28px"
                  >
                    Cancel
                  </Button>
                )}
                {onSecondaryAction && type === 'received' && (
                  <Button
                    size="xs"
                    colorScheme="red"
                    variant="outline"
                    fontSize="11px"
                    onClick={onSecondaryAction}
                    isDisabled={!canActOnOffer(trade)}
                    h="28px"
                  >
                    Decline
                  </Button>
                )}
              </HStack>
            </VStack>
          </Box>
        </Box>
      </ScaleFade>
    )
  })

  return (
    <Box minH="100vh" bg="#FFFDF1">
      <Box px={8} py={20}>
        <Slide direction="top" in={!loading}>
          <HStack justify="space-between" mb={4} pl={24} mt={4} zIndex={10}>
            <Heading size="lg" color="brand.500" fontWeight="bold">
              Trade Management
            </Heading>
            <HStack spacing={3} mt={2}>
              <Text fontSize="sm" color="gray.500" fontWeight="medium">Sort:</Text>
              <VisuallyHidden as="label" htmlFor="sort-select" id="sort-select-label">Sort offers</VisuallyHidden>
              <Select 
                id="sort-select"
                aria-labelledby="sort-select-label"
                aria-label="Sort offers"
                title="Sort offers"
                size="sm" 
                value={sort} 
                onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
                w="140px"
                bg={cardBg}
                borderColor="gray.200"
                borderRadius="md"
                _hover={{ 
                  borderColor: "gray.300",
                  transform: "translateY(-1px)",
                  boxShadow: "sm"
                }}
                _focus={{ 
                  borderColor: "blue.300", 
                  boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.3)" 
                }}
                transition="all 0.2s ease"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </Select>
              <Tooltip label={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'} hasArrow>
                <IconButton
                  aria-label={viewMode === 'grid' ? 'List view' : 'Grid view'}
                  icon={<Icon as={viewMode === 'grid' ? FiList : FiGrid} />}
                  size="sm"
                  variant={viewMode === 'list' ? 'solid' : 'ghost'}
                  colorScheme="brand"
                  onClick={() => setViewMode(m => m === 'grid' ? 'list' : 'grid')}
                />
              </Tooltip>
            </HStack>
          </HStack>
        </Slide>

        <Tabs 
          colorScheme="blue" 
          variant="soft-rounded" 
          index={activeTab} 
          onChange={setActiveTab}
          bg={cardBg}
          borderRadius="lg"
          boxShadow="sm"
          border="1px solid"
          borderColor="gray.100"
          overflow="hidden"
        >
          <TabList bg={softAccent} p={3} gap={2}>
            <Tab 
              _selected={{ 
                bg: "blue.500", 
                color: "white",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _hover={{ 
                bg: "blue.50",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease"
              fontWeight="medium"
              fontSize="sm"
              borderRadius="md"
              px={4}
              py={2}
            >
              Offers Received 
              <Badge ml={2} colorScheme="blue" variant="subtle" fontSize="xs">
                {incoming.filter(i => i.status === 'pending').length}
              </Badge>
            </Tab>
            <Tab 
              _selected={{ 
                bg: "blue.500", 
                color: "white",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _hover={{ 
                bg: "green.50",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease"
              fontWeight="medium"
              fontSize="sm"
              borderRadius="md"
              px={4}
              py={2}
            >
              Offers Sent 
              <Badge ml={2} colorScheme="green" variant="subtle" fontSize="xs">
                {outgoing.filter(i => i.status === 'pending').length}
              </Badge>
            </Tab>
            <Tab 
              _selected={{ 
                bg: "blue.500", 
                color: "white",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _hover={{ 
                bg: "orange.50",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease"
              fontWeight="medium"
              fontSize="sm"
              borderRadius="md"
              px={4}
              py={2}
            >
              In Progress
              <Badge ml={2} colorScheme="orange" variant="subtle" fontSize="xs">
                {ongoingItems.length}
              </Badge>
            </Tab>
            <Tab 
              _selected={{ 
                bg: "blue.500", 
                color: "white",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _hover={{ 
                bg: "gray.50",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease"
              fontWeight="medium"
              fontSize="sm"
              borderRadius="md"
              px={4}
              py={2}
            >
              History
              <Badge ml={2} colorScheme="gray" variant="subtle" fontSize="xs">
                {historyItems.length}
              </Badge>
            </Tab>
            <Tab
              _selected={{
                bg: "blue.500",
                color: "white",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _hover={{
                bg: "red.50",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease"
              fontWeight="medium"
              fontSize="sm"
              borderRadius="md"
              px={4}
              py={2}
            >
              Archive
              <Badge ml={2} colorScheme="red" variant="subtle" fontSize="xs">
                {archiveItems.length}
              </Badge>
            </Tab>
          </TabList>
          <TabPanels bg={cardBg} p={5}>
          <TabPanel p={0}>
            {offersReceivedSorted.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>No offers received.</Text>
            ) : viewMode === 'grid' ? (
              <VStack spacing={5} align="stretch">
                {offersReceivedPickup.length > 0 && (
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Received Offers (Pickup)</Text>
                      <Badge colorScheme="orange" variant="subtle" fontSize="xs">
                        {offersReceivedPickup.length}
                      </Badge>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={3}>
                      {offersReceivedPickup.map((t) => (
                        <OfferGridCard
                          key={t.id}
                          trade={t}
                          type="received"
                          onViewDetails={() => openTradeDetails(t)}
                          onAction={() => updateTrade(t.id, { action: 'accept' })}
                          onSecondaryAction={() => handleDeclineTradeClick(t)}
                        />
                      ))}
                    </SimpleGrid>
                  </VStack>
                )}
                {offersReceivedOther.length > 0 && (
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Other Offers</Text>
                      <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                        {offersReceivedOther.length}
                      </Badge>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={3}>
                      {offersReceivedOther.map((t) => (
                        <OfferGridCard
                          key={t.id}
                          trade={t}
                          type="received"
                          onViewDetails={() => openTradeDetails(t)}
                          onAction={() => updateTrade(t.id, { action: 'accept' })}
                          onSecondaryAction={() => handleDeclineTradeClick(t)}
                        />
                      ))}
                    </SimpleGrid>
                  </VStack>
                )}
              </VStack>
            ) : (
              <VStack spacing={5} align="stretch">
                {offersReceivedPickup.length > 0 && (
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Received Offers (Pickup)</Text>
                      <Badge colorScheme="orange" variant="subtle" fontSize="xs">
                        {offersReceivedPickup.length}
                      </Badge>
                    </HStack>
                    <VStack spacing={3} align="stretch">
                      {offersReceivedPickup.map((t) => {
                        const pickupInfo = getPickupScheduleInfo(t)
                        return (
                          <ScaleFade in={true} key={t.id}>
                            <Box
                              bg="white"
                              borderWidth="1px"
                              borderLeftWidth="4px"
                              borderColor={
                                t.status === 'countered' ? 'purple.400' :
                                t.status === 'pending' ? 'yellow.400' :
                                t.status === 'accepted' || t.status === 'active' ? 'green.400' :
                                'gray.200'
                              }
                              rounded="lg"
                              p={3}
                              position="relative"
                              boxShadow="sm"
                              h="160px"
                              display="flex"
                              flexDirection="column"
                              _hover={{
                                boxShadow: 'md',
                                transform: 'translateY(-2px)',
                                borderColor: t.status === 'countered' ? 'purple.500' :
                                           t.status === 'pending' ? 'yellow.500' :
                                           t.status === 'accepted' || t.status === 'active' ? 'green.500' : 'gray.300'
                              }}
                              transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                            >
                            {/* Top row: badges and status */}
                            <HStack justify="space-between" mb={1} spacing={1} flexShrink={0}>
                              <Badge 
                                colorScheme="blue"
                                variant="subtle"
                                px={1.5}
                                py={0}
                                rounded="sm"
                                fontSize="10px"
                                textTransform="none"
                              >
                                💬 Received
                              </Badge>
                              {getStatusBadge(t.status)}
                            </HStack>

                            {/* Product title and trade option */}
                            <VStack align="start" spacing={0.5} flex="1" overflow="hidden" mb={1}>
                              <Text fontWeight="semibold" fontSize="sm" noOfLines={2} color="gray.800">{getRequestedBundleTitle(t)}</Text>
                              {getRequestedBundleCount(t) > 1 && (
                                <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                                  {getRequestedBundleCount(t)} requested items
                                </Badge>
                              )}
                              {t.trade_option && (
                                <Badge 
                                  colorScheme={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'orange' : 'blue') : t.trade_option === 'delivery' ? 'green' : 'purple'}
                                  variant="subtle"
                                  fontSize="8px"
                                  display="flex"
                                  alignItems="center"
                                  gap={0.5}
                                  px={1}
                                  py={0}
                                >
                                  <Icon as={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? FaMapMarkerAlt : FaHandshake) : t.trade_option === 'delivery' ? FaTruck : FaHandshake} boxSize={2.5} />
                                  {t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'Pickup' : 'Meetup') : t.trade_option === 'delivery' ? 'Delivery' : 'Buyout'}
                                </Badge>
                              )}
                              {pickupInfo && (
                                <Badge colorScheme={pickupInfo.color} variant="subtle" fontSize="8px" px={1} py={0}>
                                  Pickup: {pickupInfo.label}
                                </Badge>
                              )}
                              <Text fontSize="10px" color="gray.600" noOfLines={1}>From: <Text as="span" fontWeight="medium">{(t.buyer_name || 'User').substring(0, 20)}</Text></Text>
                            </VStack>

                            {/* Actions positioned at bottom */}
                            <HStack spacing={1} mt="auto" flexShrink={0}>
                              <Button 
                                size="xs" 
                                variant="outline"
                                colorScheme="gray"
                                flex={1}
                                onClick={() => openTradeDetails(t)}
                                fontSize="10px"
                                h="24px"
                              >
                                View
                              </Button>
                              <Button 
                                size="xs" 
                                colorScheme="green" 
                                variant="solid"
                                flex={1}
                                onClick={() => updateTrade(t.id, { action: 'accept' })} 
                                isDisabled={!canActOnOffer(t) || isProcessing}
                                isLoading={isProcessing}
                                fontSize="10px"
                                h="24px"
                              >
                                Accept
                              </Button>
                              <Button 
                                size="xs" 
                                colorScheme="red" 
                                variant="outline" 
                                flex={1}
                                onClick={() => handleDeclineTradeClick(t)} 
                                isDisabled={!canActOnOffer(t)}
                                fontSize="10px"
                                h="24px"
                              >
                                Decline
                              </Button>
                            </HStack>
                            </Box>
                          </ScaleFade>
                        )
                      })}
                    </VStack>
                  </VStack>
                )}
                {offersReceivedOther.length > 0 && (
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="gray.700">Other Offers</Text>
                      <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                        {offersReceivedOther.length}
                      </Badge>
                    </HStack>
                    <VStack spacing={3} align="stretch">
                      {offersReceivedOther.map((t) => (
                        <ScaleFade in={true} key={t.id}>
                          <Box
                            bg="white"
                            borderWidth="1px"
                            borderLeftWidth="4px"
                            borderColor={
                              t.status === 'countered' ? 'purple.400' :
                              t.status === 'pending' ? 'yellow.400' :
                              t.status === 'accepted' || t.status === 'active' ? 'green.400' :
                              'gray.200'
                            }
                            rounded="lg"
                            p={3}
                            position="relative"
                            boxShadow="sm"
                            h="160px"
                            display="flex"
                            flexDirection="column"
                            _hover={{
                              boxShadow: 'md',
                              transform: 'translateY(-2px)',
                              borderColor: t.status === 'countered' ? 'purple.500' :
                                         t.status === 'pending' ? 'yellow.500' :
                                         t.status === 'accepted' || t.status === 'active' ? 'green.500' : 'gray.300'
                            }}
                            transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                          >
                          {/* Top row: badges and status */}
                          <HStack justify="space-between" mb={1} spacing={1} flexShrink={0}>
                            <Badge 
                              colorScheme="blue"
                              variant="subtle"
                              px={1.5}
                              py={0}
                              rounded="sm"
                              fontSize="10px"
                              textTransform="none"
                            >
                              💬 Received
                            </Badge>
                            {getStatusBadge(t.status)}
                          </HStack>

                          {/* Product title and trade option */}
                          <VStack align="start" spacing={0.5} flex="1" overflow="hidden" mb={1}>
                            <Text fontWeight="semibold" fontSize="sm" noOfLines={2} color="gray.800">{getRequestedBundleTitle(t)}</Text>
                            {getRequestedBundleCount(t) > 1 && (
                              <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                                {getRequestedBundleCount(t)} requested items
                              </Badge>
                            )}
                            {t.trade_option && (
                              <Badge 
                                colorScheme={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'orange' : 'blue') : t.trade_option === 'delivery' ? 'green' : 'purple'}
                                variant="subtle"
                                fontSize="8px"
                                display="flex"
                                alignItems="center"
                                gap={0.5}
                                px={1}
                                py={0}
                              >
                                <Icon as={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? FaMapMarkerAlt : FaHandshake) : t.trade_option === 'delivery' ? FaTruck : FaHandshake} boxSize={2.5} />
                                {t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'Pickup' : 'Meetup') : t.trade_option === 'delivery' ? 'Delivery' : 'Buyout'}
                              </Badge>
                            )}
                            <Text fontSize="10px" color="gray.600" noOfLines={1}>From: <Text as="span" fontWeight="medium">{(t.buyer_name || 'User').substring(0, 20)}</Text></Text>
                          </VStack>

                          {/* Actions positioned at bottom */}
                          <HStack spacing={1} mt="auto" flexShrink={0}>
                            <Button 
                              size="xs" 
                              variant="outline"
                              colorScheme="gray"
                              flex={1}
                              onClick={() => openTradeDetails(t)}
                              fontSize="10px"
                              h="24px"
                            >
                              View
                            </Button>
                            <Button 
                              size="xs" 
                              colorScheme="green" 
                              variant="solid"
                              flex={1}
                              onClick={() => updateTrade(t.id, { action: 'accept' })} 
                              isDisabled={!canActOnOffer(t) || isProcessing}
                              isLoading={isProcessing}
                              fontSize="10px"
                              h="24px"
                            >
                              Accept
                            </Button>
                            <Button 
                              size="xs" 
                              colorScheme="red" 
                              variant="outline" 
                              flex={1}
                              onClick={() => handleDeclineTradeClick(t)} 
                              isDisabled={!canActOnOffer(t)}
                              fontSize="10px"
                              h="24px"
                            >
                              Decline
                            </Button>
                          </HStack>
                          </Box>
                        </ScaleFade>
                      ))}
                    </VStack>
                  </VStack>
                )}
              </VStack>
            )}
          </TabPanel>
          <TabPanel p={0}>
            {offersSentSorted.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>No offers sent.</Text>
            ) : viewMode === 'grid' ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={3}>
                {offersSentSorted.map((t) => (
                  <OfferGridCard
                    key={t.id}
                    trade={t}
                    type="sent"
                    onViewDetails={() => openTradeDetails(t)}
                    onAction={() => handleCancelTradeClick(t)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <VStack spacing={3} align="stretch">
                {offersSentSorted.map((t) => {
                  const pickupInfo = getPickupScheduleInfo(t)
                  return (
                  <ScaleFade in={true} key={t.id}>
                    <Box 
                      bg="white" 
                      borderWidth="1px"
                      borderLeftWidth="4px"
                      borderColor={
                        t.status === 'countered' ? 'purple.400' :
                        t.status === 'pending' ? 'yellow.400' :
                        t.status === 'accepted' || t.status === 'active' ? 'green.400' :
                        'gray.200'
                      }
                      rounded="lg" 
                      p={3}
                      position="relative"
                      boxShadow="sm"
                      h="160px"
                      display="flex"
                      flexDirection="column"
                      _hover={{
                        boxShadow: 'md',
                        transform: 'translateY(-2px)',
                        borderColor: t.status === 'countered' ? 'purple.500' :
                                   t.status === 'pending' ? 'yellow.500' :
                                   t.status === 'accepted' || t.status === 'active' ? 'green.500' : 'gray.300'
                      }}
                      transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    >
                      {/* Top row: badges and status */}
                      <HStack justify="space-between" mb={1} spacing={1} flexShrink={0}>
                        <Badge 
                          colorScheme="blue"
                          variant="subtle"
                          px={1.5}
                          py={0}
                          rounded="sm"
                          fontSize="10px"
                          textTransform="none"
                        >
                          📤 Sent
                        </Badge>
                        {getStatusBadge(t.status)}
                      </HStack>

                      {/* Product title and trade option */}
                      <VStack align="start" spacing={0.5} flex="1" overflow="hidden" mb={1}>
                        <Text fontWeight="semibold" fontSize="sm" noOfLines={2} color="gray.800">{getRequestedBundleTitle(t)}</Text>
                        {getRequestedBundleCount(t) > 1 && (
                          <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                            {getRequestedBundleCount(t)} requested items
                          </Badge>
                        )}
                        {t.trade_option && (
                          <Badge 
                            colorScheme={t.trade_option === 'meetup' ? 'blue' : t.trade_option === 'delivery' ? 'green' : 'purple'}
                            variant="subtle"
                            fontSize="8px"
                            display="flex"
                            alignItems="center"
                            gap={0.5}
                            px={1}
                            py={0}
                          >
                            <Icon as={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? FaMapMarkerAlt : FaHandshake) : t.trade_option === 'delivery' ? FaTruck : FaHandshake} boxSize={2.5} />
                            {t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'Pickup' : 'Meetup') : t.trade_option === 'delivery' ? 'Delivery' : 'Buyout'}
                          </Badge>
                        )}
                        {pickupInfo && (
                          <Badge colorScheme={pickupInfo.color} variant="subtle" fontSize="8px" px={1} py={0}>
                            Pickup: {pickupInfo.label}
                          </Badge>
                        )}
                        <Text fontSize="10px" color="gray.600" noOfLines={1}>To: <Text as="span" fontWeight="medium">{(t.seller_name || 'User').substring(0, 20)}</Text></Text>
                      </VStack>

                      {/* Actions positioned at bottom */}
                      <HStack spacing={1} mt="auto" flexShrink={0}>
                        <Button 
                          size="xs" 
                          variant="outline"
                          colorScheme="gray"
                          flex={1}
                          onClick={() => openTradeDetails(t)}
                          fontSize="10px"
                          h="24px"
                        >
                          View
                        </Button>
                        {t.status === 'pending' && (
                          <Button
                            size="xs"
                            colorScheme="red"
                            variant="solid"
                            flex={1}
                            onClick={() => handleCancelTradeClick(t)}
                            fontSize="10px"
                            h="24px"
                          >
                            Cancel
                          </Button>
                        )}
                      </HStack>
                    </Box>
                  </ScaleFade>
                )})}
              </VStack>
            )}
          </TabPanel>
          <TabPanel p={0}>
            {ongoingItems.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>No trades in progress.</Text>
            ) : viewMode === 'grid' ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={3}>
                {ongoingItems.map((t) => (
                  <OfferGridCard
                    key={t.id}
                    trade={t}
                    type="progress"
                    onViewDetails={() => openTradeDetails(t)}
                    onAction={() => handleCompleteTradeClick(t)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <VStack spacing={3} align="stretch">
                {ongoingItems.map((t) => {
                  const pickupInfo = getPickupScheduleInfo(t)
                  return (
                  <ScaleFade in={true} key={t.id}>
                    <Box 
                      bg="white" 
                      borderWidth="1px"
                      borderLeftWidth="4px"
                      borderColor={
                        t.status === 'countered' ? 'purple.400' :
                        t.status === 'pending' ? 'yellow.400' :
                        t.status === 'accepted' || t.status === 'active' ? 'green.400' :
                        'gray.200'
                      }
                      rounded="lg" 
                      p={3}
                      position="relative"
                      boxShadow="sm"
                      h="160px"
                      display="flex"
                      flexDirection="column"
                      _hover={{
                        boxShadow: 'md',
                        transform: 'translateY(-2px)',
                        borderColor: t.status === 'countered' ? 'purple.500' :
                                   t.status === 'pending' ? 'yellow.500' :
                                   t.status === 'accepted' || t.status === 'active' ? 'green.500' : 'gray.300'
                      }}
                      transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    >
                      {/* Top row: badges and status */}
                      <HStack justify="space-between" mb={1} spacing={1} flexShrink={0}>
                        <Badge 
                          colorScheme="orange"
                          variant="subtle"
                          px={1.5}
                          py={0}
                          rounded="sm"
                          fontSize="10px"
                          textTransform="none"
                        >
                          🔄 Progress
                        </Badge>
                        {getStatusBadge(t.status)}
                      </HStack>

                      {/* Product title and trade option */}
                      <VStack align="start" spacing={0.5} flex="1" overflow="hidden" mb={1}>
                        <Text fontWeight="semibold" fontSize="sm" noOfLines={2} color="gray.800">{getRequestedBundleTitle(t)}</Text>
                        {getRequestedBundleCount(t) > 1 && (
                          <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                            {getRequestedBundleCount(t)} requested items
                          </Badge>
                        )}
                        {t.trade_option && (
                          <Badge 
                            colorScheme={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'orange' : 'blue') : t.trade_option === 'delivery' ? 'green' : 'purple'}
                            variant="subtle"
                            fontSize="8px"
                            display="flex"
                            alignItems="center"
                            gap={0.5}
                            px={1}
                            py={0}
                          >
                            <Icon as={t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? FaMapMarkerAlt : FaHandshake) : t.trade_option === 'delivery' ? FaTruck : FaHandshake} boxSize={2.5} />
                            {t.trade_option === 'meetup' ? (t?.meeting_type === 'pickup' ? 'Pickup' : 'Meetup') : t.trade_option === 'delivery' ? 'Delivery' : 'Buyout'}
                          </Badge>
                        )}
                        {pickupInfo && (
                          <Badge colorScheme={pickupInfo.color} variant="subtle" fontSize="8px" px={1} py={0}>
                            Pickup: {pickupInfo.label}
                          </Badge>
                        )}
                        <Text fontSize="10px" color="gray.600" noOfLines={1}><Text as="span" fontWeight="medium">{(t.buyer_name || 'Trader').substring(0, 12)}</Text> ↔ <Text as="span" fontWeight="medium">{(t.seller_name || 'Trader').substring(0, 12)}</Text></Text>
                      </VStack>

                      {/* Actions positioned at bottom */}
                      <HStack spacing={1} mt="auto" flexShrink={0}>
                        <Button 
                          size="xs" 
                          variant="outline"
                          colorScheme="gray"
                          flex={1}
                          onClick={() => openTradeDetails(t)}
                          fontSize="10px"
                          h="24px"
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          variant="solid"
                          flex={1}
                          onClick={() => handleCompleteTradeClick(t)}
                          isDisabled={['completed', 'auto_completed', 'cancelled', 'declined'].includes(t.status)}
                          fontSize="10px"
                          h="24px"
                        >
                          Done
                        </Button>
                      </HStack>
                    </Box>
                  </ScaleFade>
                )})}
              </VStack>
            )}
          </TabPanel>
          <TabPanel p={0}>
            <VStack spacing={2} align="stretch">
              {historyItems.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={8}>No history yet.</Text>
              ) : historyItems.map((t) => (
                <ScaleFade in={true} key={t.id}>
                  <Box 
                    bg="white" 
                    borderWidth="1px" 
                    borderColor="gray.100" 
                    rounded="lg" 
                    p={3}
                    boxShadow="sm"
                    h="100px"
                    display="flex"
                    flexDirection="column"
                    _hover={{
                      boxShadow: "md",
                      transform: "translateY(-1px)",
                      borderColor: "gray.200"
                    }}
                    transition="all 0.2s ease"
                  >
                    <HStack justify="space-between" align="start" spacing={2}>
                      <VStack align="start" spacing={0.5} flex="1" overflow="hidden">
                        <Text fontWeight="semibold" color="gray.800" fontSize="sm" noOfLines={1}>{getRequestedBundleTitle(t)}</Text>
                        {getRequestedBundleCount(t) > 1 && (
                          <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                            {getRequestedBundleCount(t)} requested items
                          </Badge>
                        )}
                        <Text fontSize="10px" color="gray.600" noOfLines={1}>Trader: {(t.buyer_name || 'User').substring(0, 15)} • Trader: {(t.seller_name || 'User').substring(0, 15)}</Text>
                        <Text fontSize="9px" color="gray.400">Source: {t.source}</Text>
                      </VStack>
                      {getStatusBadge(t.status)}
                    </HStack>
                  </Box>
                </ScaleFade>
              ))}
            </VStack>
          </TabPanel>
          <TabPanel p={0}>
            <VStack spacing={2} align="stretch">
              {archiveItems.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={8}>No archived trades yet.</Text>
              ) : archiveItems.map((t) => (
                <ScaleFade in={true} key={t.id}>
                  <Box
                    bg="white"
                    borderWidth="1px"
                    borderColor="red.100"
                    rounded="lg"
                    p={3}
                    boxShadow="sm"
                    h="100px"
                    display="flex"
                    flexDirection="column"
                    _hover={{
                      boxShadow: "md",
                      transform: "translateY(-1px)",
                      borderColor: "red.200"
                    }}
                    transition="all 0.2s ease"
                  >
                    <HStack justify="space-between" align="start" spacing={2}>
                      <VStack align="start" spacing={0.5} flex="1" overflow="hidden">
                        <Text fontWeight="semibold" color="gray.800" fontSize="sm" noOfLines={1}>{getRequestedBundleTitle(t)}</Text>
                        {getRequestedBundleCount(t) > 1 && (
                          <Badge colorScheme="blue" variant="subtle" fontSize="8px" px={1} py={0}>
                            {getRequestedBundleCount(t)} requested items
                          </Badge>
                        )}
                        <Text fontSize="10px" color="gray.600" noOfLines={1}>Trader: {(t.buyer_name || 'User').substring(0, 15)} • Trader: {(t.seller_name || 'User').substring(0, 15)}</Text>
                        <Text fontSize="9px" color="red.400">Expired due to 7 days of inactivity</Text>
                      </VStack>
                      {getStatusBadge(t.status)}
                    </HStack>
                  </Box>
                </ScaleFade>
              ))}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

        <ViewTradeModal
          trade={selectedTrade}
          isOpen={viewTradeModalOpen}
          onClose={() => setViewTradeModalOpen(false)}
          onStatusUpdate={fetchAll}
          onTradeUpdate={(updatedTrade) => setSelectedTrade(updatedTrade)}
        />

        <OfferDetailsModal
          trade={selectedTrade}
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onAccepted={() => { fetchAll() }}
          onDeclined={() => { fetchAll() }}
        />

        <TradeCompletionModal
          trade={selectedTrade}
          isOpen={completionModalOpen}
          onClose={() => setCompletionModalOpen(false)}
          onCompleted={fetchAll}
          currentUserId={currentUserId}
        />

        {/* Cancel Confirmation Modal */}
        <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} size="sm" isCentered>
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent
            bg="white"
            borderRadius="xl"
            boxShadow="xl"
            mx={4}
          >
            <ModalCloseButton />
            <ModalBody p={6} textAlign="center">
              <VStack spacing={3}>
                <Icon as={FaTimes} color="red.500" boxSize={8} />
                <VStack spacing={2}>
                  <Text fontWeight="bold" fontSize="lg" color="gray.800">
                    Cancel Offer
                  </Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Are you sure you want to cancel this offer? This action cannot be undone.
                  </Text>
                  {tradeToCancel && (
                    <Text fontSize="xs" color="gray.500" mt={2}>
                      Product: {getRequestedBundleTitle(tradeToCancel)}
                    </Text>
                  )}
                </VStack>
                
                <HStack spacing={3} w="full">
                  <Button
                    variant="outline"
                    size="md"
                    flex={1}
                    onClick={() => setCancelModalOpen(false)}
                  >
                    Keep Offer
                  </Button>
                  <Button
                    colorScheme="red"
                    size="md"
                    flex={1}
                    onClick={handleConfirmCancel}
                    isLoading={isProcessing}
                    leftIcon={<Icon as={FaTimes} />}
                  >
                    Cancel Offer
                  </Button>
                </HStack>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Decline Confirmation Modal */}
        <Modal isOpen={declineModalOpen} onClose={() => setDeclineModalOpen(false)} size="md" isCentered>
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent
            bg="white"
            borderRadius="xl"
            boxShadow="xl"
            mx={4}
          >
            <ModalCloseButton />
            <ModalBody p={6}>
              <VStack spacing={3} align="stretch">
                <VStack spacing={2} textAlign="center">
                  <Icon as={FaTimes} color="red.500" boxSize={6} />
                  <Text fontWeight="bold" fontSize="lg" color="gray.800">
                    Decline Offer
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Are you sure you want to decline this offer?
                  </Text>
                  {tradeToDecline && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Product: {getRequestedBundleTitle(tradeToDecline)}
                    </Text>
                  )}
                </VStack>
                
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" color="gray.600" fontWeight="medium">
                    Feedback (Optional)
                  </Text>
                  <Textarea
                    value={declineFeedback}
                    onChange={(e) => setDeclineFeedback(e.target.value)}
                    placeholder="Provide a reason for declining this offer (optional)..."
                    resize="none"
                    rows={3}
                    fontSize="sm"
                    _focus={{
                      borderColor: "red.300",
                      boxShadow: "0 0 0 1px rgba(245, 101, 101, 0.3)"
                    }}
                  />
                  <Text fontSize="xs" color="gray.500">
                    This feedback will be shared with the offer sender
                  </Text>
                </VStack>
                
                <HStack spacing={3} w="full">
                  <Button
                    variant="outline"
                    size="md"
                    flex={1}
                    onClick={() => setDeclineModalOpen(false)}
                  >
                    Keep Offer
                  </Button>
                  <Button
                    colorScheme="green"
                    variant="outline"
                    size="md"
                    flex={1}
                    onClick={handleConvertToMultiWay}
                    isLoading={isProcessing}
                  >
                    Convert to Multi-Way
                  </Button>
                  <Button
                    colorScheme="red"
                    size="md"
                    flex={1}
                    onClick={handleConfirmDecline}
                    isLoading={isProcessing}
                    leftIcon={<Icon as={FaTimes} />}
                  >
                    Decline Offer
                  </Button>
                </HStack>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </Box>
  )
}

export default Offers
