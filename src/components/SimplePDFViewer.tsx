/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useState, useEffect, useRef } from 'react'
import { AnnotationType, Annotation, Point, CircleAnnotation } from '@/types/annotation'
import jsPDF from 'jspdf'

// Generate unique IDs for annotations
const generateUniqueId = () => {
  return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

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
}: SimplePDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([])

  const [mousePosition, setMousePosition] = useState<Point | null>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false)
  const [isDevMode, setIsDevMode] = useState<boolean>(false)

  // Undo/Redo state management
  const [history, setHistory] = useState<Annotation[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // Mouse event handlers
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePosition({ x, y })

    // Update drawing points for line, rectangle, and circle tools during mouse movement
    if (isDrawing && drawingPoints.length > 0) {
      if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        setDrawingPoints([drawingPoints[0], { x, y }])
      } else if (currentTool === 'polygon' || currentTool === 'curve') {
        requestAnimationFrame(() => renderAnnotations())
      }
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Handle polygon differently - continuous clicking to add points
    if (currentTool === 'polygon') {
      if (!isDrawing) {
        // Start new polygon
        setIsDrawing(true)
        setDrawingPoints([{ x, y }])
        setMousePosition({ x, y })
      } else {
        // Check if clicking near the starting point to close polygon
        const startPoint = drawingPoints[0]
        const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2))
        if (distance <= 10 && drawingPoints.length >= 3) {
          // Close polygon if clicked near start point and has at least 3 points
          const annotation: Annotation = {
            id: generateUniqueId(),
            type: 'polygon',
            points: drawingPoints,
            color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
            strokeWidth,
            page: 1,
            timestamp: Date.now(),
          }
          onAnnotationAdd(annotation)
          const newAnnotations = [...annotations, annotation]
          saveToHistory(newAnnotations)
          setIsDrawing(false)
          setDrawingPoints([])
        } else {
          // Add new point to polygon
          setDrawingPoints([...drawingPoints, { x, y }])
        }
      }
      return
    }

    // Handle curve similarly to polygon - continuous clicking to add curve points
    if (currentTool === 'curve') {
      if (!isDrawing) {
        // Start new curve
        setIsDrawing(true)
        setDrawingPoints([{ x, y }])
        setMousePosition({ x, y })
      } else {
        // Check if clicking near the starting point to close curve
        const startPoint = drawingPoints[0]
        const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2))

        if (distance <= 15 && drawingPoints.length >= 3) {
          // Close curve if clicked near start point and has at least 3 points
          const annotation: Annotation = {
            id: generateUniqueId(),
            type: 'curve',
            points: drawingPoints,
            color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
            strokeWidth,
            page: 1,
            timestamp: Date.now(),
          }
          onAnnotationAdd(annotation)
          const newAnnotations = [...annotations, annotation]
          saveToHistory(newAnnotations)
          setIsDrawing(false)
          setDrawingPoints([])
        } else {
          // Add new point to curve
          setDrawingPoints([...drawingPoints, { x, y }])
        }
      }
      return
    }

    // For other tools (line, rectangle, circle), start drawing normally
    setIsDrawing(true)
    setDrawingPoints([{ x, y }])
    setMousePosition({ x, y })
  }

  const handleCanvasMouseUp = () => {
    // Handle completion for line, rectangle, and circle tools
    if (isDrawing && drawingPoints.length >= 2) {
      if (currentTool === 'line') {
        const annotation: Annotation = {
          id: generateUniqueId(),
          type: 'line',
          points: [drawingPoints[0], drawingPoints[1]],
          color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
        }
        onAnnotationAdd(annotation)
        const newAnnotations = [...annotations, annotation]
        saveToHistory(newAnnotations)
        setIsDrawing(false)
        setDrawingPoints([])
      } else if (currentTool === 'rectangle') {
        const annotation: Annotation = {
          id: generateUniqueId(),
          type: 'rectangle',
          points: [drawingPoints[0], drawingPoints[1]],
          color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
        }
        onAnnotationAdd(annotation)
        const newAnnotations = [...annotations, annotation]
        saveToHistory(newAnnotations)
        setIsDrawing(false)
        setDrawingPoints([])
      } else if (currentTool === 'circle') {
        const center = drawingPoints[0]
        const radius = Math.sqrt(
          Math.pow(drawingPoints[1].x - center.x, 2) + Math.pow(drawingPoints[1].y - center.y, 2)
        )
        const annotation: CircleAnnotation = {
          id: generateUniqueId(),
          type: 'circle',
          points: [center],
          color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
          strokeWidth,
          page: 1,
          timestamp: Date.now(),
          radius,
        }
        onAnnotationAdd(annotation)
        const newAnnotations = [...annotations, annotation]
        saveToHistory(newAnnotations)
        setIsDrawing(false)
        setDrawingPoints([])
      }
    }
  }

  // Undo/Redo functions - defined early to avoid initialization issues
  const saveToHistory = (newAnnotations: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push([...newAnnotations])
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onAnnotationsReplace(history[newIndex])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onAnnotationsReplace(history[newIndex])
    }
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

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
              } catch {
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
    if (!canvasRef.current) {
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
      }
    }

    if (!ctx) {
      return
    }

    // At this point ctx is guaranteed to be non-null
    const context = ctx!

    // Clear canvas with proper dimensions
    const canvas = canvasRef.current
    const scale = 2
    context.clearRect(0, 0, canvas.width / scale, canvas.height / scale)

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

            // Fill the polygon with a semi-transparent version of the color
            const originalAlpha = context.globalAlpha
            context.globalAlpha = 0.3
            context.fill()
            context.globalAlpha = originalAlpha

            // Draw the outline
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

        case 'curve':
          if (annotation.points.length >= 2) {
            context.beginPath()
            context.moveTo(annotation.points[0].x, annotation.points[0].y)

            if (annotation.points.length === 2) {
              // Simple line for two points
              context.lineTo(annotation.points[1].x, annotation.points[1].y)
            } else if (annotation.points.length === 3) {
              // Quadratic curve for three points
              context.quadraticCurveTo(
                annotation.points[1].x,
                annotation.points[1].y,
                annotation.points[2].x,
                annotation.points[2].y
              )
            } else {
              // Smooth curve through multiple points using quadratic curves
              for (let i = 1; i < annotation.points.length - 1; i++) {
                const currentPoint = annotation.points[i]
                const nextPoint = annotation.points[i + 1]
                const midX = (currentPoint.x + nextPoint.x) / 2
                const midY = (currentPoint.y + nextPoint.y) / 2
                context.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY)
              }
              // Connect to the last point
              const lastPoint = annotation.points[annotation.points.length - 1]
              context.lineTo(lastPoint.x, lastPoint.y)
            }
            context.stroke()
          }
          break
      }
    })

    // Draw current drawing
    if (isDrawing && drawingPoints.length > 1) {
      context.strokeStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      context.fillStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
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

        case 'circle':
          if (drawingPoints.length >= 2) {
            const centerX = drawingPoints[0].x
            const centerY = drawingPoints[0].y
            const radius = Math.sqrt(
              Math.pow(drawingPoints[1].x - centerX, 2) + Math.pow(drawingPoints[1].y - centerY, 2)
            )

            context.beginPath()
            context.arc(centerX, centerY, radius, 0, 2 * Math.PI)
            context.stroke()
          }
          break
      }
    }

    // Render polygon and curve with special logic
    if (isDrawing && currentTool === 'polygon' && drawingPoints.length >= 1) {
      // Always show the first point as a visible dot
      context.beginPath()
      context.arc(drawingPoints[0].x, drawingPoints[0].y, 3, 0, 2 * Math.PI)
      context.fill()

      // Draw polygon outline if we have points
      if (drawingPoints.length >= 1) {
        context.beginPath()
        context.moveTo(drawingPoints[0].x, drawingPoints[0].y)

        // Draw all completed segments
        for (let i = 1; i < drawingPoints.length; i++) {
          context.lineTo(drawingPoints[i].x, drawingPoints[i].y)
        }

        // Show preview line to mouse position when drawing
        if (
          mousePosition &&
          !(mousePosition.x === drawingPoints[0].x && mousePosition.y === drawingPoints[0].y)
        ) {
          context.lineTo(mousePosition.x, mousePosition.y)

          // Show fill preview when we have enough points
          if (drawingPoints.length >= 1) {
            // Save current path for fill
            context.save()
            context.closePath()
            const originalAlpha = context.globalAlpha
            context.globalAlpha = 0.3
            context.fill()
            context.globalAlpha = originalAlpha
            context.restore()

            // Restart path for stroke
            context.beginPath()
            context.moveTo(drawingPoints[0].x, drawingPoints[0].y)
            for (let i = 1; i < drawingPoints.length; i++) {
              context.lineTo(drawingPoints[i].x, drawingPoints[i].y)
            }
            context.lineTo(mousePosition.x, mousePosition.y)
          }
        }
        context.stroke()
      }
    }

    if (isDrawing && currentTool === 'curve' && drawingPoints.length >= 1) {
      // Always show the first point as a visible dot
      context.beginPath()
      context.arc(drawingPoints[0].x, drawingPoints[0].y, 3, 0, 2 * Math.PI)
      context.fill()

      // Draw curve
      context.beginPath()
      context.moveTo(drawingPoints[0].x, drawingPoints[0].y)

      if (drawingPoints.length === 1) {
        // Just the starting point, show preview line to mouse
        if (
          mousePosition &&
          !(mousePosition.x === drawingPoints[0].x && mousePosition.y === drawingPoints[0].y)
        ) {
          context.lineTo(mousePosition.x, mousePosition.y)
        }
      } else if (drawingPoints.length === 2) {
        // Simple line for two points
        context.lineTo(drawingPoints[1].x, drawingPoints[1].y)
        // Show preview to mouse position
        if (mousePosition) {
          context.lineTo(mousePosition.x, mousePosition.y)
        }
      } else if (drawingPoints.length === 3) {
        // Quadratic curve for three points
        context.quadraticCurveTo(
          drawingPoints[1].x,
          drawingPoints[1].y,
          drawingPoints[2].x,
          drawingPoints[2].y
        )
        // Show preview curve to mouse position
        if (mousePosition) {
          const lastPoint = drawingPoints[drawingPoints.length - 1]
          const midX = (lastPoint.x + mousePosition.x) / 2
          const midY = (lastPoint.y + mousePosition.y) / 2
          context.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY)
          context.lineTo(mousePosition.x, mousePosition.y)
        }
      } else {
        // Smooth curve through multiple points using quadratic curves
        for (let i = 1; i < drawingPoints.length - 1; i++) {
          const currentPoint = drawingPoints[i]
          const nextPoint = drawingPoints[i + 1]
          const midX = (currentPoint.x + nextPoint.x) / 2
          const midY = (currentPoint.y + nextPoint.y) / 2
          context.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY)
        }
        // Connect to the last point
        const lastPoint = drawingPoints[drawingPoints.length - 1]
        context.lineTo(lastPoint.x, lastPoint.y)

        // Show preview curve to mouse position
        if (mousePosition) {
          const midX = (lastPoint.x + mousePosition.x) / 2
          const midY = (lastPoint.y + mousePosition.y) / 2
          context.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY)
          context.lineTo(mousePosition.x, mousePosition.y)
        }
      }
      context.stroke()
    }
  }

  // Initialize history with current annotations
  useEffect(() => {
    if (annotations.length > 0 && history.length === 1 && history[0].length === 0) {
      setHistory([annotations])
      setHistoryIndex(0)
    }
  }, [annotations, history])

  useEffect(() => {
    renderAnnotations()
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

  // Handle keyboard events for polygon completion and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

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
  }, [currentTool, isDrawing, drawingPoints, undo, redo])

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
      id: generateUniqueId(),
      type: 'polygon',
      points: allPoints,
      color: selectedColor || '#000000',
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
    saveToHistory(newAnnotations)
    setSelectedAnnotations([])
    setSelectedPolygons([])
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
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'annotations.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Function to capture PDF iframe and combine with annotations
  const capturePDFWithAnnotations = async () => {
    if (!pdfUrl || !canvasRef.current) {
      if (isDevMode) {
        console.error('Missing required data for PDF capture')
      }
      return
    }

    try {
      // Create a temporary canvas to combine PDF and annotations
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        createFallbackPDF()
        return
      }

      // Set canvas size to match the original
      tempCanvas.width = canvasRef.current.width
      tempCanvas.height = canvasRef.current.height

      // Create white background for the final output
      tempCtx.fillStyle = '#ffffff'
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

      let pdfRendered = false
      let downloadTriggered = false

      // Try to render PDF directly using PDF.js
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

        // Load the PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise

        // Get the first page
        const page = await pdf.getPage(1)

        // Calculate viewport to fit the canvas
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(
          tempCanvas.width / viewport.width,
          tempCanvas.height / viewport.height
        )
        const scaledViewport = page.getViewport({ scale })

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

        await page.render(renderContext).promise

        // Calculate centering offset
        const offsetX = (tempCanvas.width - pdfCanvas.width) / 2
        const offsetY = (tempCanvas.height - pdfCanvas.height) / 2

        // Draw the PDF content centered on the temp canvas
        tempCtx.drawImage(pdfCanvas, offsetX, offsetY)

        pdfRendered = true
      } catch (pdfError) {
        if (isDevMode) {
          console.error('PDF.js rendering failed:', pdfError)
        }

        // Fallback: Try to capture the current iframe content
        const currentIframe = document.querySelector('iframe') as HTMLIFrameElement
        if (currentIframe) {
          try {
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
        // Now draw annotations with transparency on top
        if (tempCtx && canvasRef.current) {
          tempCtx.globalAlpha = 0.8
          tempCtx.drawImage(canvasRef.current, 0, 0)
          tempCtx.globalAlpha = 1.0
        }
      } else {
        // Draw annotations with transparency on top of the rendered PDF
        if (tempCtx && canvasRef.current) {
          tempCtx.globalAlpha = 0.8
          tempCtx.drawImage(canvasRef.current, 0, 0)
          tempCtx.globalAlpha = 1.0
        }
      }

      // Convert canvas to PNG image (regardless of whether PDF was rendered or not)

      tempCanvas.toBlob(
        blob => {
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

              // Add the image with PDF content and annotations

              doc.addImage(img, 'PNG', imgX, imgY, newWidth, newHeight)

              // Add metadata
              doc.setFontSize(10)
              doc.text(`Annotations: ${annotations.length}`, margin, pageHeight - 25)
              doc.text(`File: ${file.name}`, margin, pageHeight - 20)
              doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, pageHeight - 15)

              doc.save(`${file.name || 'annotated-document'}.pdf`)
              downloadTriggered = true

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

  // Deselect all annotations when a drawing tool becomes active
  useEffect(() => {
    if (currentTool !== 'none') {
      if (selectedAnnotations.length > 0 || selectedPolygons.length > 0) {
        setSelectedAnnotations([])
        setSelectedPolygons([])
      }
    }
  }, [
    currentTool,
    selectedAnnotations.length,
    selectedPolygons.length,
    isDevMode,
    setSelectedAnnotations,
    setSelectedPolygons,
  ])

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
    <div className="card p-6 h-full flex flex-col overflow-visible">
      <div className="flex justify-between items-center mb-6 relative">
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
          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-outline btn-sm"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="btn btn-outline btn-sm"
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
              />
            </svg>
          </button>

          {pdfUrl && annotations.length > 0 && (
            <div className="relative download-menu z-[9999]">
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
                <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] min-w-[280px] animate-in">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        capturePDFWithAnnotations()
                        setShowDownloadMenu(false)
                      }}
                      className="flex cursor-pointer items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
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
                      className="flex cursor-pointer items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
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
                      className="flex cursor-pointer items-center w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-md transition-colors"
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
                  } catch {
                    // Silently handle cross-origin restrictions
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
        />
      </div>

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

            {currentTool === 'polygon' && (
              <span className="text-blue-600">• Click to add points • Click start to complete</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
