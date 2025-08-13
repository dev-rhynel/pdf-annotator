'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { AnnotationType, Annotation, Point, CircleAnnotation } from '@/types/annotation'

const generateUniqueId = () => {
  return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

interface EnhancedPDFViewerProps {
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

export default function EnhancedPDFViewer({
  file,
  currentTool,
  annotations,
  onAnnotationAdd,
  onAnnotationsReplace,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canvasRef,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedAnnotations,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedPolygons,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSelectedAnnotations,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSelectedPolygons,
  selectedColor,
  strokeWidth,
}: EnhancedPDFViewerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [totalPages, setTotalPages] = useState<number>(0)
  const [currentPage] = useState<number>(1)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([])
  const [isPencilDrawing, setIsPencilDrawing] = useState<boolean>(false)
  const [currentPencilPath, setCurrentPencilPath] = useState<Point[]>([])
  const [mousePosition, setMousePosition] = useState<Point | null>(null)

  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const renderAnnotationsRef = useRef<(() => void) | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null)

  // Undo/Redo state
  const [history, setHistory] = useState<Annotation[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState<number>(0)

  // Initialize PDF.js
  useEffect(() => {
    const initPDF = async () => {
      try {
        setIsLoading(true)
        setError('')

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

        if (file) {
          const url = URL.createObjectURL(file)
          setPdfUrl(url)

          const loadingTask = pdfjsLib.getDocument(url)
          const pdf = await loadingTask.promise
          setPdfDocument(pdf)
          setTotalPages(pdf.numPages)

          const page = await pdf.getPage(1)
          const viewport = page.getViewport({ scale: 1 })
          setPageDimensions({ width: viewport.width, height: viewport.height })

          setIsLoading(false)
        }
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError('Failed to load PDF file')
        setIsLoading(false)
      }
    }

    initPDF()
  }, [file])

  // Mouse event handlers with coordinate transformation
  const transformCoordinates = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 }

      const rect = containerRef.current.getBoundingClientRect()
      const x = (clientX - rect.left - pan.x) / zoom
      const y = (clientY - rect.top - pan.y) / zoom

      return { x, y }
    },
    [pan, zoom]
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = transformCoordinates(e.clientX, e.clientY)
      setMousePosition({ x, y })

      if (isPencilDrawing && currentTool === 'pencil') {
        setCurrentPencilPath(prev => {
          if (prev.length === 0) return [{ x, y }]

          const lastPoint = prev[prev.length - 1]
          const distance = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2))

          if (distance > 2) {
            return [...prev, { x, y }]
          }
          return prev
        })
        requestAnimationFrame(() => renderAnnotationsRef.current?.())
      }

      if (isDrawing && drawingPoints.length > 0) {
        if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
          setDrawingPoints([drawingPoints[0], { x, y }])
        } else if (currentTool === 'triangle') {
          requestAnimationFrame(() => renderAnnotationsRef.current?.())
        } else if (currentTool === 'polygon' || currentTool === 'curve') {
          requestAnimationFrame(() => renderAnnotationsRef.current?.())
        }
      }
    },
    [transformCoordinates, isPencilDrawing, currentTool, isDrawing, drawingPoints]
  )

  // Undo/Redo functions - defined early to avoid initialization issues
  const saveToHistory = useCallback(
    (newAnnotations: Annotation[]) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push([...newAnnotations])
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    },
    [history, historyIndex]
  )

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = transformCoordinates(e.clientX, e.clientY)

      if (currentTool === 'pencil') {
        setIsPencilDrawing(true)
        setCurrentPencilPath([{ x, y }])
        return
      }

      if (currentTool === 'triangle') {
        if (!isDrawing) {
          setIsDrawing(true)
          setDrawingPoints([{ x, y }])
          setMousePosition({ x, y })
        } else if (drawingPoints.length === 1) {
          setDrawingPoints([drawingPoints[0], { x, y }])
        } else if (drawingPoints.length === 2) {
          const annotation: Annotation = {
            id: generateUniqueId(),
            type: 'triangle',
            points: [drawingPoints[0], drawingPoints[1], { x, y }],
            color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
            strokeWidth,
            page: currentPage,
            timestamp: Date.now(),
          }
          onAnnotationAdd(annotation)
          const newAnnotations = [...annotations, annotation]
          saveToHistory(newAnnotations)
          setIsDrawing(false)
          setDrawingPoints([])
        }
        return
      }

      if (currentTool === 'polygon') {
        if (!isDrawing) {
          setIsDrawing(true)
          setDrawingPoints([{ x, y }])
          setMousePosition({ x, y })
        } else {
          const startPoint = drawingPoints[0]
          const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2))
          if (distance <= 10 && drawingPoints.length >= 3) {
            const annotation: Annotation = {
              id: generateUniqueId(),
              type: 'polygon',
              points: drawingPoints,
              color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
              strokeWidth,
              page: currentPage,
              timestamp: Date.now(),
            }
            onAnnotationAdd(annotation)
            const newAnnotations = [...annotations, annotation]
            saveToHistory(newAnnotations)
            setIsDrawing(false)
            setDrawingPoints([])
          } else {
            setDrawingPoints([...drawingPoints, { x, y }])
          }
        }
        return
      }

      if (currentTool === 'curve') {
        if (!isDrawing) {
          setIsDrawing(true)
          setDrawingPoints([{ x, y }])
          setMousePosition({ x, y })
        } else {
          const startPoint = drawingPoints[0]
          const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2))

          if (distance <= 15 && drawingPoints.length >= 3) {
            const annotation: Annotation = {
              id: generateUniqueId(),
              type: 'curve',
              points: drawingPoints,
              color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
              strokeWidth,
              page: currentPage,
              timestamp: Date.now(),
            }
            onAnnotationAdd(annotation)
            const newAnnotations = [...annotations, annotation]
            saveToHistory(newAnnotations)
            setIsDrawing(false)
            setDrawingPoints([])
          } else {
            setDrawingPoints([...drawingPoints, { x, y }])
          }
        }
        return
      }

      setIsDrawing(true)
      setDrawingPoints([{ x, y }])
      setMousePosition({ x, y })
    },
    [
      transformCoordinates,
      currentTool,
      isDrawing,
      drawingPoints,
      selectedColor,
      strokeWidth,
      currentPage,
      onAnnotationAdd,
      annotations,
      saveToHistory,
    ]
  )

  const handleCanvasMouseUp = useCallback(() => {
    if (isPencilDrawing && currentTool === 'pencil' && currentPencilPath.length > 1) {
      const annotation: Annotation = {
        id: generateUniqueId(),
        type: 'pencil',
        points: currentPencilPath,
        color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
        strokeWidth,
        page: currentPage,
        timestamp: Date.now(),
      }
      onAnnotationAdd(annotation)
      const newAnnotations = [...annotations, annotation]
      saveToHistory(newAnnotations)
      setIsPencilDrawing(false)
      setCurrentPencilPath([])
      return
    }

    if (isDrawing && drawingPoints.length >= 2) {
      if (currentTool === 'triangle') return

      if (currentTool === 'line') {
        const annotation: Annotation = {
          id: generateUniqueId(),
          type: 'line',
          points: [drawingPoints[0], drawingPoints[1]],
          color: selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000',
          strokeWidth,
          page: currentPage,
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
          page: currentPage,
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
          page: currentPage,
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
  }, [
    isPencilDrawing,
    currentTool,
    currentPencilPath,
    selectedColor,
    strokeWidth,
    currentPage,
    onAnnotationAdd,
    annotations,
    isDrawing,
    drawingPoints,
    saveToHistory,
  ])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onAnnotationsReplace(history[newIndex])
    }
  }, [historyIndex, history, onAnnotationsReplace])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onAnnotationsReplace(history[newIndex])
    }
  }, [historyIndex, history, onAnnotationsReplace])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Render annotations
  const renderAnnotations = useCallback(() => {
    if (!annotationCanvasRef.current) return

    const canvas = annotationCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    annotations.forEach(annotation => {
      if (annotation.page !== currentPage) return

      ctx.strokeStyle = annotation.color
      ctx.fillStyle = annotation.color
      ctx.lineWidth = annotation.strokeWidth / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      switch (annotation.type) {
        case 'line':
          if (annotation.points.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
            ctx.lineTo(annotation.points[1].x, annotation.points[1].y)
            ctx.stroke()
          }
          break

        case 'rectangle':
          if (annotation.points.length >= 2) {
            const x = Math.min(annotation.points[0].x, annotation.points[1].x)
            const y = Math.min(annotation.points[0].y, annotation.points[1].y)
            const width = Math.abs(annotation.points[1].x - annotation.points[0].x)
            const height = Math.abs(annotation.points[1].y - annotation.points[0].y)
            ctx.strokeRect(x, y, width, height)
          }
          break

        case 'triangle':
          if (annotation.points.length >= 3) {
            ctx.beginPath()
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
            ctx.lineTo(annotation.points[1].x, annotation.points[1].y)
            ctx.lineTo(annotation.points[2].x, annotation.points[2].y)
            ctx.closePath()

            const originalAlpha = ctx.globalAlpha
            ctx.globalAlpha = 0.3
            ctx.fill()
            ctx.globalAlpha = originalAlpha
            ctx.stroke()
          }
          break

        case 'polygon':
          if (annotation.points.length >= 3) {
            ctx.beginPath()
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
            for (let i = 1; i < annotation.points.length; i++) {
              ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
            }
            ctx.closePath()

            const originalAlpha = ctx.globalAlpha
            ctx.globalAlpha = 0.3
            ctx.fill()
            ctx.globalAlpha = originalAlpha
            ctx.stroke()
          }
          break

        case 'circle':
          if (annotation.points.length >= 1) {
            const centerX = annotation.points[0].x
            const centerY = annotation.points[0].y
            const radius = (annotation as CircleAnnotation).radius || 20
            ctx.beginPath()
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
            ctx.stroke()
          }
          break

        case 'curve':
          if (annotation.points.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y)

            if (annotation.points.length === 2) {
              ctx.lineTo(annotation.points[1].x, annotation.points[1].y)
            } else if (annotation.points.length === 3) {
              ctx.quadraticCurveTo(
                annotation.points[1].x,
                annotation.points[1].y,
                annotation.points[2].x,
                annotation.points[2].y
              )
            } else {
              for (let i = 1; i < annotation.points.length - 1; i++) {
                const currentPoint = annotation.points[i]
                const nextPoint = annotation.points[i + 1]
                const midX = (currentPoint.x + nextPoint.x) / 2
                const midY = (currentPoint.y + nextPoint.y) / 2
                ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY)
              }
              const lastPoint = annotation.points[annotation.points.length - 1]
              ctx.lineTo(lastPoint.x, lastPoint.y)
            }
            ctx.stroke()
          }
          break

        case 'pencil':
          if (annotation.points.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y)

            if (annotation.points.length === 2) {
              ctx.lineTo(annotation.points[1].x, annotation.points[1].y)
            } else {
              for (let i = 1; i < annotation.points.length - 1; i++) {
                const currentPoint = annotation.points[i]
                const nextPoint = annotation.points[i + 1]
                const midX = (currentPoint.x + nextPoint.x) / 2
                const midY = (currentPoint.y + nextPoint.y) / 2
                ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY)
              }
              const lastPoint = annotation.points[annotation.points.length - 1]
              ctx.lineTo(lastPoint.x, lastPoint.y)
            }
            ctx.stroke()
          }
          break
      }
    })

    // Draw current drawing
    if (isDrawing && drawingPoints.length > 1) {
      ctx.strokeStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.fillStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.lineWidth = strokeWidth / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      switch (currentTool) {
        case 'line':
          ctx.beginPath()
          ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)
          ctx.lineTo(drawingPoints[1].x, drawingPoints[1].y)
          ctx.stroke()
          break

        case 'rectangle':
          const x = Math.min(drawingPoints[0].x, drawingPoints[1].x)
          const y = Math.min(drawingPoints[0].y, drawingPoints[1].y)
          const width = Math.abs(drawingPoints[1].x - drawingPoints[0].x)
          const height = Math.abs(drawingPoints[1].y - drawingPoints[0].y)
          ctx.strokeRect(x, y, width, height)
          break

        case 'circle':
          if (drawingPoints.length >= 2) {
            const centerX = drawingPoints[0].x
            const centerY = drawingPoints[0].y
            const radius = Math.sqrt(
              Math.pow(drawingPoints[1].x - centerX, 2) + Math.pow(drawingPoints[1].y - centerY, 2)
            )
            ctx.beginPath()
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
            ctx.stroke()
          }
          break
      }
    }

    // Draw current pencil path
    if (isPencilDrawing && currentTool === 'pencil' && currentPencilPath.length > 1) {
      ctx.strokeStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.lineWidth = strokeWidth / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(currentPencilPath[0].x, currentPencilPath[0].y)

      if (currentPencilPath.length === 2) {
        ctx.lineTo(currentPencilPath[1].x, currentPencilPath[1].y)
      } else {
        for (let i = 1; i < currentPencilPath.length - 1; i++) {
          const currentPoint = currentPencilPath[i]
          const nextPoint = currentPencilPath[i + 1]
          const midX = (currentPoint.x + nextPoint.x) / 2
          const midY = (currentPoint.y + nextPoint.y) / 2
          ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY)
        }
        const lastPoint = currentPencilPath[currentPencilPath.length - 1]
        ctx.lineTo(lastPoint.x, lastPoint.y)
      }
      ctx.stroke()
    }

    // Draw triangle preview
    if (isDrawing && currentTool === 'triangle' && drawingPoints.length >= 1) {
      ctx.strokeStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.fillStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.lineWidth = strokeWidth / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      drawingPoints.forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4 / zoom, 0, 2 * Math.PI)
        ctx.fill()
      })

      if (drawingPoints.length === 1 && mousePosition) {
        ctx.beginPath()
        ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)
        ctx.lineTo(mousePosition.x, mousePosition.y)
        ctx.stroke()
      } else if (drawingPoints.length === 2) {
        ctx.beginPath()
        ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)
        ctx.lineTo(drawingPoints[1].x, drawingPoints[1].y)

        if (mousePosition) {
          ctx.lineTo(mousePosition.x, mousePosition.y)
          ctx.closePath()

          const originalAlpha = ctx.globalAlpha
          ctx.globalAlpha = 0.3
          ctx.fill()
          ctx.globalAlpha = originalAlpha
          ctx.stroke()
        } else {
          ctx.stroke()
        }
      }
    }

    // Draw polygon and curve previews
    if (
      isDrawing &&
      (currentTool === 'polygon' || currentTool === 'curve') &&
      drawingPoints.length >= 1
    ) {
      ctx.strokeStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.fillStyle = selectedColor && selectedColor.trim() !== '' ? selectedColor : '#000000'
      ctx.lineWidth = strokeWidth / zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.arc(drawingPoints[0].x, drawingPoints[0].y, 3 / zoom, 0, 2 * Math.PI)
      ctx.fill()

      if (drawingPoints.length >= 1) {
        ctx.beginPath()
        ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)

        for (let i = 1; i < drawingPoints.length; i++) {
          ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y)
        }

        if (mousePosition) {
          ctx.lineTo(mousePosition.x, mousePosition.y)

          if (drawingPoints.length >= 1) {
            ctx.save()
            ctx.closePath()
            const originalAlpha = ctx.globalAlpha
            ctx.globalAlpha = 0.3
            ctx.fill()
            ctx.globalAlpha = originalAlpha
            ctx.restore()

            ctx.beginPath()
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)
            for (let i = 1; i < drawingPoints.length; i++) {
              ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y)
            }
            ctx.lineTo(mousePosition.x, mousePosition.y)
          }
        }
        ctx.stroke()
      }
    }

    ctx.restore()
  }, [
    annotations,
    currentPage,
    pan,
    zoom,
    isDrawing,
    drawingPoints,
    currentTool,
    selectedColor,
    strokeWidth,
    isPencilDrawing,
    currentPencilPath,
    mousePosition,
  ])

  // Assign renderAnnotations to ref for use in other callbacks
  renderAnnotationsRef.current = renderAnnotations

  // Re-render annotations when needed
  useEffect(() => {
    renderAnnotations()
  }, [renderAnnotations])

  // Initialize history
  useEffect(() => {
    if (annotations.length > 0 && history.length === 1 && history[0].length === 0) {
      setHistory([annotations])
      setHistoryIndex(0)
    }
  }, [annotations, history])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          setIsDrawing(false)
          setDrawingPoints([])
        }
      }

      if (currentTool === 'triangle' && isDrawing && drawingPoints.length > 0) {
        if (e.key === 'Escape') {
          setIsDrawing(false)
          setDrawingPoints([])
        }
      }

      if (currentTool === 'pencil' && isPencilDrawing) {
        if (e.key === 'Escape') {
          setIsPencilDrawing(false)
          setCurrentPencilPath([])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentTool, isDrawing, drawingPoints, isPencilDrawing, undo, redo])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  // Smooth zoom functions
  const smoothZoomTo = useCallback((targetScale: number, duration: number = 300) => {
    if (!transformRef.current || !containerRef.current) return

    // Use the transform library's smooth zoom
    transformRef.current.zoomToElement(containerRef.current, duration, targetScale, 'easeOutCubic')
  }, [])

  const smoothZoomIn = useCallback(() => {
    if (!transformRef.current) return
    transformRef.current.zoomIn(0.5, 200)
  }, [])

  const smoothZoomOut = useCallback(() => {
    if (!transformRef.current) return
    transformRef.current.zoomOut(0.5, 200)
  }, [])

  const smoothResetView = useCallback(() => {
    if (!transformRef.current) return
    transformRef.current.resetTransform(300)
  }, [])

  // Simple high-quality PDF rendering function
  const renderPDF = useCallback(async () => {
    if (!pdfDocument || !pageDimensions.width || !pageDimensions.height) return

    try {
      const page = await pdfDocument.getPage(currentPage)
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement
      if (!canvas) return

      // Create a new canvas context to avoid reuse issues
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      // Set canvas size for high resolution - render at 2x scale for crisp text
      const scale = 2
      const viewport = page.getViewport({ scale })

      // Set canvas dimensions
      canvas.width = viewport.width
      canvas.height = viewport.height

      // Clear canvas completely
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Render PDF at high resolution
      const renderContext = {
        canvasContext: ctx,
        canvas: canvas,
        viewport: viewport,
      }

      await page.render(renderContext).promise
      console.log('✅ PDF rendered at scale:', scale)
    } catch (err) {
      console.error('❌ Error rendering PDF:', err)
    }
  }, [pdfDocument, currentPage, pageDimensions])

  // Render PDF once when document loads
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      renderPDF()
    }, 150) // Increased delay to prevent rapid re-renders
    return () => clearTimeout(timeoutId)
  }, [renderPDF])

  if (isLoading) {
    return (
      <div className="card p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 h-full flex flex-col overflow-visible">
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
            <h3 className="text-lg font-semibold text-gray-900">Enhanced PDF Viewer</h3>
            <p className="text-sm text-gray-600">
              {file.name} - Page {currentPage} of {totalPages}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2 rounded-md transition-colors duration-200 ${
              canUndo
                ? 'hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
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
            className={`p-2 rounded-md transition-colors duration-200 ${
              canRedo
                ? 'hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
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

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1 shadow-sm">
            <button
              onClick={smoothZoomOut}
              className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors duration-200"
              title="Zoom Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={smoothZoomIn}
              className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors duration-200"
              title="Zoom In"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={smoothResetView}
              className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors duration-200"
              title="Reset View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </div>

          {/* Tiling Status Indicator */}
          {/* This section is removed as per the edit hint */}
        </div>
      </div>

      <div className="flex-1 relative border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.1}
          maxScale={10}
          limitToBounds={false}
          doubleClick={{
            mode: 'zoomIn',
            step: 0.5,
          }}
          wheel={{
            step: 0.1,
            disabled: false,
          }}
          pinch={{
            step: 0.1,
            disabled: false,
          }}
        >
          <TransformComponent>
            <div
              ref={containerRef}
              className="relative mx-auto"
              style={{
                width: Math.min(pageDimensions.width, 800),
                height: Math.min(pageDimensions.height, 1000),
                minWidth: pageDimensions.width,
                minHeight: pageDimensions.height,
              }}
            >
              {/* Simple High-Quality PDF Canvas */}
              {pdfDocument && (
                <canvas
                  id="pdf-canvas"
                  width={pageDimensions.width}
                  height={pageDimensions.height}
                  className="absolute top-0 left-0 pointer-events-none w-full h-full object-contain"
                  style={{
                    zIndex: 1,
                  }}
                />
              )}

              {/* Annotations Canvas */}
              <canvas
                ref={annotationCanvasRef}
                width={pageDimensions.width}
                height={pageDimensions.height}
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{
                  pointerEvents: 'auto',
                  cursor:
                    isDrawing ||
                    currentTool === 'polygon' ||
                    currentTool === 'triangle' ||
                    isPencilDrawing
                      ? 'crosshair'
                      : currentTool !== 'none'
                        ? 'pointer'
                        : 'default',
                  zIndex: 20,
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Drawing Status */}
      {((isDrawing && drawingPoints.length > 0) ||
        (isPencilDrawing && currentPencilPath.length > 0)) && (
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
            {isPencilDrawing && currentTool === 'pencil' ? (
              <span className="font-medium">
                Drawing with pencil • {currentPencilPath.length} points • Release mouse to finish
              </span>
            ) : (
              <>
                <span className="font-medium">
                  Drawing {currentTool} with {drawingPoints.length} points
                </span>
                {currentTool === 'polygon' && (
                  <span className="text-blue-600">
                    • Click to add points • Click start to complete
                  </span>
                )}
                {currentTool === 'triangle' && (
                  <span className="text-blue-600">• Click 3 points to create triangle</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tiling Status */}
      {/* This section is removed as per the edit hint */}
    </div>
  )
}
