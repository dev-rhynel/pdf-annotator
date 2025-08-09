# 📝 PDF Annotator

A modern, feature-rich PDF annotation tool built with Next.js, TypeScript, and Canvas API. Create, edit, and manage annotations directly on PDF documents with an intuitive interface.

## ✨ Features

### 🎨 **Drawing Tools**

- **Line Tool**: Draw straight lines with precise control
- **Rectangle Tool**: Create rectangular shapes and boundaries
- **🔺 Triangle Tool**: Three-click triangle creation with live preview and fill
- **Circle Tool**: Draw perfect circles for highlighting areas
- **Polygon Tool**: Multi-click polygon creation with live preview and fill
- **Curve Tool**: Smooth curved lines with quadratic curve interpolation
- **✏️ Pencil Tool**: Real-time freehand drawing with path smoothing

### ✍️ **Signature Support**

- **Digital Signatures**: Draw signatures in a dedicated modal
- **Auto-naming**: Sequential signature naming (Signature - 0001, 0002, etc.)
- **Drag & Drop**: Move signatures after placement

### 🎨 **Customization**

- **Color Families**: Extensive color palette organized by families
- **Default Colors**: Smart black color default for professional appearance
- **Stroke Width**: Adjustable line thickness
- **Live Preview**: Real-time drawing feedback

### ⚡ **Advanced Features**

- **Real-time Drawing**: Live pencil drawing with instant visual feedback
- **Path Smoothing**: Automatic smoothing for natural-looking freehand drawings
- **Performance Optimized**: Smart point collection and 60fps rendering
- **Undo/Redo**: Full history management with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- **Multi-format Export**: Download as PNG image or JSON data
- **Responsive Design**: Works on desktop and mobile devices
- **Production Ready**: Comprehensive test coverage and error handling

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pdf-annotator

# Install dependencies
npm install
# or
pnpm install
# or
yarn install
```

### Development

```bash
# Start development server
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🎯 Usage

### 1. **Upload PDF**

- Click "Upload PDF" button or drag and drop a PDF file
- The PDF will be displayed with annotation overlay

### 2. **Select Drawing Tool**

- Choose from Line, Rectangle, Triangle, Circle, Polygon, Curve, Pencil, or Signature tools
- Select desired color and stroke width

### 3. **Create Annotations**

#### **Simple Tools (Line, Rectangle, Circle)**

- Click and drag to create shape
- Release mouse to complete

#### **🔺 Triangle Tool**

- Click first point to start triangle
- Click second point to set base
- Click third point to complete triangle
- Live preview with semi-transparent fill
- Press Escape to cancel

#### **Multi-point Tools (Polygon, Curve)**

- Click to add points
- Move mouse to see live preview
- Click near starting point to complete shape

#### **✏️ Pencil Tool**

- Click and drag to draw freehand
- Release mouse to complete stroke
- Path automatically smoothed for natural appearance
- Press Escape to cancel current drawing

#### **Signatures**

- Click to position signature
- Draw signature in modal
- Click "Add Signature" to place

### 4. **Manage Annotations**

- **Undo/Redo**: Use buttons or Ctrl+Z/Ctrl+Y
- **Delete**: Select annotations from list and click delete
- **Export**: Download as image or JSON

## 🧪 Testing

The application includes comprehensive tests covering:

- **Component Rendering**: All UI components render correctly
- **Drawing Functionality**: All drawing tools work as expected
- **User Interactions**: Mouse events, keyboard shortcuts
- **Error Handling**: Graceful handling of edge cases
- **Feature Integration**: Undo/redo, file upload, export

### Test Coverage Goals

- Branches: 70%+
- Functions: 70%+
- Lines: 70%+
- Statements: 70%+

## 🏗️ Architecture

### **Tech Stack**

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for responsive design
- **Canvas**: HTML5 Canvas API for drawing
- **Testing**: Jest + React Testing Library
- **PDF Handling**: iframe-based PDF display

### **Key Components**

- `SimplePDFViewer`: Main annotation interface
- `AnnotationToolbar`: Tool selection and controls
- `PDFErrorBoundary`: Error handling wrapper

### **State Management**

- React hooks for local state
- Annotation history for undo/redo
- Real-time drawing state management

## 📁 Project Structure

```
src/
├── app/                   # Next.js app router
├── components/           # React components
│   ├── SimplePDFViewer.tsx    # Main PDF viewer
│   ├── AnnotationToolbar.tsx  # Tool controls
│   └── PDFErrorBoundary.tsx   # Error handling
├── types/               # TypeScript definitions
│   └── annotation.ts    # Annotation type definitions
├── utils/               # Utility functions
└── __tests__/          # Test files

```

## 🔧 Configuration

### **Environment Variables**

No environment variables required for basic functionality.

### **Build Configuration**

- `next.config.ts`: Next.js configuration
- `tailwind.config.ts`: Tailwind CSS settings
- `tsconfig.json`: TypeScript compiler options
- `jest.config.js`: Test configuration

## 🚀 Deployment

### **Vercel (Recommended)**

```bash
# Deploy to Vercel
vercel --prod
```

### **Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### **Static Export**

```bash
# For static hosting
npm run build
npm run export
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

**PDF not loading**

- Ensure PDF file is valid and not corrupted
- Check browser console for CORS errors

**Drawing not working**

- Verify canvas is properly initialized
- Check for JavaScript errors in console

**Performance issues**

- Reduce annotation count for complex documents
- Clear browser cache and reload

### Getting Help

- Check [Issues](../../issues) for existing problems
- Create new issue with detailed description
- Include browser version and error messages

## 🎯 Roadmap

- [x] **✏️ Pencil Tool**: Real-time freehand drawing (✅ **Completed**)
- [ ] **Text Annotations**: Add text input capability
- [ ] **Shape Libraries**: Predefined shape templates
- [ ] **Collaboration**: Real-time multi-user editing
- [ ] **Cloud Storage**: Integration with cloud providers
- [ ] **Mobile App**: Native mobile applications
- [ ] **Advanced Export**: PDF with embedded annotations

---

**Built with ❤️ using Next.js, TypeScript, and Canvas API**
