import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  VStack,
  HStack,
  Grid,
  Heading,
  Text,
  Center,
  Badge,
  Button,
  Skeleton,
} from '@chakra-ui/react'
import { useProducts } from '../contexts/ProductContext'
import { getFirstImage } from '../utils/imageUtils'
import { getProductUrl } from '../utils/productUtils'
import FloatingTab from '../components/FloatingTab'
import OptimizedImage from '../components/OptimizedImage'

const ProductsList: React.FC = () => {
  const { products, loading, error, searchProducts, clearError } = useProducts()
  const location = useLocation()
  const navigate = useNavigate()
  const [initialized, setInitialized] = useState(false)
  const sellerId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const idStr = params.get('seller_id')
    return idStr ? parseInt(idStr) : undefined
  }, [location.search])

  const lastRunSellerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (lastRunSellerRef.current === sellerId) return
    lastRunSellerRef.current = sellerId
    const load = async () => {
      clearError()
      await searchProducts({ page: 1, limit: 20, seller_id: sellerId })
      setInitialized(true)
    }
    load()
    // Intentionally depend only on sellerId to avoid re-runs on provider renders
  }, [sellerId])

  const renderCard = (p: any) => (
    <Box
      key={p.id}
      bg="white"
      rounded="lg"
      shadow="sm"
      borderWidth="1px"
      borderColor="gray.100"
      overflow="hidden"
      transition="all 0.2s ease"
      w="full"
      _hover={{ boxShadow: 'md', transform: 'translateY(-2px)', cursor: 'pointer' }}
      onClick={() => navigate(getProductUrl(p))}
    >
      <Box
        position="relative"
        w="full"
        pt="100%"
        overflow="hidden"
        cursor="pointer"
        role="group"
      >
        <OptimizedImage
          src={getFirstImage(p.image_urls)}
          alt={p.title}
          position="absolute"
          top={0}
          left={0}
          displayWidth="100%"
          displayHeight="100%"
          objectFit="cover"
          loading="lazy"
          fallbackSrc="/no-image.svg"
          width={300}
        />
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.400"
          opacity={0}
          _groupHover={{ opacity: 1 }}
          transition="opacity 0.2s"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="xs" color="white" fontWeight="semibold" px={2} textAlign="center">
            View product details
          </Text>
        </Box>
        {p.premium && (
          <Badge position="absolute" top={2} right={2} colorScheme="yellow" variant="solid" borderRadius="full" px={2}>
            Boosted
          </Badge>
        )}
      </Box>
      <Box p={4} display="flex" flexDirection="column" h={{ base: 148, md: 160 }} overflow="hidden">
        <Heading size="sm" noOfLines={2} mb={1.5} color="gray.800" flexShrink={0} wordBreak="break-word">
          {p.title}
        </Heading>
        <Text color="gray.500" noOfLines={3} fontSize="xs" flexShrink={0} wordBreak="break-word">
          {p.description || 'No description available'}
        </Text>
        {p.wishlist_count > 0 && (
          <HStack mt="auto" spacing={1}>
            <Badge
              colorScheme="pink"
              variant="subtle"
              borderRadius="full"
              px={2}
              py={0.5}
              fontSize="xs"
            >
              ❤️ {p.wishlist_count}
            </Badge>
          </HStack>
        )}
      </Box>
    </Box>
  )

  return (
    <Box bg="#FFFDF1" minH="100vh" w="100%" pb={{ base: 20, lg: 6 }}>
      <Container maxW="container.xl" py={6}>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="center">
            <Heading size="md" color="gray.800">
              {sellerId ? 'Trader Products' : 'All Products'}
            </Heading>
            {sellerId && (
              <Button size="sm" variant="outline" onClick={() => navigate('/products')}>View All</Button>
            )}
          </HStack>

          {loading && (
            <Grid
              templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)', xl: 'repeat(5, 1fr)' }}
              gap={{ base: 3, md: 4 }}
              alignItems="start"
            >
              {Array.from({ length: 10 }).map((_, idx) => (
                <Box
                  key={idx}
                  bg="white"
                  rounded="lg"
                  shadow="sm"
                  borderWidth="1px"
                  borderColor="gray.100"
                  overflow="hidden"
                  w="full"
                >
                  <Skeleton w="full" pt="100%" />
                  <Box p={4}>
                    <VStack align="stretch" spacing={3}>
                      <Skeleton h="18px" w="85%" />
                      <Skeleton h="14px" w="100%" />
                      <Skeleton h="14px" w="70%" />
                      <HStack justify="space-between" pt={2}>
                        <Skeleton h="18px" w="95px" borderRadius="full" />
                        <Skeleton h="20px" w="70px" borderRadius="md" />
                      </HStack>
                    </VStack>
                  </Box>
                </Box>
              ))}
            </Grid>
          )}

          {!loading && error && (
            <Center h="40vh">
              <Text color="red.500">{error}</Text>
            </Center>
          )}

          {!loading && !error && initialized && products.length === 0 && (
            <Box bg="white" border="1px" borderColor="gray.200" rounded="lg" p={8} textAlign="center">
              <Text color="gray.600">No products available</Text>
            </Box>
          )}

          {!loading && !error && products.length > 0 && (
            <Grid
              templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)', xl: 'repeat(5, 1fr)' }}
              gap={{ base: 3, md: 4 }}
              alignItems="start"
            >
              {products.map(renderCard)}
            </Grid>
          )}
        </VStack>
      </Container>

      <FloatingTab />
    </Box>
  )
}

export default ProductsList


