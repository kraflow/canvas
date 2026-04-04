import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { FontSystem } from '../fonts'

export interface RendererOptions {
  canvas: HTMLCanvasElement
  fonts?: FontSystem
  onDraw?: (canvas: Canvas, ck: CanvasKit) => void
}

export interface LayoutRect {
  x: number
  y: number
  w: number
  h: number
}
