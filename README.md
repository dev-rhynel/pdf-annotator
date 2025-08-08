# PDF Annotator

A NextJS TypeScript application that allows you to annotate, draw lines, and polygons on PDF documents.

## Features

- **PDF Upload**: Upload and view PDF documents
- **Multiple Annotation Tools**:
  - Line drawing
  - Rectangle drawing
  - Polygon drawing
  - Circle drawing
  - Text annotations
  - Select tool for interaction
- **Customization Options**:
  - Color selection for annotations
  - Adjustable stroke width
  - Zoom in/out functionality
- **Page Navigation**: Navigate through multi-page PDFs
- **Annotation Management**: View, track, and delete annotations
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **react-pdf** - PDF rendering and viewing
- **fabric.js** - Canvas-based drawing and annotation
- **pdf-lib** - PDF manipulation (for future export features)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pdf-annotator
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Uploading a PDF

1. Click on the upload area or drag and drop a PDF file
2. The PDF will be loaded and displayed in the viewer

### Drawing Annotations

1. **Select a Tool**: Choose from the available annotation tools in the toolbar
   - **Select**: Default mode for interaction
   - **Line**: Draw straight lines
   - **Rectangle**: Draw rectangular shapes
   - **Polygon**: Draw multi-point polygons
   - **Circle**: Draw circular shapes
   - **Text**: Add text annotations

2. **Choose Color**: Select a color from the color palette

3. **Adjust Stroke Width**: Use the slider to set the line thickness

4. **Draw**: Click and drag on the PDF to create annotations

### Managing Annotations

- **View**: All annotations are listed in the sidebar with timestamps
- **Delete**: Click the "✕" button next to any annotation to remove it
- **Navigate**: Use the page navigation buttons to move between pages

### PDF Navigation

- **Previous/Next**: Navigate between pages using the buttons
- **Zoom**: Use the "+" and "-" buttons to zoom in and out
- **Page Counter**: See current page and total pages

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout component
│   ├── page.tsx            # Main application page
│   └── globals.css         # Global styles
├── components/
│   ├── PDFViewer.tsx       # PDF rendering and annotation canvas
│   └── AnnotationToolbar.tsx # Tool selection and annotation management
└── types/
    └── annotation.ts       # TypeScript type definitions
```

## Key Components

### PDFViewer
- Handles PDF rendering using react-pdf
- Manages canvas overlay for annotations using fabric.js
- Implements drawing functionality for different annotation types
- Provides zoom and page navigation

### AnnotationToolbar
- Tool selection interface
- Color and stroke width controls
- Annotation list with delete functionality
- User instructions and guidance

## Future Enhancements

- [ ] Export annotated PDFs
- [ ] Save/load annotation sessions
- [ ] Undo/redo functionality
- [ ] More annotation types (arrows, highlights)
- [ ] Text editing for text annotations
- [ ] Annotation search and filtering
- [ ] Collaborative annotation features

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Annotation Types

1. Add the new type to `AnnotationType` in `types/annotation.ts`
2. Implement the drawing logic in `PDFViewer.tsx`
3. Add the tool to the tools array in `AnnotationToolbar.tsx`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
