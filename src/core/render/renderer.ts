import { type CanvasKit, type Surface, type Canvas as CKCanvas } from 'canvaskit-wasm'
import { loadCanvasKit } from './load'

import {
  createViewContext,
  createTextContext,
  createImageContext,
  destroyContext,
  type ViewContext,
  type TextContext,
  type ImageContext,
  type DrawContext,
} from '../draw/context'
import { view, restoreView, text, image } from '../draw'
import type { Rect, ScrollPosition } from '../draw/types'
import type { ViewStyle, TextStyle, ImageStyle } from '../styles'
import type { FontSystem } from '../fonts'

export interface RendererOptions {
  canvasElement: HTMLCanvasElement
  pixelRatio?: number
  onDraw?: (canvas: CKCanvas, ck: CanvasKit) => void
}

export type ViewNodeFn = (style: ViewStyle, rect: Rect, scrollPosition?: ScrollPosition) => void
export type TextNodeFn = (fonts: FontSystem, style: TextStyle, content: string, rect: Rect) => void
export type ImageNodeFn = (style: ImageStyle, src: string, rect: Rect) => void

export interface Renderer {
  init(): Promise<void>
  resize(width: number, height: number): void
  setPixelRatio(ratio: number): void
  setDrawFunction(fn: (canvas: CKCanvas, ck: CanvasKit) => void): void
  setAnimating(isAnimating: boolean): void
  draw(): void
  dispose(): void

  // Node wrapper factories
  createViewNode(): ViewNodeFn
  createTextNode(): TextNodeFn
  createImageNode(): ImageNodeFn
}

type RegisteredNode = {
  type: 'view' | 'text' | 'image'
  ctx: DrawContext | null
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

  const registeredNodes: RegisteredNode[] = []

  // Internal Context Lifecycle
  function createAllContexts() {
    for (const node of registeredNodes) {
      if (node.ctx) continue // already created
      if (node.type === 'view') node.ctx = createViewContext()
      else if (node.type === 'text') node.ctx = createTextContext()
      else if (node.type === 'image') node.ctx = createImageContext()
    }
  }

  function destroyAllContexts() {
    for (const node of registeredNodes) {
      if (node.ctx) {
        destroyContext(node.ctx)
        node.ctx = null
      }
    }
  }

  // Wrapper Factories
  function createViewNode(): ViewNodeFn {
    const node: RegisteredNode = { type: 'view', ctx: null }
    registeredNodes.push(node)
    return (style: ViewStyle, rect: Rect, scrollPosition?: ScrollPosition) => {
      const canvas = surface?.getCanvas()
      if (!ck || !canvas || !node.ctx) return
      view(ck, canvas, node.ctx as ViewContext, style, rect, scrollPosition)
    }
  }

  function createTextNode(): TextNodeFn {
    const node: RegisteredNode = { type: 'text', ctx: null }
    registeredNodes.push(node)
    return (fonts: FontSystem, style: TextStyle, content: string, rect: Rect) => {
      const canvas = surface?.getCanvas()
      if (!ck || !canvas || !node.ctx) return

      // Implicit View wrapper (Draw Chaining)
      view(ck, canvas, node.ctx as ViewContext, style, rect)

      text(ck, canvas, node.ctx as TextContext, fonts, style, content, rect)

      restoreView(canvas, style)
    }
  }

  function createImageNode(): ImageNodeFn {
    const node: RegisteredNode = { type: 'image', ctx: null }
    registeredNodes.push(node)
    return (style: ImageStyle, src: string, rect: Rect) => {
      const canvas = surface?.getCanvas()
      if (!ck || !canvas || !node.ctx) return

      // Implicit View wrapper (Draw Chaining)
      view(ck, canvas, node.ctx as ViewContext, style, rect)

      image(ck, canvas, node.ctx as ImageContext, style, src, rect)

      restoreView(canvas, style)
    }
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
      createAllContexts()
      createdContextsForAnimation = true
      if (rafId === null) {
        rafId = requestAnimationFrame(frame)
      }
    } else {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      destroyAllContexts()
      createdContextsForAnimation = false
    }
  }

  function draw() {
    if (!ck || !surface || !onDraw) return

    const canvas = surface.getCanvas()
    if (!canvas) return

    const isSingleDraw = !isAnimating && !createdContextsForAnimation
    if (isSingleDraw) {
      createAllContexts()
    }

    // clear and run user draw code
    canvas.clear(ck.TRANSPARENT)

    canvas.save()
    canvas.scale(pixelRatio, pixelRatio)

    onDraw(canvas, ck)

    canvas.restore()
    surface.flush()

    if (isSingleDraw) {
      destroyAllContexts()
    }
  }

  function dispose() {
    setAnimating(false)
    destroyAllContexts()
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
    createViewNode,
    createTextNode,
    createImageNode,
  }
}
