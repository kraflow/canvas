import { type CanvasKit, type Surface, type Canvas as CKCanvas } from 'canvaskit-wasm'
import { loadCanvasKit } from './load'

import { view, restoreView, text, image } from '../draw'
import type { ScrollPosition, ScratchPaints, LayoutRectRect } from '../draw/types'
import type { ResolvedViewStyle, ResolvedTextStyle, ResolvedImageStyle } from '../styles'
import type { FontSystem } from '../fonts'

export interface RendererOptions {
  canvasElement: HTMLCanvasElement
  pixelRatio?: number
  fonts: FontSystem
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

  // Draw
  view: (rect: LayoutRectRect, style: ResolvedViewStyle, scroll?: ScrollPosition) => void
  text: (rect: LayoutRectRect, style: ResolvedTextStyle, content: string) => void
  image: (rect: LayoutRectRect, style: ResolvedImageStyle, src: string) => void
}

export function createRenderer(options: RendererOptions): Renderer {
  let ck: CanvasKit | null = null
  let surface: Surface | null = null
  let rafId: number | null = null

  let pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1
  let onDraw = options.onDraw
  let isAnimating = false
  let createdContextsForAnimation = false
  let width = options.canvasElement.clientWidth
  let height = options.canvasElement.clientHeight
  const fonts = options.fonts

  let scratchPaints: ScratchPaints | null = null

  function createPaints(): ScratchPaints {
    if (!ck) throw new Error('CanvasKit not loaded')

    const fill = new ck.Paint()
    fill.setStyle(ck.PaintStyle.Fill)
    fill.setAntiAlias(true)

    const stroke = new ck.Paint()
    stroke.setStyle(ck.PaintStyle.Stroke)
    stroke.setAntiAlias(true)

    const layer = new ck.Paint()
    layer.setAntiAlias(true)

    const shadow = new ck.Paint()
    shadow.setAntiAlias(true)

    const imagePaint = new ck.Paint()
    imagePaint.setAntiAlias(true)

    return { fill, stroke, layer, shadow, image: imagePaint }
  }

  function destroyPaints(paints: ScratchPaints) {
    paints.fill.delete()
    paints.stroke.delete()
    paints.layer.delete()
    paints.shadow.delete()
    paints.image.delete()
  }

  // Wrapper Factories
  function createViewNode(rect: LayoutRectRect, style: ResolvedViewStyle, scroll?: ScrollPosition) {
    const canvas = surface?.getCanvas()
    if (!ck || !canvas || !scratchPaints) return

    view(ck, canvas, style, rect, scroll, scratchPaints)
  }

  function createTextNode(rect: LayoutRectRect, style: ResolvedTextStyle, content: string) {
    const canvas = surface?.getCanvas()
    if (!ck || !canvas || !scratchPaints) return

    view(ck, canvas, style, rect, undefined, scratchPaints)
    text(canvas, fonts, style, content, rect)
    restoreView(canvas, style)
  }

  function createImageNode(rect: LayoutRectRect, style: ResolvedImageStyle, src: string) {
    const canvas = surface?.getCanvas()
    if (!ck || !canvas || !scratchPaints) return

    view(ck, canvas, style, rect, undefined, scratchPaints)
    image(ck, canvas, style, src, rect, scratchPaints)
    restoreView(canvas, style)
  }

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
      if (!scratchPaints) scratchPaints = createPaints()
      createdContextsForAnimation = true
      if (rafId === null) {
        rafId = requestAnimationFrame(frame)
      }
    } else {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (scratchPaints) {
        destroyPaints(scratchPaints)
        scratchPaints = null
      }
      createdContextsForAnimation = false
    }
  }

  function draw() {
    if (!ck || !surface || !onDraw) return

    const canvas = surface.getCanvas()
    if (!canvas) return

    const isSingleDraw = !isAnimating && !createdContextsForAnimation
    if (isSingleDraw) {
      scratchPaints = createPaints()
    }

    // clear and run user draw code
    canvas.clear(ck.TRANSPARENT)

    canvas.save()
    canvas.scale(pixelRatio, pixelRatio)

    onDraw(canvas, ck)

    canvas.restore()
    surface.flush()

    if (isSingleDraw) {
      destroyPaints(scratchPaints!)
      scratchPaints = null
    }
  }

  function dispose() {
    setAnimating(false)
    if (scratchPaints) {
      destroyPaints(scratchPaints)
      scratchPaints = null
    }
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

    // draw
    view: createViewNode,
    text: createTextNode,
    image: createImageNode,
  }
}
