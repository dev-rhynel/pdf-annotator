'use client'

import {useState} from 'react'
import {AnnotationType, Annotation} from '@/types/annotation'

interface AnnotationToolbarProps {
  currentTool: AnnotationType
  onToolChange: (tool: AnnotationType) => void
  annotations: Annotation[]
  onAnnotationDelete: (id: string) => void
  selectedAnnotations: string[]
  selectedPolygons: string[]
  onDeselectAll: () => void
  selectedColor: string
  onColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  selectedAnnotation: string | null
  onAnnotationSelect: (id: string | null) => void
}

const tools = [
  {type: 'line' as AnnotationType, name: 'Line', icon: '📏'},
  {type: 'rectangle' as AnnotationType, name: 'Rectangle', icon: '⬜'},
  {type: 'polygon' as AnnotationType, name: 'Polygon', icon: '🔷'},
  {type: 'circle' as AnnotationType, name: 'Circle', icon: '⭕'},
  {type: 'text' as AnnotationType, name: 'Text', icon: '📝'},
  {type: 'signature' as AnnotationType, name: 'Signature', icon: '✍️'},
]

const colors = [
  {value: '#ff0000', name: 'Red'},
  {value: '#00ff00', name: 'Green'},
  {value: '#0000ff', name: 'Blue'},
  {value: '#ffff00', name: 'Yellow'},
  {value: '#ff00ff', name: 'Magenta'},
  {value: '#00ffff', name: 'Cyan'},
  {value: '#000000', name: 'Black'},
]

export default function AnnotationToolbar({
  currentTool,
  onToolChange,
  annotations,
  onAnnotationDelete,
  selectedAnnotations,
  selectedPolygons,
  onDeselectAll,
  selectedColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  selectedAnnotation,
  onAnnotationSelect,
}: AnnotationToolbarProps) {
  const hasSelection = selectedAnnotations.length > 0 || selectedPolygons.length > 0

  const handleToolClick = (tool: AnnotationType) => {
    console.log('Tool clicked:', tool, 'current tool:', currentTool)
    // If clicking the same tool that's already active, deselect it
    if (currentTool === tool) {
      console.log('Deselecting tool:', tool)
      onToolChange('none' as AnnotationType)
    } else {
      console.log('Selecting tool:', tool)
      onToolChange(tool)
    }
  }

  const getToolIcon = (type: AnnotationType) => {
    return tools.find(tool => tool.type === type)?.icon || '❓'
  }

  const getToolName = (type: AnnotationType) => {
    return tools.find(tool => tool.type === type)?.name || 'Unknown'
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="card p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Annotation Tools</h3>
        <p className="text-sm text-gray-600">Select tools and customize your annotations</p>
      </div>

      {/* Tools Section */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Drawing Tools</h4>
        <div className="grid grid-cols-2 gap-2">
          {tools.map(tool => (
            <button
              key={tool.type}
              onClick={() => handleToolClick(tool.type)}
              className={`btn btn-md transition-all duration-200 ${
                currentTool === tool.type
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                  : 'btn-outline hover:bg-gray-50 hover:shadow-md'
              }`}
              title={`Current tool: ${currentTool}, Clicking: ${tool.type}`}
            >
              <span className="text-lg mr-2">{tool.icon}</span>
              {tool.name}
            </button>
          ))}
        </div>

        {hasSelection && (
          <button onClick={onDeselectAll} className="btn btn-secondary btn-sm w-full mt-3">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Deselect All
          </button>
        )}
      </div>

      {/* Color Selection */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Color Palette</h4>
        <div className="grid grid-cols-4 gap-2">
          {colors.map(color => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-12 h-12 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                selectedColor === color.value
                  ? 'border-gray-800 shadow-lg scale-110'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              style={{backgroundColor: color.value}}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Stroke Width</h4>
          <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {strokeWidth}px
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="1"
            max="10"
            value={strokeWidth}
            onChange={e => onStrokeWidthChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1px</span>
            <span>10px</span>
          </div>
        </div>
      </div>

      {/* Annotations List */}
      <div className="mb-6 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Annotations</h4>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
            {annotations.length}
          </span>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-2">
          {annotations.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-5 h-5 text-gray-400"
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
              <p className="text-sm text-gray-500">No annotations yet</p>
              <p className="text-xs text-gray-400 mt-1">Start drawing to see them here</p>
            </div>
          ) : (
            annotations.map((annotation, index) => (
              <div
                key={annotation.id}
                className={`group cursor-pointer transition-all duration-200 rounded-lg p-3 ${
                  selectedAnnotation === annotation.id
                    ? 'bg-blue-100 border-2 border-blue-300 shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() =>
                  onAnnotationSelect(selectedAnnotation === annotation.id ? null : annotation.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
                        selectedAnnotation === annotation.id ? 'bg-blue-200' : 'bg-white'
                      }`}
                    >
                      <span className="text-sm">{getToolIcon(annotation.type)}</span>
                    </div>
                    <div>
                      <div
                        className={`font-medium text-sm ${
                          selectedAnnotation === annotation.id ? 'text-blue-900' : 'text-gray-900'
                        }`}
                      >
                        {getToolName(annotation.type)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Page {annotation.page} • {formatTimestamp(annotation.timestamp)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      onAnnotationDelete(annotation.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Quick Tips
        </h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Click annotation list items to select them</li>
          <li>• Drag selected annotations to move them</li>
          <li>• Use the color picker to change annotation colors</li>
          <li>• Adjust stroke width for different line thicknesses</li>
          <li>• Click and drag to create shapes and lines</li>
        </ul>
      </div>
    </div>
  )
}
