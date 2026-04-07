import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { Viewport } from '../viewport/Viewport'
import type { DrawContext } from './draw'

export interface RendererOptions {
  canvas: HTMLCanvasElement
  viewport: Viewport
  onDraw: (canvas: Canvas, ck: CanvasKit, ctx: DrawContext) => void
}

export interface LayoutRect {
  x: number
  y: number
  w: number
  h: number
}
