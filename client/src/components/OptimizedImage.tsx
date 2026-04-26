import React, { useEffect, useMemo, useState } from 'react'
import { Box, Image as ChakraImage, Skeleton, ImageProps } from '@chakra-ui/react'
import { generateCloudinarySrcSet, getOptimizedImageWithFallback } from '../utils/imageUtils'

interface OptimizedImageProps extends Omit<ImageProps, 'src' | 'alt' | 'objectFit'> {
  src?: string
  alt: string
  width?: number
  height?: number
  displayWidth?: string | number  // CSS width
  displayHeight?: string | number  // CSS height
  objectFit?: any  // Chakra ResponsiveValue
  borderRadius?: string
  fallbackSrc?: string
  loading?: 'lazy' | 'eager'
  sizes?: string
  onClick?: (e: React.MouseEvent) => void
  cursor?: string
}

/**
 * OptimizedImage Component
 * 
 * Renders images with automatic Cloudinary optimization:
 * - WebP/AVIF format with JPG fallback
 * - Responsive srcset for different screen sizes
 * - Lazy loading by default
 * - Proper aspect ratio handling
 * - Fallback support for non-Cloudinary images
 * 
 * Usage:
 * <OptimizedImage 
 *   src="https://res.cloudinary.com/.../image.jpg"
 *   alt="Product"
 *   displayWidth="286px"
 *   displayHeight="381px"
 *   borderRadius="md"
 * />
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 300,
  height,
  displayWidth = 'full',
  displayHeight = 'auto',
  objectFit = 'cover',
  borderRadius = '0px',
  fallbackSrc = '/placeholder.svg',
  loading = 'lazy',
  sizes,
  onClick,
  cursor = 'default',
  ...restProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const primarySrc = useMemo(() => {
    if (!src) return fallbackSrc

    if (src.includes('cloudinary.com')) {
      const { fallback } = getOptimizedImageWithFallback(src, width)
      return fallback
    }

    return src
  }, [src, width, fallbackSrc])

  const originalSrc = useMemo(() => src || fallbackSrc, [src, fallbackSrc])
  const srcSet = useMemo(() => {
    if (!src || !src.includes('cloudinary.com')) return undefined
    return generateCloudinarySrcSet(src, width)
  }, [src, width])
  const [imageSrc, setImageSrc] = useState<string>(primarySrc)

  useEffect(() => {
    setIsLoaded(false)
    setImageSrc(primarySrc)
    if (!src) {
      setIsLoaded(true)
    }
  }, [src, primarySrc])

  return (
    <Box
      position="relative"
      w={displayWidth}
      h={displayHeight}
      borderRadius={borderRadius}
      overflow="hidden"
      {...restProps}
    >
      {!isLoaded && (
        <Skeleton
          position="absolute"
          inset={0}
          borderRadius={borderRadius}
          zIndex={0}
        />
      )}
      <ChakraImage
        src={imageSrc}
        srcSet={srcSet}
        sizes={srcSet ? (sizes || `(max-width: 480px) 50vw, (max-width: 768px) 33vw, ${width}px`) : undefined}
        alt={alt}
        w="100%"
        h="100%"
        objectFit={objectFit}
        borderRadius={borderRadius}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (imageSrc === primarySrc && primarySrc !== originalSrc) {
            setImageSrc(originalSrc)
            return
          }

          if (imageSrc !== fallbackSrc) {
            setImageSrc(fallbackSrc)
            return
          }

          setIsLoaded(true)
        }}
        onClick={onClick}
        cursor={cursor}
        position="absolute"
        inset={0}
        zIndex={1}
      />
    </Box>
  )
}

export default OptimizedImage
