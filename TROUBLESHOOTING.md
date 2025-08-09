# PDF Annotator Troubleshooting Guide

## Issues Fixed

### 1. CORS Policy Errors

**Problem**: PDF.js worker was being blocked by CORS when loading from CDN
**Solution**:

- Copied `pdf.worker.min.mjs` from `node_modules/pdfjs-dist/build/` to `public/` as `pdf.worker.min.js`
- Updated `src/utils/pdf-config.ts` to use local worker: `/pdf.worker.min.js`
- Added CORS headers in `next.config.ts`

### 2. PDF.js Worker Configuration

**Problem**: Version mismatch between worker and library
**Solution**:

- Updated configuration to use consistent version (5.4.54)
- Added proper error handling for worker loading

### 3. jsPDF PDF Support

**Problem**: `addImage` function doesn't support PDF files directly
**Solution**:

- Removed direct PDF embedding attempts
- Added fallback to create PDF with annotations and metadata only
- Improved error handling for PDF creation

### 4. PDF Rendering Failures

**Problem**: PDF.js setup failing due to worker issues
**Solution**:

- Added `PDFErrorBoundary` component for graceful error handling
- Improved error messages and recovery options
- Added multiple fallback approaches for PDF rendering

## How to Test the Fixes

1. **Start the development server**:

   ```bash
   npm run dev
   ```

2. **Upload a PDF file** and verify:
   - PDF loads without CORS errors
   - Annotations can be drawn
   - Download functionality works

3. **Check browser console** for any remaining errors

## Common Issues and Solutions

### If you still see CORS errors:

1. Clear browser cache
2. Restart the development server
3. Check that `public/pdf.worker.min.js` exists

### If PDF rendering fails:

1. Try a different PDF file
2. Check browser console for specific error messages
3. Use the "Try Again" button in the error boundary

### If download doesn't work:

1. Check browser console for errors
2. Try the different download options (PNG, JSON, PDF)
3. Ensure you have annotations to download

## File Structure Changes

```
public/
  └── pdf.worker.min.js  # Added: Local PDF.js worker

src/
  ├── components/
  │   ├── PDFErrorBoundary.tsx  # Added: Error handling
  │   └── SimplePDFViewer.tsx   # Updated: Better error handling
  ├── utils/
  │   └── pdf-config.ts         # Updated: Local worker config
  └── app/
      └── page.tsx              # Updated: Error boundary wrapper

next.config.ts                  # Updated: CORS headers
```

## Browser Compatibility

The application works best with:

- Chrome/Chromium (recommended)
- Firefox
- Safari (may have some limitations)
- Edge

## Performance Notes

- Large PDF files may take longer to load
- Complex annotations may affect performance
- Consider using smaller PDF files for testing
