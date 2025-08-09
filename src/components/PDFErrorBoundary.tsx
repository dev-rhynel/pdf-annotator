'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class PDFErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-2">PDF Rendering Error</h3>
            <p className="text-red-600 text-sm mb-2">
              There was an issue rendering the PDF. This might be due to:
            </p>
            <ul className="text-red-600 text-sm list-disc list-inside mb-3">
              <li>Browser security restrictions</li>
              <li>PDF file corruption</li>
              <li>Network connectivity issues</li>
              <li>PDF.js worker loading problems</li>
            </ul>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Try Again
            </button>
            {this.state.error && (
              <details className="mt-2">
                <summary className="text-red-600 text-sm cursor-pointer">Error Details</summary>
                <pre className="text-xs text-red-500 mt-1 bg-red-100 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        )
      )
    }

    return this.props.children
  }
}
