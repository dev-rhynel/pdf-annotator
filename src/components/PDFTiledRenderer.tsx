'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist'

interface Tile {
  x: number
  y: number
  width: number
  height: number
  canvas: HTMLCanvasElement
  rendered: boolean
  loading: boolean
}

interface Viewport {
  x: number
  y: number
  width: number
  height: number
  scale: number
}

interface PDFTiledRendererProps {
  pdfDocument: PDFDocumentProxy
  currentPage: number
  viewport: Viewport
  onTileRendered?: (tile: Tile) => void
}

export default function PDFTiledRenderer({
  pdfDocument,
  currentPage,
  viewport,
  onTileRendered,
}: PDFTiledRendererProps) {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [tileSize] = useState<number>(1024) // Much larger tiles for better quality
  const [tileOverlap] = useState<number>(128) // Larger overlap to prevent seams
  const [maxConcurrentTiles] = useState<number>(2) // Fewer concurrent renders
  const [renderingQueue, setRenderingQueue] = useState<Tile[]>([])
  const [isRendering, setIsRendering] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate tiles based on viewport - simplified and more efficient
  const calculateTiles = useCallback(
    (viewport: Viewport): Tile[] => {
      const tiles: Tile[] = []
      const { x, y, width, height, scale } = viewport

      // Calculate visible area in PDF coordinates
      const visibleX = -x / scale
      const visibleY = -y / scale
      const visibleWidth = width / scale
      const visibleHeight = height / scale

      // Calculate tile grid with larger tiles
      const effectiveTileSize = tileSize - tileOverlap
      const startTileX = Math.floor(visibleX / effectiveTileSize)
      const endTileX = Math.ceil((visibleX + visibleWidth) / effectiveTileSize)
      const startTileY = Math.floor(visibleY / effectiveTileSize)
      const endTileY = Math.ceil((visibleY + visibleHeight) / effectiveTileSize)

      // Limit the number of tiles to prevent excessive rendering
      const maxTiles = 16 // Maximum tiles to render at once
      let tileCount = 0

      for (let tileY = startTileY; tileY <= endTileY && tileCount < maxTiles; tileY++) {
        for (let tileX = startTileX; tileX <= endTileX && tileCount < maxTiles; tileX++) {
          const tileXPos = tileX * effectiveTileSize
          const tileYPos = tileY * effectiveTileSize

          tiles.push({
            x: tileXPos,
            y: tileYPos,
            width: tileSize,
            height: tileSize,
            canvas: document.createElement('canvas'),
            rendered: false,
            loading: false,
          })
          tileCount++
        }
      }

      return tiles
    },
    [tileSize, tileOverlap]
  )

  // Render a single tile with proper scaling
  const renderTile = useCallback(
    async (tile: Tile, page: PDFPageProxy, scale: number) => {
      if (tile.rendered || tile.loading) return

      try {
        tile.loading = true
        console.log('🔄 Tiling: Rendering tile at', tile.x, tile.y, 'with scale', scale)

        const canvas = tile.canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size to match tile dimensions
        canvas.width = tile.width
        canvas.height = tile.height

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Calculate the proper scale for this tile
        // The tile should be rendered at the same scale as the viewport
        const actualScale = scale

        // Create a viewport for this specific tile
        const tileViewport = page.getViewport({ scale: actualScale })

        // Calculate the transform to position the tile correctly
        const transform = [
          actualScale,
          0,
          0,
          actualScale,
          -tile.x * actualScale,
          -tile.y * actualScale,
        ]

        // Render the tile
        const renderContext = {
          canvasContext: ctx,
          canvas: canvas,
          viewport: tileViewport,
          transform: transform,
        }

        await page.render(renderContext).promise
        tile.rendered = true
        tile.loading = false
        console.log(
          '✅ Tiling: Successfully rendered tile at',
          tile.x,
          tile.y,
          'with scale',
          actualScale
        )
        onTileRendered?.(tile)
      } catch (err) {
        console.error('❌ Tiling: Error rendering tile:', err)
        tile.loading = false
      }
    },
    [onTileRendered]
  )

  // Process rendering queue
  const processQueue = useCallback(async () => {
    if (isRendering || renderingQueue.length === 0) return

    setIsRendering(true)
    const tilesToRender = renderingQueue.slice(0, maxConcurrentTiles)
    setRenderingQueue(prev => prev.slice(maxConcurrentTiles))

    try {
      const page = await pdfDocument.getPage(currentPage)
      const renderPromises = tilesToRender.map(tile => renderTile(tile, page, viewport.scale))
      await Promise.all(renderPromises)
    } catch (err) {
      console.error('Error processing rendering queue:', err)
    } finally {
      setIsRendering(false)
    }
  }, [
    isRendering,
    renderingQueue,
    maxConcurrentTiles,
    pdfDocument,
    currentPage,
    viewport.scale,
    renderTile,
  ])

  // Update tiles when viewport changes
  useEffect(() => {
    if (!pdfDocument || !currentPage) return

    const newTiles = calculateTiles(viewport)
    console.log('🔄 Tiling: Calculating tiles for viewport:', viewport)
    console.log('🔄 Tiling: Created', newTiles.length, 'tiles')
    setTiles(newTiles)
    setRenderingQueue(newTiles.filter(tile => !tile.rendered))
  }, [pdfDocument, currentPage, viewport, calculateTiles])

  // Process queue when it changes
  useEffect(() => {
    if (renderingQueue.length > 0) {
      console.log('🔄 Tiling: Processing queue with', renderingQueue.length, 'tiles')
    }
    processQueue()
  }, [processQueue, renderingQueue.length])

  // Clean up tiles when component unmounts
  useEffect(() => {
    return () => {
      tiles.forEach(tile => {
        if (tile.canvas) {
          tile.canvas.remove()
        }
      })
    }
  }, [tiles])

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {tiles.map(tile => (
        <div
          key={`${tile.x}-${tile.y}-${tile.width}-${tile.height}`}
          className="absolute"
          style={{
            left: tile.x * viewport.scale + viewport.x,
            top: tile.y * viewport.scale + viewport.y,
            width: tile.width * viewport.scale,
            height: tile.height * viewport.scale,
            zIndex: 1,
          }}
        >
          {tile.loading && (
            <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          <canvas
            ref={el => {
              if (el && tile.canvas) {
                // Set the display canvas size to match the scaled tile size
                el.width = tile.width * viewport.scale
                el.height = tile.height * viewport.scale
                const ctx = el.getContext('2d')
                if (ctx && tile.rendered) {
                  // Clear the canvas first
                  ctx.clearRect(0, 0, el.width, el.height)
                  // Draw the tile canvas with proper scaling
                  ctx.drawImage(tile.canvas, 0, 0, el.width, el.height)
                }
              }
            }}
            className="w-full h-full"
            style={{ display: tile.rendered ? 'block' : 'none' }}
          />
        </div>
      ))}
    </div>
  )
}
