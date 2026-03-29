export interface Size {
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type Rect = Size & Point
