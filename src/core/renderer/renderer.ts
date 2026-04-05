import type { Canvas, CanvasKit, Surface } from 'canvaskit-wasm'
import type { RendererOptions } from './types'
import { loadCanvasKit } from './load'
import type { Viewport } from '../viewport/Viewport'

/**
 * CanvasRenderer handles the initialization and rendering lifecycle of a CanvasKit-based canvas.
 * It manages the WebGL surface, the animation loop, and provides a clean interface for drawing.
 */
export class CanvasRenderer {
  private surface: Surface | null = null
  private canvas: HTMLCanvasElement | null = null
  public ck: CanvasKit | null = null
  private isAnimating = false
  private rafId: number | null = null
  private onDraw: ((canvas: Canvas, ck: CanvasKit) => void) | null = null
  private width = 0
  private height = 0
  private pixelRatio = window.devicePixelRatio || 1
  private viewport: Viewport | null = null

  /**
   * Creates a new CanvasRenderer instance.
   * @param options - The options for initializing the renderer.
   */
  constructor(options: RendererOptions) {
    this.canvas = options.canvas
    this.onDraw = options.onDraw || null
    this.viewport = options.viewport || null
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight
  }

  public setViewport(viewport: Viewport): void {
    this.viewport = viewport
  }

  /**
   * Initializes the renderer by loading CanvasKit and building the surface.
   * @returns A promise that resolves when initialization is complete.
   */
  public async initialize(): Promise<void> {
    this.ck = await loadCanvasKit()
    this.rebuildSurface()
  }

  /**
   * Rebuilds the CanvasKit surface based on the current canvas dimensions.
   * Should be called after resizing.
   * @private
   */
  private rebuildSurface(): void {
    if (!this.ck || !this.canvas) return

    if (this.surface) {
      this.surface.delete()
      this.surface = null
    }

    const physicalWidth = Math.max(1, Math.round(this.width * this.pixelRatio))
    const physicalHeight = Math.max(1, Math.round(this.height * this.pixelRatio))

    this.canvas.width = physicalWidth
    this.canvas.height = physicalHeight
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`

    this.surface = this.ck.MakeWebGLCanvasSurface(this.canvas, this.ck.ColorSpace.SRGB, {
      alpha: 1,
      antialias: 1,
      depth: 1,
      failIfMajorPerformanceCaveat: 0,
      majorVersion: 2,
      minorVersion: 0,
      premultipliedAlpha: 1,
      preserveDrawingBuffer: 0,
      stencil: 8,
    })

    if (!this.surface) {
      // Fallback if the webgl options failed
      this.surface = this.ck.MakeSWCanvasSurface(this.canvas)
    }

    if (!this.surface) {
      throw new Error('[CanvasRenderer] Failed to create CanvasKit WebGL surface')
    }
  }

  /**
   * Resizes the renderer to new dimensions and rebuilds the surface.
   * @param newWidth - The new width in CSS pixels.
   * @param newHeight - The new height in CSS pixels.
   */
  public resize(newWidth: number, newHeight: number): void {
    if (this.width === newWidth && this.height === newHeight) return
    this.width = newWidth
    this.height = newHeight
    this.rebuildSurface()
  }

  /**
   * Starts or stops the animation loop.
   * @param animating - Whether the loop should be running.
   */
  public setAnimating(animating: boolean): void {
    if (this.isAnimating === animating) return
    this.isAnimating = animating

    if (this.isAnimating) {
      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(this.frame.bind(this))
      }
    } else {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
    }
  }

  /**
   * Requests a single animation frame to be drawn.
   * If an animation loop is already running, this does nothing.
   */
  public requestFrame(): void {
    if (this.isAnimating || this.rafId !== null) return

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.draw()
    })
  }

  /**
   * The animation frame callback.
   * @private
   */
  private frame(): void {
    if (!this.isAnimating) {
      this.rafId = null
      return
    }

    this.draw()
    this.rafId = requestAnimationFrame(this.frame.bind(this))
  }

  /**
   * Performs the actual drawing by clearing the canvas and calling the onDraw callback.
   * @private
   */
  private draw(): void {
    if (!this.ck || !this.surface || !this.onDraw) return

    const canvas = this.surface.getCanvas()
    if (!canvas) return

    canvas.clear(this.ck.TRANSPARENT)
    canvas.save()
    canvas.scale(this.pixelRatio, this.pixelRatio)

    if (this.viewport) {
      canvas.translate(this.viewport.x, this.viewport.y)
      canvas.scale(this.viewport.zoom, this.viewport.zoom)
    }

    this.onDraw(canvas, this.ck)

    canvas.restore()
    this.surface.flush()
  }

  /**
   * Disposes of the renderer and releases all resources.
   */
  public dispose(): void {
    this.setAnimating(false)
    if (this.surface) {
      this.surface.delete()
      this.surface = null
    }
    this.ck = null
    this.onDraw = null
    this.canvas = null
  }
}
