import { type CanvasKit, type Surface, type Canvas as CKCanvas } from 'canvaskit-wasm'
import { loadCanvasKit } from './load'

export interface RendererOptions {
  canvasElement: HTMLCanvasElement
  pixelRatio?: number
  onDraw?: (canvas: CKCanvas, ck: CanvasKit) => void
}

export interface Renderer {
  init(): Promise<void>
  resize(width: number, height: number): void
  setPixelRatio(ratio: number): void
  setDrawFunction(fn: (canvas: CKCanvas, ck: CanvasKit) => void): void
  setAnimating(isAnimating: boolean): void
  draw(): void
  dispose(): void
}

export function createRenderer(options: RendererOptions): Renderer {
  let ck: CanvasKit | null = null
  let surface: Surface | null = null
  let rafId: number | null = null

  let pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1
  let onDraw = options.onDraw
  let isAnimating = false
  let width = options.canvasElement.clientWidth
  let height = options.canvasElement.clientHeight

  async function init() {
    ck = await loadCanvasKit()
    rebuildSurface()
  }

  function rebuildSurface() {
    if (!ck) return
    if (surface) {
      surface.delete()
      surface = null
    }

    const physicalWidth = Math.max(1, Math.round(width * pixelRatio))
    const physicalHeight = Math.max(1, Math.round(height * pixelRatio))

    options.canvasElement.width = physicalWidth
    options.canvasElement.height = physicalHeight
    options.canvasElement.style.width = `${width}px`
    options.canvasElement.style.height = `${height}px`

    surface = ck.MakeWebGLCanvasSurface(
      options.canvasElement as unknown as string | HTMLCanvasElement,
      ck.ColorSpace.SRGB,
      {
        alpha: 1,
        antialias: 1,
        depth: 1,
        failIfMajorPerformanceCaveat: 0,
        majorVersion: 2,
        minorVersion: 0,
        premultipliedAlpha: 1,
        preserveDrawingBuffer: 0,
        stencil: 8,
      },
    )

    if (!surface) {
      // Fallback if the webgl options failed
      surface = ck.MakeWebGLCanvasSurface(
        options.canvasElement as unknown as string | HTMLCanvasElement,
      )
    }

    if (!surface) {
      throw new Error('[renderer] Failed to create CanvasKit WebGL surface')
    }

    draw()
  }

  function resize(newWidth: number, newHeight: number) {
    if (width === newWidth && height === newHeight) return
    width = newWidth
    height = newHeight
    rebuildSurface()
  }

  function setPixelRatio(ratio: number) {
    if (pixelRatio === ratio) return
    pixelRatio = ratio
    rebuildSurface()
  }

  function setDrawFunction(fn: (canvas: CKCanvas, ck: CanvasKit) => void) {
    onDraw = fn
    if (!isAnimating) {
      draw()
    }
  }

  function frame() {
    if (!isAnimating) {
      rafId = null
      return
    }
    draw()
    rafId = requestAnimationFrame(frame)
  }

  function setAnimating(animating: boolean) {
    if (isAnimating === animating) return
    isAnimating = animating
    if (isAnimating) {
      if (rafId === null) {
        rafId = requestAnimationFrame(frame)
      }
    } else {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }

  function draw() {
    if (!ck || !surface || !onDraw) return

    const canvas = surface.getCanvas()
    if (!canvas) return

    // clear and run user draw code
    canvas.clear(ck.TRANSPARENT)

    canvas.save()
    canvas.scale(pixelRatio, pixelRatio)

    onDraw(canvas, ck)

    canvas.restore()
    surface.flush()
  }

  function dispose() {
    setAnimating(false)
    if (surface) {
      surface.delete()
      surface = null
    }
    ck = null
    onDraw = undefined
  }

  return {
    init,
    resize,
    setPixelRatio,
    setDrawFunction,
    setAnimating,
    draw,
    dispose,
  }
}
