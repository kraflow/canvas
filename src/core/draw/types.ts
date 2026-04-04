import type { Paint } from 'canvaskit-wasm'

export interface LayoutRectRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ScrollPosition {
  x: number
  y: number
}

export interface ScratchPaints {
  fill: Paint
  stroke: Paint
  layer: Paint
  shadow: Paint
  image: Paint
}
