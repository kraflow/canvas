import type { Canvas, CanvasKit } from 'canvaskit-wasm'

export interface RendererOptions {
  canvas: HTMLCanvasElement
  onDraw?: (canvas: Canvas, ck: CanvasKit) => void
}
