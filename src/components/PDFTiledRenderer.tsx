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
  const [tileSize] = useState<number>(256) // Smaller tiles for better performance
  const [tileOverlap] = useState<number>(32) // Smaller overlap
  const [maxConcurrentTiles] = useState<number>(4)
  const [renderingQueue, setRenderingQueue] = useState<Tile[]>([])
  const [isRendering, setIsRendering] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate tiles based on viewport
  const calculateTiles = useCallback(
    (viewport: Viewport): Tile[] => {
      const tiles: Tile[] = []
      const { x, y, width, height, scale } = viewport

      // Calculate visible area in PDF coordinates
      const visibleX = -x / scale
      const visibleY = -y / scale
      const visibleWidth = width / scale
      const visibleHeight = height / scale

      // Calculate tile grid
      const startTileX = Math.floor(visibleX / (tileSize - tileOverlap))
      const endTileX = Math.ceil((visibleX + visibleWidth) / (tileSize - tileOverlap))
      const startTileY = Math.floor(visibleY / (tileSize - tileOverlap))
      const endTileY = Math.ceil((visibleY + visibleHeight) / (tileSize - tileOverlap))

      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        for (let tileX = startTileX; tileX <= endTileX; tileX++) {
          const tileXPos = tileX * (tileSize - tileOverlap)
          const tileYPos = tileY * (tileSize - tileOverlap)

          tiles.push({
            x: tileXPos,
            y: tileYPos,
            width: tileSize,
            height: tileSize,
            canvas: document.createElement('canvas'),
            rendered: false,
            loading: false,
          })
        }
      }

      return tiles
    },
    [tileSize, tileOverlap]
  )

  // Render a single tile
  const renderTile = useCallback(
    async (tile: Tile, page: PDFPageProxy, scale: number) => {
      if (tile.rendered || tile.loading) return

      try {
        tile.loading = true
        console.log('🔄 Tiling: Rendering tile at', tile.x, tile.y, 'with scale', scale)
        const canvas = tile.canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = tile.width
        canvas.height = tile.height

        // Calculate the viewport for this tile
        const tileViewport = page.getViewport({ scale })
        const transform = [scale, 0, 0, scale, -tile.x * scale, -tile.y * scale]

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
        console.log('✅ Tiling: Successfully rendered tile at', tile.x, tile.y)
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
      {/* Tiling background indicator */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, #3b82f6 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          zIndex: 0,
        }}
      />

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
                el.width = tile.width
                el.height = tile.height
                const ctx = el.getContext('2d')
                if (ctx && tile.rendered) {
                  ctx.drawImage(tile.canvas, 0, 0)
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
