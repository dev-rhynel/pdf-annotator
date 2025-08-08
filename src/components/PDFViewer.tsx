'use client'

import {useState, useEffect} from 'react'
import dynamic from 'next/dynamic'
import {AnnotationType, Annotation, Point} from '@/types/annotation'
import {configurePDFWorker} from '@/utils/pdf-config'

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), {ssr: false})
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), {ssr: false})

interface PDFViewerProps {
  file: File
  currentTool: AnnotationType
  annotations: Annotation[]
  onAnnotationAdd: (annotation: Annotation) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function PDFViewer({
  file,
  currentTool,
  annotations,
  onAnnotationAdd,
  canvasRef,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([])
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    configurePDFWorker()
  }, [])

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPdfUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      setCanvasContext(ctx)
    }
  }, [canvasRef])

  const renderAnnotations = () => {
    if (!canvasContext || !canvasRef.current) return

    const pageAnnotations = annotations.filter(ann => ann.page === currentPage)

    pageAnnotations.forEach(annotation => {
      canvasContext.strokeStyle = annotation.color
      canvasContext.lineWidth = annotation.strokeWidth
      canvasContext.fillStyle = annotation.color

      switch (annotation.type) {
        case 'line':
          if (annotation.points.length >= 2) {
            canvasContext.beginPath()
            canvasContext.moveTo(annotation.points[0].x, annotation.points[0].y)
            canvasContext.lineTo(annotation.points[1].x, annotation.points[1].y)
            canvasContext.stroke()
          }
          break
        case 'rectangle':
          if (annotation.points.length >= 2) {
            const x = Math.min(annotation.points[0].x, annotation.points[1].x)
            const y = Math.min(annotation.points[0].y, annotation.points[1].y)
            const width = Math.abs(annotation.points[1].x - annotation.points[0].x)
            const height = Math.abs(annotation.points[1].y - annotation.points[0].y)
            canvasContext.strokeRect(x, y, width, height)
          }
          break
        case 'polygon':
          if (annotation.points.length >= 3) {
            canvasContext.beginPath()
            canvasContext.moveTo(annotation.points[0].x, annotation.points[0].y)
            annotation.points.forEach(point => {
              canvasContext.lineTo(point.x, point.y)
            })
            canvasContext.closePath()
            canvasContext.stroke()
          }
          break
        case 'circle':
          if (annotation.points.length >= 1) {
            const radius = 20 // Default radius
            canvasContext.beginPath()
            canvasContext.arc(
              annotation.points[0].x,
              annotation.points[0].y,
              radius,
              0,
              2 * Math.PI
            )
            canvasContext.stroke()
          }
          break
        case 'text':
          if (annotation.points.length >= 1) {
            canvasContext.font = '16px Arial'
            canvasContext.fillText(
              annotation.text || '',
              annotation.points[0].x,
              annotation.points[0].y
            )
          }
          break
      }
    })
  }

  useEffect(() => {
    if (canvasContext && canvasRef.current) {
      // Clear canvas
      canvasContext.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      renderAnnotations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, currentPage, canvasContext])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select') return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setDrawingPoints([{x, y}])
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || currentTool === 'select') return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDrawingPoints(prev => [...prev, {x, y}])
  }

  const handleCanvasMouseUp = () => {
    if (!isDrawing || currentTool === 'select') return

    setIsDrawing(false)

    if (drawingPoints.length < 2) {
      setDrawingPoints([])
      return
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: currentTool,
      points: [...drawingPoints],
      color: '#ff0000',
      strokeWidth: 2,
      page: currentPage,
      timestamp: Date.now(),
    }

    onAnnotationAdd(newAnnotation)
    setDrawingPoints([])
  }

  const onDocumentLoadSuccess = ({numPages}: {numPages: number}) => {
    setNumPages(numPages)
  }

  const changePage = (offset: number) => {
    setCurrentPage(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages))
  }

  const changeScale = (offset: number) => {
    setScale(prevScale => Math.min(Math.max(0.5, prevScale + offset), 3.0))
  }

  if (!isClient) {
    return <div>Loading...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} of {numPages}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={currentPage >= numPages}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeScale(-0.1)}
            className="px-2 py-1 bg-gray-500 text-white rounded"
          >
            -
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => changeScale(0.1)}
            className="px-2 py-1 bg-gray-500 text-white rounded"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative border border-gray-300 rounded">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex justify-center"
        >
          <Page pageNumber={currentPage} scale={scale} className="shadow-lg" />
        </Document>

        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-auto"
          style={{
            width: '100%',
            height: '100%',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        />
      </div>

      {isDrawing && drawingPoints.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Drawing {currentTool} with {drawingPoints.length} points
        </div>
      )}
    </div>
  )
}
