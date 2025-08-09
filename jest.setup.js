import '@testing-library/jest-dom'

// Mock window.URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url')
global.URL.revokeObjectURL = jest.fn()

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Canvas HTMLCanvasElement methods
HTMLCanvasElement.prototype.toBlob = jest.fn(callback => {
  callback(new Blob())
})

// Mock file reader
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  result: 'data:application/pdf;base64,mock-pdf-data',
  onload: null,
  onerror: null,
}))

// Suppress console errors in tests unless they're intentional
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
