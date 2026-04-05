import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { FontSystem } from '../fonts'
import type { Viewport } from '../viewport/Viewport'

export interface RendererOptions {
  canvas: HTMLCanvasElement
  fonts?: FontSystem
  viewport?: Viewport
  onDraw?: (canvas: Canvas, ck: CanvasKit) => void
}

export interface LayoutRect {
  x: number
  y: number
  w: number
  h: number
}
