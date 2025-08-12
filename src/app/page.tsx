'use client'

import { useState, useRef, useEffect } from 'react'
import SimplePDFViewer from '@/components/SimplePDFViewer'
import EnhancedPDFViewer from '@/components/EnhancedPDFViewer'
import AnnotationToolbar from '@/components/AnnotationToolbar'
import { PDFErrorBoundary } from '@/components/PDFErrorBoundary'
import { AnnotationType, Annotation } from '@/types/annotation'
import { configurePDFWorker } from '@/utils/pdf-config'

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [currentTool, setCurrentTool] = useState<AnnotationType>('none')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([])
  const [selectedPolygons, setSelectedPolygons] = useState<string[]>([])
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000')
  const [strokeWidth, setStrokeWidth] = useState<number>(2)
  const [useEnhancedViewer, setUseEnhancedViewer] = useState<boolean>(true)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Configure PDF worker on component mount
  useEffect(() => {
    configurePDFWorker()
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
    }
  }

  const handleToolChange = (tool: AnnotationType) => {
    setCurrentTool(tool)
  }

  const handleAnnotationAdd = (annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation])
  }

  const handleAnnotationDelete = (id: string) => {
    setAnnotations(prev => prev.filter(annotation => annotation.id !== id))
  }

  const handleAnnotationsReplace = (newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations)
  }

  const deselectAll = () => {
    setSelectedAnnotations([])
    setSelectedPolygons([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-6 h-6 text-white"
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
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  PDF Annotator
                </h1>
                <p className="text-gray-600 text-sm">
                  Professional PDF annotation tool with zoom & tiling
                </p>
              </div>
            </div>

            {pdfFile && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Viewer:</span>
                <button
                  onClick={() => setUseEnhancedViewer(!useEnhancedViewer)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    useEnhancedViewer
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {useEnhancedViewer ? 'Enhanced' : 'Simple'}
                </button>
              </div>
            )}
          </div>
        </div>

        {!pdfFile ? (
          <div className="card p-12 text-center max-w-md mx-auto">
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Upload a PDF to get started
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Drag and drop your PDF file here, or click to browse. Our tool supports all standard
                PDF formats.
              </p>
            </div>

            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="btn btn-primary btn-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Choose PDF File
            </label>

            <div className="mt-6 text-xs text-gray-500">
              <p>Supported formats: PDF</p>
              <p>Maximum file size: 50MB</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 h-full overflow-hidden">
            {/* Fixed-width PDF Viewer */}
            <div className="w-[800px] h-full flex-shrink-0">
              <PDFErrorBoundary>
                {useEnhancedViewer ? (
                  <EnhancedPDFViewer
                    file={pdfFile}
                    currentTool={currentTool}
                    annotations={annotations}
                    onAnnotationAdd={handleAnnotationAdd}
                    onAnnotationsReplace={handleAnnotationsReplace}
                    canvasRef={canvasRef}
                    selectedAnnotations={selectedAnnotations}
                    selectedPolygons={selectedPolygons}
                    setSelectedAnnotations={setSelectedAnnotations}
                    setSelectedPolygons={setSelectedPolygons}
                    selectedColor={selectedColor}
                    strokeWidth={strokeWidth}
                  />
                ) : (
                  <SimplePDFViewer
                    file={pdfFile}
                    currentTool={currentTool}
                    annotations={annotations}
                    onAnnotationAdd={handleAnnotationAdd}
                    onAnnotationsReplace={handleAnnotationsReplace}
                    canvasRef={canvasRef}
                    selectedAnnotations={selectedAnnotations}
                    selectedPolygons={selectedPolygons}
                    setSelectedAnnotations={setSelectedAnnotations}
                    setSelectedPolygons={setSelectedPolygons}
                    selectedColor={selectedColor}
                    strokeWidth={strokeWidth}
                  />
                )}
              </PDFErrorBoundary>
            </div>

            {/* Responsive Annotation Toolbar */}
            <div className="flex-1 min-w-[320px] max-w-[400px] h-full">
              <AnnotationToolbar
                currentTool={currentTool}
                onToolChange={handleToolChange}
                annotations={annotations}
                onAnnotationDelete={handleAnnotationDelete}
                selectedAnnotations={selectedAnnotations}
                selectedPolygons={selectedPolygons}
                onDeselectAll={deselectAll}
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                strokeWidth={strokeWidth}
                onStrokeWidthChange={setStrokeWidth}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
