// PDF.js worker configuration
export const configurePDFWorker = async () => {
  if (typeof window !== 'undefined') {
    try {
      // Use local worker to avoid CORS issues
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    } catch (error) {
      console.warn('Failed to configure PDF.js worker:', error)
    }
  }
}

// Alternative configuration for development
export const configurePDFWorkerDev = async () => {
  if (typeof window !== 'undefined') {
    try {
      const pdfjs = await import('pdfjs-dist')
      // Use a more reliable CDN or local worker
      pdfjs.GlobalWorkerOptions.workerSrc = 
        'https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.js'
    } catch (error) {
      console.warn('Failed to configure PDF.js worker:', error)
    }
  }
}
