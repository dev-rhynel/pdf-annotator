'use client'

import {useState, useEffect, useRef} from 'react'
import {
  AnnotationType,
  Annotation,
  Point,
  CircleAnnotation,
  SignatureAnnotation,
} from '@/types/annotation'
import jsPDF from 'jspdf'

interface SimplePDFViewerProps {
  file: File
  currentTool: AnnotationType
  annotations: Annotation[]
  onAnnotationAdd: (annotation: Annotation) => void
  onAnnotationsReplace: (annotations: Annotation[]) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  selectedAnnotations: string[]
  selectedPolygons: string[]
  setSelectedAnnotations: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedPolygons: React.Dispatch<React.SetStateAction<string[]>>
  selectedColor: string
  strokeWidth: number
  selectedAnnotation: string | null
  setSelectedAnnotation: React.Dispatch<React.SetStateAction<string | null>>
}

export default function SimplePDFViewer({
  file,
  currentTool,
  annotations,
  onAnnotationAdd,
  onAnnotationsReplace,
  canvasRef,
  selectedAnnotations,
  selectedPolygons,
  setSelectedAnnotations,
  setSelectedPolygons,
  selectedColor,
  strokeWidth,
  selectedAnnotation,
  setSelectedAnnotation,
}: SimplePDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([])

  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [mousePosition, setMousePosition] = useState<Point | null>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false)
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false)

  const [signaturePosition, setSignaturePosition] = useState<Point | null>(null)
  const [isDevMode, setIsDevMode] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPdfUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  // Ensure container and canvas are properly sized and responsive
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current
        const canvas = canvasRef.current
        const iframe = container.querySelector('iframe') as HTMLIFrameElement

        // Force container to be full size and responsive
        container.style.width = '100%'
        container.style.height = '1036px'
        container.style.overflow = 'hidden'
        container.style.position = 'relative'
        container.style.display = 'flex'
        container.style.alignItems = 'center'
        container.style.justifyContent = 'center'

        // Make iframe fully responsive to PDF content
        if (iframe) {
          iframe.style.overflow = 'hidden'
          iframe.style.position = 'absolute'
          iframe.style.top = '0'
          iframe.style.left = '0'
          iframe.style.width = '100%'
          iframe.style.height = '100%'
          iframe.style.objectFit = 'contain'
          iframe.style.maxWidth = '100%'
          iframe.style.maxHeight = '100%'
          iframe.style.zIndex = '1'

          // Try to make the PDF fit the container without scrollbars
          iframe.onload = () => {
            setTimeout(() => {
              try {
                if (iframe.contentDocument) {
                  const style = iframe.contentDocument.createElement('style')
                  style.textContent = `
                    #toolbarViewerLeft, #toolbarViewerRight, #toolbarContainer, 
                    #secondaryToolbar, #toolbar, .toolbar, .toolbarButton {
                      display: none !important;
                    }
                    #viewerContainer {
                      top: 0 !important;
                      height: 100% !important;
                      overflow: hidden !important;
                      position: absolute !important;
                      width: 100% !important;
                      display: flex !important;
                      align-items: center !important;
                      justify-content: center !important;
                    }
                    #viewer {
                      height: 100% !important;
                      overflow: hidden !important;
                      width: 100% !important;
                      display: flex !important;
                      align-items: center !important;
                      justify-content: center !important;
                    }
                    #viewerContainer > div {
                      overflow: hidden !important;
                      width: 100% !important;
                      height: 100% !important;
                      display: flex !important;
                      align-items: center !important;
                      justify-content: center !important;
                    }
                    .page {
                      width: auto !important;
                      height: auto !important;
                      max-width: 100% !important;
                      max-height: 100% !important;
                      object-fit: contain !important;
                      display: block !important;
                      margin: auto !important;
                    }
                    body {
                      margin: 0 !important;
                      padding: 0 !important;
                      overflow: hidden !important;
                    }
                  `
                  iframe.contentDocument.head.appendChild(style)
                }
              } catch (e) {
                // Cross-origin restrictions
              }
            }, 1000)
          }
        }

        // Make canvas fully responsive to container size
        canvas.style.position = 'absolute'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.zIndex = '20'
        canvas.style.pointerEvents = 'auto'
        canvas.style.overflow = 'hidden'
        canvas.style.objectFit = 'contain'
        canvas.style.maxWidth = '100%'
        canvas.style.maxHeight = '100%'

        // Update canvas resolution to match container with responsive scaling
        const rect = container.getBoundingClientRect()
        const scale = 2
        canvas.width = rect.width * scale
        canvas.height = rect.height * scale
        canvas.style.width = rect.width + 'px'
        canvas.style.height = rect.height + 'px'

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(scale, scale)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          setCanvasContext(ctx)
          if (isDevMode) {
            console.log(
              'Canvas context set up with scale:',
              scale,
              'canvas size:',
              canvas.width,
              'x',
              canvas.height,
              'container rect:',
              rect,
              'canvas style size:',
              canvas.style.width,
              'x',
              canvas.style.height
            )
          }

          // Force a re-render after canvas context is set
          setTimeout(() => {
            renderAnnotations()
          }, 100)
        }
      }
    }

    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)
    return () => window.removeEventListener('resize', updateContainerSize)
  }, [])

  const renderAnnotations = () => {
    if (isDevMode) {
      console.log('🔄 renderAnnotations called:', {
        canvasContext: !!canvasContext,
        canvasRef: !!canvasRef.current,
        isDrawing,
        drawingPoints: drawingPoints.length,
        currentTool,
      })
    }
    if (!canvasRef.current) {
      if (isDevMode) {
        console.log('Missing canvas ref')
      }
      return
    }

    // Get fresh context if needed
    let ctx = canvasContext
    if (!ctx) {
      ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        const scale = 2
        // Reset any previous transformations
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(scale, scale)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        setCanvasContext(ctx)
        if (isDevMode) {
          console.log('Recreated canvas context')
        }
      }
    }

    if (!ctx) {
      if (isDevMode) {
        console.log('Still missing canvas context')
      }
      return
    }

    // At this point ctx is guaranteed to be non-null
    const context = ctx!

    // Clear canvas with proper dimensions
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = 2
    context.clearRect(0, 0, canvas.width / scale, canvas.height / scale)
    if (isDevMode) {
      console.log(
        '🧹 Cleared canvas with dimensions:',
        canvas.width,
        'x',
        canvas.height,
        'cleared area:',
        canvas.width / scale,
        'x',
        canvas.height / scale
      )
    }

    // Draw all annotations
    annotations.forEach(annotation => {
      // Set drawing style
      context.strokeStyle = annotation.color
      context.fillStyle = annotation.color
      context.lineWidth = annotation.strokeWidth
      context.lineCap = 'round'
      context.lineJoin = 'round'

      switch (annotation.type) {
        case 'line':
          if (annotation.points.length >= 2) {
            context.beginPath()
            context.moveTo(annotation.points[0].x, annotation.points[0].y)
            context.lineTo(annotation.points[1].x, annotation.points[1].y)
            context.stroke()
            if (isDevMode) {
              console.log('📏 Drawing line from', annotation.points[0], 'to', annotation.points[1])
            }
          }
          break

        case 'rectangle':
          if (annotation.points.length >= 2) {
            const x = Math.min(annotation.points[0].x, annotation.points[1].x)
            const y = Math.min(annotation.points[0].y, annotation.points[1].y)
            const width = Math.abs(annotation.points[1].x - annotation.points[0].x)
            const height = Math.abs(annotation.points[1].y - annotation.points[0].y)
            context.strokeRect(x, y, width, height)
          }
          break

        case 'polygon':
          if (annotation.points.length >= 3) {
            context.beginPath()
            context.moveTo(annotation.points[0].x, annotation.points[0].y)
            for (let i = 1; i < annotation.points.length; i++) {
              context.lineTo(annotation.points[i].x, annotation.points[i].y)
            }
            context.closePath()
            context.stroke()
          }
          break

        case 'circle':
          if (annotation.points.length >= 1) {
            const centerX = annotation.points[0].x
            const centerY = annotation.points[0].y
            const radius = (annotation as CircleAnnotation).radius || 20
            context.beginPath()
            context.arc(centerX, centerY, radius, 0, 2 * Math.PI)
            context.stroke()
          }
          break

        case 'signature':
          if (annotation.points.length >= 1) {
            const signatureAnnotation = annotation as SignatureAnnotation
            const img = new Image()
            img.onload = () => {
              context.drawImage(
                img,
                signatureAnnotation.points[0].x,
                signatureAnnotation.points[0].y,
                signatureAnnotation.width,
                signatureAnnotation.height
              )
            }
            img.src = signatureAnnotation.signatureData
          }
          break
      }
    })

    // Draw current drawing
    if (isDrawing && drawingPoints.length > 1) {
      if (isDevMode) {
        console.log('Drawing current shape:', {currentTool, drawingPoints})
      }
      context.strokeStyle = selectedColor
      context.fillStyle = selectedColor
      context.lineWidth = strokeWidth
      context.lineCap = 'round'
      context.lineJoin = 'round'

      switch (currentTool) {
        case 'line':
          context.beginPath()
          context.moveTo(drawingPoints[0].x, drawingPoints[0].y)
          context.lineTo(drawingPoints[1].x, drawingPoints[1].y)
          context.stroke()
          break

        case 'rectangle':
          const x = Math.min(drawingPoints[0].x, drawingPoints[1].x)
          const y = Math.min(drawingPoints[0].y, drawingPoints[1].y)
          const width = Math.abs(drawingPoints[1].x - drawingPoints[0].x)
          const height = Math.abs(drawingPoints[1].y - drawingPoints[0].y)
          context.strokeRect(x, y, width, height)
          break

        case 'polygon':
          context.beginPath()
          context.moveTo(drawingPoints[0].x, drawingPoints[0].y)
          for (let i = 1; i < drawingPoints.length; i++) {
            context.lineTo(drawingPoints[i].x, drawingPoints[i].y)
          }
          // Show preview line to mouse position if we're drawing a polygon
          if (isDrawing && mousePosition) {
            context.lineTo(mousePosition.x, mousePosition.y)
          }
          context.stroke()
          break

        case 'circle':
          if (drawingPoints.length >= 2) {
            const centerX = drawingPoints[0].x
            const centerY = drawingPoints[0].y
            const radius = Math.sqrt(
              Math.pow(drawingPoints[1].x - centerX, 2) + Math.pow(drawingPoints[1].y - centerY, 2)
            )
            if (isDevMode) {
              console.log('🔵 Drawing circle:', {
                center: {x: centerX, y: centerY},
                secondPoint: drawingPoints[1],
                radius,
                drawingPoints,
              })
            }
            context.beginPath()
            context.arc(centerX, centerY, radius, 0, 2 * Math.PI)
            context.stroke()
          }
          break
      }
    }
  }

  useEffect(() => {
    if (isDevMode) {
      console.log('renderAnnotations useEffect triggered:', {
        canvasContext: !!canvasContext,
        canvasRef: !!canvasRef.current,
        isDrawing,
        drawingPoints: drawingPoints.length,
      })
    }
    renderAnnotations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    annotations,
    canvasContext,
    selectedPolygons,
    isDrawing,
    drawingPoints,
    currentTool,
    mousePosition,
    selectedColor,
    strokeWidth,
  ])

  // Handle keyboard events for polygon completion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentTool === 'polygon' && isDrawing && drawingPoints.length > 0) {
        if (e.key === 'Escape') {
          // Cancel the polygon
          setIsDrawing(false)
          setDrawingPoints([])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentTool, isDrawing, drawingPoints])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDevMode) {
      console.log('🖱️ MOUSE DOWN EVENT TRIGGERED')
    }
    if (!canvasRef.current) {
      if (isDevMode) {
        console.log('❌ Canvas ref not available')
      }
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    // Canvas is scaled by 2x, so we need to convert mouse coordinates to logical coordinates
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDevMode) {
      console.log('🖱️ Mouse down:', {
        x,
        y,
        currentTool,
        isDrawing,
        rect: {left: rect.left, top: rect.top},
        clientX: e.clientX,
        clientY: e.clientY,
        scale: 2,
        rawX: e.clientX - rect.left,
        rawY: e.clientY - rect.top,
      })
    }

    if (isDevMode) {
      console.log('🎨 Starting drawing with tool:', currentTool)
    }

    // Handle polygon differently - continuous clicking to add points
    if (currentTool === 'polygon') {
      if (!isDrawing) {
        // Start new polygon
        setIsDrawing(true)
        setDrawingPoints([{x, y}])
        if (isDevMode) {
          console.log('✅ Started new polygon with point:', {x, y})
        }
      } else {
        // Add point to existing polygon
        const distance = Math.sqrt(
          Math.pow(x - drawingPoints[0].x, 2) + Math.pow(y - drawingPoints[0].y, 2)
        )
        if (distance <= 10 && drawingPoints.length >= 3) {
          // Close polygon if clicked near start point and has at least 3 points
          const annotation: Annotation = {
            id: Date.now().toString(),
            type: 'polygon',
            points: drawingPoints,
            color: selectedColor,
            strokeWidth,
            page: 1,
            timestamp: Date.now(),
          }
          onAnnotationAdd(annotation)
          setIsDrawing(false)
          setDrawingPoints([])
          if (isDevMode) {
            console.log('✅ Completed polygon with points:', drawingPoints)
          }
        } else {
          // Add new point to polygon
          setDrawingPoints([...drawingPoints, {x, y}])
          if (isDevMode) {
            console.log(
              '✅ Added point to polygon:',
              {x, y},
              'total points:',
              drawingPoints.length + 1
            )
          }
        }
      }
      return
    }

    // For other tools, start drawing normally
    setIsDrawing(true)
    setDrawingPoints([{x, y}])
    if (isDevMode) {
      console.log('✅ Set isDrawing=true, drawingPoints=[{x, y}]')
    }

    if (currentTool === 'signature') {
      if (isDevMode) {
        console.log('Signature tool selected, showing signature modal')
      }
      setSignaturePosition({x, y})
      setShowSignatureModal(true)
      setIsDrawing(false)
      return
    }

    // Start long press timer for circle tool
    if (currentTool === 'circle') {
      const timer = setTimeout(() => {
        if (isDrawing && drawingPoints.length === 1) {
          // Create perfect circle
          const center = drawingPoints[0]
          const radius = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2))
          if (isDevMode) {
            console.log('🔵 Circle long press:', {
              center,
              currentMouse: {x, y},
              radius,
              drawingPoints,
            })
          }
          const annotation: CircleAnnotation = {
            id: Date.now().toString(),
            type: 'circle',
            points: [center],
            color: selectedColor,
            strokeWidth,
            page: 1,
            timestamp: Date.now(),
            radius,
          }
          onAnnotationAdd(annotation)
          setIsDrawing(false)
          setDrawingPoints([])
        }
      }, 500)
      setLongPressTimer(timer)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDevMode) {
      console.log('🖱️ MOUSE MOVE EVENT TRIGGERED')
    }
    if (!canvasRef.current) {
      if (isDevMode) {
        console.log('Canvas ref not available for mouse move')
      }
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    // Canvas is scaled by 2x, so we need to convert mouse coordinates to logical coordinates
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePosition({x, y})

    // Handle drawing
    if (isDrawing && drawingPoints.length > 0) {
      if (isDevMode) {
        console.log('🎨 Drawing:', {x, y, drawingPoints: drawingPoints.length, currentTool})
      }

      // For rectangle, circle, and line, keep the first point and add current position as second point
      let newPoints: Point[]
      if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
        newPoints = [drawingPoints[0], {x, y}]
        if (currentTool === 'circle' && isDevMode) {
          console.log('🔵 Circle drawing points:', {
            firstPoint: drawingPoints[0],
            currentPoint: {x, y},
            newPoints,
          })
        }
        if (isDevMode) {
          console.log('📝 New drawing points:', newPoints)
        }
        setDrawingPoints(newPoints)
      }
      // For polygon, we don't update drawingPoints during mouse move, just store mouse position for preview

      // Force immediate re-render for drawing
      setTimeout(() => {
        if (isDevMode) {
          console.log('🔄 Forcing renderAnnotations()')
        }
        renderAnnotations()
      }, 10)
    }
  }

  const handleCanvasMouseUp = () => {
    if (isDevMode) {
      console.log('Mouse up:', {currentTool})
    }

    // Handle drawing completion
    if (isDevMode) {
      console.log('🎨 Mouse up - drawing completion:', {
        isDrawing,
        drawingPoints: drawingPoints.length,
        currentTool,
      })
    }
    if (isDrawing && drawingPoints.length > 0) {
      if (isDevMode) {
        console.log('✅ Completing drawing with tool:', currentTool, 'points:', drawingPoints)
      }
      if (currentTool === 'line' && drawingPoints.length >= 2) {
        const annotation: Annotation = {
          id: Date.now().toString(),
          type: 'line',
          points: [drawingPoints[0], drawingPoints[1]],
          color: selectedColor,
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
        }
        onAnnotationAdd(annotation)
        setIsDrawing(false)
        setDrawingPoints([])
      } else if (currentTool === 'rectangle' && drawingPoints.length >= 2) {
        const annotation: Annotation = {
          id: Date.now().toString(),
          type: 'rectangle',
          points: [drawingPoints[0], drawingPoints[1]],
          color: selectedColor,
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
        }
        onAnnotationAdd(annotation)
        setIsDrawing(false)
        setDrawingPoints([])
      } else if (currentTool === 'polygon') {
        // For polygon, points are added in mouse down, don't complete here
        return
      } else if (currentTool === 'circle' && drawingPoints.length >= 2) {
        const center = drawingPoints[0]
        const radius = Math.sqrt(
          Math.pow(drawingPoints[1].x - center.x, 2) + Math.pow(drawingPoints[1].y - center.y, 2)
        )
        if (isDevMode) {
          console.log('🔵 Circle completion:', {
            center,
            secondPoint: drawingPoints[1],
            radius,
            drawingPoints,
          })
        }
        const annotation: CircleAnnotation = {
          id: Date.now().toString(),
          type: 'circle',
          points: [center],
          color: selectedColor,
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
          radius,
        }
        onAnnotationAdd(annotation)
        setIsDrawing(false)
        setDrawingPoints([])
      }
    }

    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  // Helper function to check if a point is inside a polygon
  const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (
        polygon[i].y > point.y !== polygon[j].y > point.y &&
        point.x <
          ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) /
            (polygon[j].y - polygon[i].y) +
            polygon[i].x
      ) {
        inside = !inside
      }
    }
    return inside
  }

  // Function to merge selected polygons
  const mergeSelectedPolygons = () => {
    if (selectedPolygons.length < 2) return

    const polygonsToMerge = annotations.filter(
      ann => selectedPolygons.includes(ann.id) && ann.type === 'polygon'
    )

    if (polygonsToMerge.length < 2) return

    // Combine all points from selected polygons
    const allPoints: Point[] = []
    polygonsToMerge.forEach(polygon => {
      allPoints.push(...polygon.points)
    })

    // Create merged polygon
    const mergedPolygon: Annotation = {
      id: Date.now().toString(),
      type: 'polygon',
      points: allPoints,
      color: selectedColor,
      strokeWidth: strokeWidth,
      page: 1,
      timestamp: Date.now(),
    }

    // Remove old polygons and add merged one
    const newAnnotations = annotations.filter(ann => !selectedPolygons.includes(ann.id))
    newAnnotations.push(mergedPolygon)

    // Update annotations
    onAnnotationsReplace(newAnnotations)
    setSelectedPolygons([])
  }

  // Function to delete selected annotations
  const deleteSelectedAnnotations = () => {
    const allSelected = [...selectedAnnotations, ...selectedPolygons]
    if (allSelected.length === 0) return

    const newAnnotations = annotations.filter(ann => !allSelected.includes(ann.id))
    onAnnotationsReplace(newAnnotations)
    setSelectedAnnotations([])
    setSelectedPolygons([])
  }

  // Function to find annotation at a specific point
  const findAnnotationAtPoint = (point: Point): Annotation | null => {
    if (isDevMode) {
      console.log('🔍 Finding annotation at point:', point)
    }
    return (
      annotations.find(ann => {
        if (ann.type === 'polygon') {
          return isPointInPolygon(point, ann.points)
        } else if (ann.type === 'rectangle') {
          if (ann.points.length >= 2) {
            const rectX = Math.min(ann.points[0].x, ann.points[1].x)
            const rectY = Math.min(ann.points[0].y, ann.points[1].y)
            const rectWidth = Math.abs(ann.points[1].x - ann.points[0].x)
            const rectHeight = Math.abs(ann.points[1].y - ann.points[0].y)
            const hit =
              point.x >= rectX &&
              point.x <= rectX + rectWidth &&
              point.y >= rectY &&
              point.y <= rectY + rectHeight
            if (hit && isDevMode) console.log('✅ Hit rectangle annotation:', ann.id)
            return hit
          }
        } else if (ann.type === 'circle') {
          if (ann.points.length >= 1) {
            const centerX = ann.points[0].x
            const centerY = ann.points[0].y
            const radius = (ann as CircleAnnotation).radius || 20 // Default radius if not set
            const distance = Math.sqrt(
              Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
            )
            const hit = distance <= radius
            if (hit && isDevMode)
              console.log(
                '✅ Hit circle annotation:',
                ann.id,
                'distance:',
                distance,
                'radius:',
                radius
              )
            return hit
          }
        } else if (ann.type === 'line') {
          if (ann.points.length >= 2) {
            const tolerance = 5 // Click tolerance for line selection
            const x1 = ann.points[0].x
            const y1 = ann.points[0].y
            const x2 = ann.points[1].x
            const y2 = ann.points[1].y
            const distance =
              Math.abs((y2 - y1) * point.x - (x2 - x1) * point.y + x2 * y1 - y2 * x1) /
              Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2))
            const hit = distance <= tolerance
            if (hit && isDevMode)
              console.log(
                '✅ Hit line annotation:',
                ann.id,
                'distance:',
                distance,
                'tolerance:',
                tolerance
              )
            return hit
          }
        } else if (ann.type === 'signature') {
          if (ann.points.length >= 1) {
            const signatureAnnotation = ann as SignatureAnnotation
            const signatureX = ann.points[0].x
            const signatureY = ann.points[0].y
            const tolerance =
              Math.max(signatureAnnotation.width || 200, signatureAnnotation.height || 100) / 2
            const hit =
              point.x >= signatureX &&
              point.x <= signatureX + (signatureAnnotation.width || 200) &&
              point.y >= signatureY &&
              point.y <= signatureY + (signatureAnnotation.height || 100)
            if (hit && isDevMode) console.log('✅ Hit signature annotation:', ann.id)
            return hit
          }
        }
        return false
      }) || null
    )
  }

  // Function to download the PDF with annotations
  const downloadPDF = () => {
    if (!pdfUrl || !canvasRef.current) return

    // Create a temporary canvas to combine PDF and annotations
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Set canvas size to match the original
    tempCanvas.width = canvasRef.current.width
    tempCanvas.height = canvasRef.current.height

    // First, we need to capture the PDF as an image
    // For now, we'll create a PDF with just the annotations
    // In a real implementation, you'd need to render the PDF to canvas first

    // Draw the annotations
    tempCtx.drawImage(canvasRef.current, 0, 0)

    // Convert canvas to image
    tempCanvas.toBlob(blob => {
      if (blob) {
        const img = new Image()
        img.src = URL.createObjectURL(blob)

        img.onload = () => {
          const doc = new jsPDF('p', 'mm', 'a4')
          const pageWidth = doc.internal.pageSize.getWidth()
          const pageHeight = doc.internal.pageSize.getHeight()

          // Calculate image dimensions to fit the page
          const imgWidth = img.width
          const imgHeight = img.height
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
          const newWidth = imgWidth * ratio
          const newHeight = imgHeight * ratio

          const margin = 10 // Margin in mm
          const imgX = (pageWidth - newWidth) / 2
          const imgY = (pageHeight - newHeight) / 2

          // Add the image with annotations
          console.log('Adding image to PDF...')
          doc.addImage(img, 'PNG', imgX, imgY, newWidth, newHeight)

          // Add metadata
          doc.setFontSize(10)
          doc.text(`Annotations: ${annotations.length}`, margin, pageHeight - 25)
          doc.text(`File: ${file.name}`, margin, pageHeight - 20)
          doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, pageHeight - 15)

          console.log('Saving PDF...')
          doc.save(`${file.name || 'annotated-document'}.pdf`)
          URL.revokeObjectURL(img.src)
        }
      }
    }, 'image/png')
  }

  // Function to download the PDF with annotations as image
  const downloadWithAnnotations = () => {
    if (!canvasRef.current || !pdfUrl) return

    // Create a temporary canvas to combine PDF and annotations
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Set canvas size to match the original
    tempCanvas.width = canvasRef.current.width
    tempCanvas.height = canvasRef.current.height

    // First, we need to capture the PDF as an image
    // For now, we'll just download the annotations as an image
    // In a real implementation, you'd need to render the PDF to canvas first

    // Draw the annotations
    tempCtx.drawImage(canvasRef.current, 0, 0)

    // Convert to blob and download
    tempCanvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'annotations.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    }, 'image/png')
  }

  // Function to download annotations as JSON
  const downloadAnnotationsJSON = () => {
    const annotationsData = {
      annotations: annotations,
      exportDate: new Date().toISOString(),
      fileName: file.name,
      totalAnnotations: annotations.length,
    }

    const dataStr = JSON.stringify(annotationsData, null, 2)
    const dataBlob = new Blob([dataStr], {type: 'application/json'})
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'annotations.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Function to test basic PDF download functionality
  const testDownload = () => {
    if (isDevMode) {
      console.log('Testing basic PDF download...')
      console.log('Browser info:', navigator.userAgent)
      console.log('jsPDF available:', typeof jsPDF !== 'undefined')
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      if (isDevMode) {
        console.log('jsPDF instance created successfully')
      }

      doc.setFontSize(16)
      doc.text('Test PDF Download', 20, 30)
      doc.setFontSize(12)
      doc.text('This is a test to verify PDF download works.', 20, 50)
      doc.text(`File: ${file.name}`, 20, 70)
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 90)
      doc.text(`Annotations: ${annotations.length}`, 20, 110)

      if (isDevMode) {
        console.log('About to save PDF...')
      }
      doc.save('test-download.pdf')
      if (isDevMode) {
        console.log('Test PDF save() called successfully')
      }

      // Check if download was triggered
      setTimeout(() => {
        if (isDevMode) {
          console.log('Download check: If you see this message, the save() call completed')
        }
      }, 1000)
    } catch (error) {
      if (isDevMode) {
        console.error('Test PDF download failed:', error)
        if (error instanceof Error) {
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
          })
        }
      }
    }
  }

  // Function to capture PDF iframe and combine with annotations
  const capturePDFWithAnnotations = async () => {
    if (!pdfUrl || !canvasRef.current) {
      if (isDevMode) {
        console.error('Missing required data for PDF capture')
      }
      return
    }

    if (isDevMode) {
      console.log('Starting PDF capture with annotations...')
      console.log('PDF URL:', pdfUrl)
      console.log('Canvas ref:', canvasRef.current)
      console.log('Annotations count:', annotations.length)
    }

    try {
      // Create a temporary canvas to combine PDF and annotations
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        if (isDevMode) {
          console.error('Could not get temporary canvas context')
        }
        createFallbackPDF()
        return
      }

      // Set canvas size to match the original
      tempCanvas.width = canvasRef.current.width
      tempCanvas.height = canvasRef.current.height
      if (isDevMode) {
        console.log(
          'Temporary canvas created with dimensions:',
          tempCanvas.width,
          'x',
          tempCanvas.height
        )
      }

      // Create white background for the final output
      tempCtx.fillStyle = '#ffffff'
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

      let pdfRendered = false
      let downloadTriggered = false

      // Try to render PDF directly using PDF.js
      try {
        if (isDevMode) {
          console.log('Attempting PDF.js rendering...')
        }
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

        if (isDevMode) {
          console.log('Loading PDF document...')
        }
        // Load the PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        if (isDevMode) {
          console.log('PDF loaded successfully, pages:', pdf.numPages)
        }

        // Get the first page
        const page = await pdf.getPage(1)
        if (isDevMode) {
          console.log('Page 1 loaded, dimensions:', page.getViewport({scale: 1}))
        }

        // Calculate viewport to fit the canvas
        const viewport = page.getViewport({scale: 1})
        const scale = Math.min(
          tempCanvas.width / viewport.width,
          tempCanvas.height / viewport.height
        )
        const scaledViewport = page.getViewport({scale})
        if (isDevMode) {
          console.log(
            'Calculated scale:',
            scale,
            'viewport size:',
            scaledViewport.width,
            'x',
            scaledViewport.height
          )
        }

        // Create a temporary canvas for PDF rendering
        const pdfCanvas = document.createElement('canvas')
        const pdfCtx = pdfCanvas.getContext('2d')
        if (!pdfCtx) throw new Error('Could not get PDF canvas context')

        pdfCanvas.width = scaledViewport.width
        pdfCanvas.height = scaledViewport.height

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: pdfCtx,
          viewport: scaledViewport,
          canvas: pdfCanvas,
        }

        if (isDevMode) {
          console.log('Rendering PDF page to canvas...')
        }
        await page.render(renderContext).promise
        if (isDevMode) {
          console.log('PDF page rendered successfully')
        }

        // Calculate centering offset
        const offsetX = (tempCanvas.width - pdfCanvas.width) / 2
        const offsetY = (tempCanvas.height - pdfCanvas.height) / 2

        // Draw the PDF content centered on the temp canvas
        tempCtx.drawImage(pdfCanvas, offsetX, offsetY)
        if (isDevMode) {
          console.log('PDF content drawn to temp canvas at offset:', offsetX, offsetY)
        }

        pdfRendered = true
        if (isDevMode) {
          console.log('Successfully rendered PDF to canvas')
        }
      } catch (pdfError) {
        if (isDevMode) {
          console.error('PDF.js rendering failed:', pdfError)
        }

        // Fallback: Try to capture the current iframe content
        const currentIframe = document.querySelector('iframe') as HTMLIFrameElement
        if (currentIframe) {
          try {
            if (isDevMode) {
              console.log('Trying iframe capture...')
            }
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for iframe to be ready

            const html2canvas = (await import('html2canvas')).default

            // Try to capture the iframe content with different settings
            const pdfCanvas = await html2canvas(currentIframe, {
              allowTaint: true,
              useCORS: true,
              scale: 2,
              backgroundColor: '#ffffff',
              width: tempCanvas.width,
              height: tempCanvas.height,
              logging: isDevMode, // Enable logging only in dev mode
              removeContainer: false,
              foreignObjectRendering: true,
              ignoreElements: element => {
                // Ignore any toolbar elements
                return (
                  element.id?.includes('toolbar') ||
                  element.className?.includes('toolbar') ||
                  element.tagName === 'BUTTON'
                )
              },
            })

            // Draw the PDF content first
            if (tempCtx) {
              tempCtx.drawImage(pdfCanvas, 0, 0, tempCanvas.width, tempCanvas.height)
              if (isDevMode) {
                console.log('Iframe capture successful')
              }
              pdfRendered = true
            }
          } catch (error) {
            if (isDevMode) {
              console.error('Iframe capture failed:', error)
            }

            // Alternative: Try to capture the entire container
            const container = containerRef.current
            if (container && tempCtx) {
              try {
                if (isDevMode) {
                  console.log('Trying container capture...')
                }
                const html2canvas = (await import('html2canvas')).default

                const containerCanvas = await html2canvas(container as HTMLElement, {
                  allowTaint: true,
                  useCORS: true,
                  scale: 2,
                  backgroundColor: '#ffffff',
                  width: tempCanvas.width,
                  height: tempCanvas.height,
                  logging: isDevMode,
                  removeContainer: false,
                  foreignObjectRendering: true,
                })

                // Draw the container content
                if (tempCtx) {
                  tempCtx.drawImage(containerCanvas, 0, 0, tempCanvas.width, tempCanvas.height)
                  if (isDevMode) {
                    console.log('Container capture successful')
                  }
                  pdfRendered = true
                }
              } catch (containerError) {
                if (isDevMode) {
                  console.error('Container capture failed:', containerError)
                }
                // If all else fails, just use white background with annotations
              }
            }
          }
        }
      }

      // If PDF wasn't rendered by alternative method, draw annotations only
      if (!pdfRendered) {
        if (isDevMode) {
          console.log('Using fallback method - drawing annotations only...')
        }
        // Now draw annotations with transparency on top
        if (tempCtx && canvasRef.current) {
          tempCtx.globalAlpha = 0.8
          tempCtx.drawImage(canvasRef.current, 0, 0)
          tempCtx.globalAlpha = 1.0
        }
      } else {
        if (isDevMode) {
          console.log('PDF was rendered successfully, drawing annotations on top...')
        }
        // Draw annotations with transparency on top of the rendered PDF
        if (tempCtx && canvasRef.current) {
          tempCtx.globalAlpha = 0.8
          tempCtx.drawImage(canvasRef.current, 0, 0)
          tempCtx.globalAlpha = 1.0
        }
      }

      // Convert canvas to PNG image (regardless of whether PDF was rendered or not)
      if (isDevMode) {
        console.log('Converting canvas to blob...')
      }
      tempCanvas.toBlob(
        blob => {
          if (blob) {
            if (isDevMode) {
              console.log('Blob created successfully, size:', blob.size)
            }
            const img = new Image()
            img.src = URL.createObjectURL(blob)

            img.onload = () => {
              if (isDevMode) {
                console.log('Image loaded, dimensions:', img.width, 'x', img.height)
              }
              const doc = new jsPDF('p', 'mm', 'a4')
              const pageWidth = doc.internal.pageSize.getWidth()
              const pageHeight = doc.internal.pageSize.getHeight()

              // Calculate image dimensions to fit the page
              const imgWidth = img.width
              const imgHeight = img.height
              const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
              const newWidth = imgWidth * ratio
              const newHeight = imgHeight * ratio

              const margin = 10 // Margin in mm
              const imgX = (pageWidth - newWidth) / 2
              const imgY = (pageHeight - newHeight) / 2

              // Add the image with PDF content and annotations
              if (isDevMode) {
                console.log('Adding image to PDF...')
              }
              doc.addImage(img, 'PNG', imgX, imgY, newWidth, newHeight)

              // Add metadata
              doc.setFontSize(10)
              doc.text(`Annotations: ${annotations.length}`, margin, pageHeight - 25)
              doc.text(`File: ${file.name}`, margin, pageHeight - 20)
              doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, pageHeight - 15)

              if (isDevMode) {
                console.log('Saving PDF...')
              }
              doc.save(`${file.name || 'annotated-document'}.pdf`)
              downloadTriggered = true
              if (isDevMode) {
                console.log('PDF saved successfully')
              }
              URL.revokeObjectURL(img.src)
            }
            img.onerror = error => {
              if (isDevMode) {
                console.error('Image failed to load:', error)
              }
              createFallbackPDF()
            }
          } else {
            if (isDevMode) {
              console.error('Failed to create blob from canvas')
            }
            createFallbackPDF()
          }
        },
        'image/png',
        1.0
      ) // Use PNG format with maximum quality

      // Wait a bit to see if the download was triggered
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (!downloadTriggered) {
        if (isDevMode) {
          console.log('Download was not triggered, using fallback...')
        }
        createFallbackPDF()
      }
    } catch (error) {
      if (isDevMode) {
        console.error('Error creating PDF:', error)
      }
      // Fallback: create PDF with just annotations and white background
      createFallbackPDF()
    }
  }

  // Fallback function to create PDF with just annotations
  const createFallbackPDF = () => {
    if (!canvasRef.current) return

    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCanvas.width = canvasRef.current.width
    tempCanvas.height = canvasRef.current.height

    // Create white background
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

    // Draw annotations with transparency
    tempCtx.globalAlpha = 0.8
    tempCtx.drawImage(canvasRef.current, 0, 0)
    tempCtx.globalAlpha = 1.0

    tempCanvas.toBlob(blob => {
      if (blob) {
        const img = new Image()
        img.src = URL.createObjectURL(blob)

        img.onload = () => {
          const doc = new jsPDF('p', 'mm', 'a4')
          const pageWidth = doc.internal.pageSize.getWidth()
          const pageHeight = doc.internal.pageSize.getHeight()

          const imgWidth = img.width
          const imgHeight = img.height
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
          const newWidth = imgWidth * ratio
          const newHeight = imgHeight * ratio

          const margin = 10
          const imgX = (pageWidth - newWidth) / 2
          const imgY = (pageHeight - newHeight) / 2

          doc.addImage(img, 'PNG', imgX, imgY, newWidth, newHeight)

          doc.setFontSize(10)
          doc.text(`Annotations: ${annotations.length}`, margin, pageHeight - 25)
          doc.text(`File: ${file.name}`, margin, pageHeight - 20)
          doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, pageHeight - 15)
          doc.text(
            `Note: PDF content not captured due to browser security`,
            margin,
            pageHeight - 10
          )

          doc.save(`${file.name || 'annotated-document'}.pdf`)
          URL.revokeObjectURL(img.src)
        }
      }
    }, 'image/png')
  }

  // Initialize signature canvas when modal opens
  useEffect(() => {
    if (showSignatureModal) {
      const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = canvas.offsetWidth
          canvas.height = canvas.offsetHeight
          ctx.strokeStyle = selectedColor
          ctx.lineWidth = strokeWidth
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          let isDrawing = false
          let lastX = 0
          let lastY = 0

          const startDrawing = (e: MouseEvent) => {
            isDrawing = true
            const rect = canvas.getBoundingClientRect()
            lastX = e.clientX - rect.left
            lastY = e.clientY - rect.top
          }

          const draw = (e: MouseEvent) => {
            if (!isDrawing) return
            const rect = canvas.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top

            ctx.beginPath()
            ctx.moveTo(lastX, lastY)
            ctx.lineTo(x, y)
            ctx.stroke()

            lastX = x
            lastY = y
          }

          const stopDrawing = () => {
            isDrawing = false
          }

          canvas.addEventListener('mousedown', startDrawing)
          canvas.addEventListener('mousemove', draw)
          canvas.addEventListener('mouseup', stopDrawing)
          canvas.addEventListener('mouseout', stopDrawing)

          return () => {
            canvas.removeEventListener('mousedown', startDrawing)
            canvas.removeEventListener('mousemove', draw)
            canvas.removeEventListener('mouseup', stopDrawing)
            canvas.removeEventListener('mouseout', stopDrawing)
          }
        }
      }
    }
  }, [showSignatureModal, selectedColor, strokeWidth])

  // Handle clicking outside download menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.download-menu')) {
        setShowDownloadMenu(false)
      }
    }

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDownloadMenu])

  // Add debug useEffect to track state changes
  useEffect(() => {
    if (isDevMode) {
      console.log('🔍 DEBUG - State changed:', {
        currentTool,
        isDrawing,
        drawingPoints: drawingPoints.length,
        canvasContext: !!canvasContext,
        canvasRef: !!canvasRef.current,
      })
    }
  }, [currentTool, isDrawing, drawingPoints, canvasContext, canvasRef])

  // Add test function to verify canvas drawing
  const testCanvasDrawing = () => {
    if (!canvasRef.current) {
      if (isDevMode) {
        console.log('❌ Test failed: No canvas ref')
      }
      return
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) {
      if (isDevMode) {
        console.log('❌ Test failed: No canvas context')
      }
      return
    }

    if (isDevMode) {
      console.log('✅ Testing canvas drawing...')
    }

    // Test drawing a red rectangle
    ctx.fillStyle = 'red'
    ctx.fillRect(50, 50, 100, 100)

    // Test drawing a blue circle
    ctx.strokeStyle = 'blue'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(200, 200, 50, 0, 2 * Math.PI)
    ctx.stroke()

    // Test drawing a green circle at mouse position if available
    if (mousePosition) {
      ctx.strokeStyle = 'green'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(mousePosition.x, mousePosition.y, 30, 0, 2 * Math.PI)
      ctx.stroke()
      if (isDevMode) {
        console.log('✅ Test circle drawn at mouse position:', mousePosition)
      }
    }

    if (isDevMode) {
      console.log('✅ Test drawing completed')
    }

    // Also test with the scaled context
    if (canvasContext) {
      if (isDevMode) {
        console.log('🧪 Testing with scaled context...')
      }
      canvasContext.fillStyle = 'purple'
      canvasContext.fillRect(150, 150, 80, 80)
      if (isDevMode) {
        console.log('✅ Drew purple rectangle with scaled context')
      }
    }
  }

  // Add function to debug canvas and PDF alignment
  const debugAlignment = () => {
    if (!canvasRef.current || !containerRef.current) {
      if (isDevMode) {
        console.log('❌ Debug failed: Missing refs')
      }
      return
    }

    const canvas = canvasRef.current
    const container = containerRef.current
    const iframe = container.querySelector('iframe') as HTMLIFrameElement

    if (isDevMode) {
      console.log('🔍 Alignment Debug Info:')
      console.log('Container:', {
        rect: container.getBoundingClientRect(),
        style: {
          width: container.style.width,
          height: container.style.height,
          position: container.style.position,
        },
      })
      console.log('Canvas:', {
        rect: canvas.getBoundingClientRect(),
        width: canvas.width,
        height: canvas.height,
        style: {
          width: canvas.style.width,
          height: canvas.style.height,
          position: canvas.style.position,
        },
      })
      if (iframe) {
        console.log('Iframe:', {
          rect: iframe.getBoundingClientRect(),
          style: {
            width: iframe.style.width,
            height: iframe.style.height,
            position: iframe.style.position,
          },
        })
      }

      // Test coordinate calculation
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const scale = 2
        const testX = 100
        const testY = 100
        const scaledX = (testX - rect.left) / scale
        const scaledY = (testY - rect.top) / scale
        console.log('🔢 Coordinate test:', {
          original: {x: testX, y: testY},
          rect: {left: rect.left, top: rect.top},
          scaled: {x: scaledX, y: scaledY},
          scale,
        })
      }
    }
  }

  // Add function to force canvas visibility
  const forceCanvasVisibility = () => {
    if (!canvasRef.current) {
      if (isDevMode) {
        console.log('❌ No canvas ref for visibility test')
      }
      return
    }

    const canvas = canvasRef.current

    // Force canvas to be visible
    canvas.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'
    canvas.style.border = '2px solid red'
    canvas.style.zIndex = '999'

    if (isDevMode) {
      console.log('🔴 Forced canvas visibility with red background')
    }

    // Test drawing on the canvas
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'yellow'
      ctx.fillRect(0, 0, 200, 200)
      if (isDevMode) {
        console.log('✅ Drew yellow rectangle on canvas')
      }
    }
  }

  // Ensure canvas is properly initialized
  useEffect(() => {
    if (canvasRef.current && !canvasContext) {
      if (isDevMode) {
        console.log('🔄 Initializing canvas context...')
      }
      const canvas = canvasRef.current

      // Set canvas size to match container
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2 // High DPI
      canvas.height = rect.height * 2 // High DPI

      const ctx = canvas.getContext('2d')
      if (ctx) {
        const scale = 2
        // Reset any previous transformations
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(scale, scale)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        setCanvasContext(ctx)
        if (isDevMode) {
          console.log('✅ Canvas context initialized')
        }

        // Force a render after initialization
        setTimeout(() => {
          renderAnnotations()
        }, 100)
      }
    }
  }, [canvasRef.current, canvasContext])

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasContext) {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2 // High DPI
        canvas.height = rect.height * 2 // High DPI

        // Reinitialize context with new size
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const scale = 2
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.scale(scale, scale)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          setCanvasContext(ctx)
          if (isDevMode) {
            console.log('✅ Canvas resized and context reinitialized')
          }

          // Force a render after resize
          setTimeout(() => {
            renderAnnotations()
          }, 100)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [canvasRef.current, canvasContext])

  return (
    <div className="card p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">PDF Viewer</h3>
            <p className="text-sm text-gray-600">{file.name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsDevMode(!isDevMode)}
            className={`btn btn-sm ${isDevMode ? 'btn-primary' : 'btn-outline'}`}
            title="Toggle debug mode"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {isDevMode ? 'Debug ON' : 'Debug OFF'}
          </button>
          {pdfUrl && annotations.length > 0 && (
            <div className="relative download-menu">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="btn btn-primary btn-md shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download
                <svg
                  className="w-4 h-4 ml-2 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[280px] animate-in">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        capturePDFWithAnnotations()
                        setShowDownloadMenu(false)
                      }}
                      className="flex items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          Download PDF with Annotations
                        </div>
                        <div className="text-xs text-gray-500">
                          Complete document with all annotations
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        downloadWithAnnotations()
                        setShowDownloadMenu(false)
                      }}
                      className="flex items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Download Annotations (PNG)</div>
                        <div className="text-xs text-gray-500">
                          Image file with annotations only
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        downloadAnnotationsJSON()
                        setShowDownloadMenu(false)
                      }}
                      className="flex items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <svg
                          className="w-4 h-4 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Export Annotations (JSON)</div>
                        <div className="text-xs text-gray-500">Raw annotation data</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        testDownload()
                        setShowDownloadMenu(false)
                      }}
                      className="flex items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                        <svg
                          className="w-4 h-4 text-orange-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Test PDF Download</div>
                        <div className="text-xs text-gray-500">Debug download functionality</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {(selectedAnnotations.length > 0 || selectedPolygons.length > 0) && (
            <>
              {selectedPolygons.length >= 2 && (
                <button onClick={mergeSelectedPolygons} className="btn btn-secondary btn-md">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  Merge ({selectedPolygons.length})
                </button>
              )}
              <button
                onClick={deleteSelectedAnnotations}
                className="btn btn-outline btn-md text-red-600 border-red-300 hover:bg-red-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete ({selectedAnnotations.length + selectedPolygons.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div
        ref={containerRef}
        className="relative border border-gray-200 rounded-lg bg-gray-50 flex-1 overflow-hidden"
        style={{
          height: '1036px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: '1036px',
          maxHeight: '1036px',
        }}
      >
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=FitH&pagemode=none&scrollbar=0&toolbar=0&navpanes=0&statusbar=0&messages=0`}
            className="w-full h-full"
            title="PDF Viewer"
            style={{
              pointerEvents: 'none',
              border: 'none',
              overflow: 'hidden',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 1,
            }}
            onLoad={() => {
              // Additional attempt to hide toolbar elements
              setTimeout(() => {
                const iframe = document.querySelector('iframe') as HTMLIFrameElement
                if (iframe && iframe.contentDocument) {
                  try {
                    const style = iframe.contentDocument.createElement('style')
                    style.textContent = `
                      #toolbarViewerLeft, #toolbarViewerRight, #toolbarContainer, 
                      #secondaryToolbar, #toolbar, .toolbar, .toolbarButton {
                        display: none !important;
                      }
                      #viewerContainer {
                        top: 0 !important;
                        height: 100% !important;
                        overflow: hidden !important;
                      }
                      #viewer {
                        height: 100% !important;
                        overflow: hidden !important;
                      }
                      #viewerContainer > div {
                        overflow: hidden !important;
                      }
                    `
                    iframe.contentDocument.head.appendChild(style)
                  } catch (e) {
                    // Cross-origin restrictions
                  }
                }
              }, 1000)
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No PDF loaded</p>
              <p className="text-sm text-gray-400 mt-1">Upload a PDF file to get started</p>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{
            pointerEvents: 'auto',
            zIndex: 20,
            overflow: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
            cursor:
              isDrawing || currentTool === 'polygon'
                ? 'crosshair'
                : currentTool !== 'none'
                ? 'pointer'
                : 'default',
            display: 'block',
            visibility: 'visible',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={() => {
            if (isDevMode) {
              console.log('🎯 CANVAS CLICKED!')
            }
          }}
        />

        {/* Debug overlays - only show in dev mode */}
        {isDevMode && (
          <>
            {mousePosition && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-30">
                Mouse: {Math.round(mousePosition.x)}, {Math.round(mousePosition.y)}
              </div>
            )}
            <div className="absolute top-12 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs z-30">
              Drawing: {isDrawing ? 'YES' : 'NO'}
            </div>
            <div className="absolute top-24 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs z-30">
              Tool: {currentTool}
            </div>
            <div className="absolute top-36 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs z-30">
              Points: {drawingPoints.length}
            </div>
            <div className="absolute top-48 left-2 bg-orange-500 text-white px-2 py-1 rounded text-xs z-30">
              Canvas: {canvasContext ? 'OK' : 'NULL'}
            </div>
            <div className="absolute top-60 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-30">
              Canvas Ref: {canvasRef.current ? 'OK' : 'NULL'}
            </div>
            <div className="absolute top-72 left-2 bg-pink-500 text-white px-2 py-1 rounded text-xs z-30">
              Container: {containerRef.current ? 'OK' : 'NULL'}
            </div>
            <div className="absolute top-84 left-2 bg-indigo-500 text-white px-2 py-1 rounded text-xs z-30">
              Container Height:{' '}
              {containerRef.current ? containerRef.current.offsetHeight + 'px' : 'N/A'}
            </div>
            <div className="absolute top-96 left-2 bg-teal-500 text-white px-2 py-1 rounded text-xs z-30">
              Canvas Size:{' '}
              {canvasRef.current ? canvasRef.current.width + 'x' + canvasRef.current.height : 'N/A'}
            </div>

            {/* Test buttons */}
            <button
              onClick={testCanvasDrawing}
              className="absolute top-108 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs z-30 hover:bg-yellow-400"
            >
              Test Canvas
            </button>
            <button
              onClick={debugAlignment}
              className="absolute top-120 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-30 hover:bg-green-400"
            >
              Debug Alignment
            </button>
            <button
              onClick={forceCanvasVisibility}
              className="absolute top-132 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs z-30 hover:bg-purple-400"
            >
              Force Canvas Visibility
            </button>
          </>
        )}
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}
        >
          <div className="card p-6 max-w-lg w-full mx-4 animate-in bg-white shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Signature</h3>
            <div className="mb-4">
              <canvas
                id="signatureCanvas"
                className="border border-gray-300 rounded-lg w-full h-32 bg-white"
                style={{cursor: 'crosshair'}}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement
                  if (canvas) {
                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                      ctx.clearRect(0, 0, canvas.width, canvas.height)
                    }
                  }
                }}
                className="btn btn-outline"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement
                  if (canvas && signaturePosition) {
                    const signatureData = canvas.toDataURL()
                    const annotation: SignatureAnnotation = {
                      id: Date.now().toString(),
                      type: 'signature',
                      points: [signaturePosition],
                      color: selectedColor,
                      strokeWidth,
                      page: 1,
                      timestamp: Date.now(),
                      signatureData,
                      width: 200,
                      height: 100,
                    }
                    onAnnotationAdd(annotation)
                    setShowSignatureModal(false)
                    setSignaturePosition(null)
                  }
                }}
                className="btn btn-primary"
              >
                Add Signature
              </button>
              <button
                onClick={() => {
                  setShowSignatureModal(false)
                  setSignaturePosition(null)
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Status */}
      {isDrawing && drawingPoints.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <span className="font-medium">
              Drawing {currentTool} with {drawingPoints.length} points
            </span>
            {currentTool === 'circle' && longPressTimer && (
              <span className="text-blue-600">• Hold for perfect circle</span>
            )}
            {currentTool === 'polygon' && (
              <span className="text-blue-600">• Click to add points • Click start to complete</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
