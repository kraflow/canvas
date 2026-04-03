import type { Paint } from 'canvaskit-wasm'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
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
