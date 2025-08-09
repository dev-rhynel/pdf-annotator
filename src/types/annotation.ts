export type AnnotationType =
  | 'line'
  | 'rectangle'
  | 'polygon'
  | 'circle'
  | 'curve'
  | 'text'
  | 'select'
  | 'none'

export interface Point {
  x: number
  y: number
}

export interface Annotation {
  id: string
  type: AnnotationType
  points: Point[]
  color: string
  strokeWidth: number
  text?: string
  page: number
  timestamp: number
}

export interface LineAnnotation extends Annotation {
  type: 'line'
  points: [Point, Point] // start and end points
}

export interface PolygonAnnotation extends Annotation {
  type: 'polygon'
  points: Point[] // multiple points for polygon
}

export interface RectangleAnnotation extends Annotation {
  type: 'rectangle'
  points: [Point, Point] // top-left and bottom-right points
}

export interface CircleAnnotation extends Annotation {
  type: 'circle'
  points: [Point] // center point
  radius: number
}

export interface CurveAnnotation extends Annotation {
  type: 'curve'
  points: Point[] // multiple points for smooth curve
}

export interface TextAnnotation extends Annotation {
  type: 'text'
  points: [Point] // position point
  text: string
  fontSize: number
}


