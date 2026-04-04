import type { Canvas, CanvasKit, Surface } from 'canvaskit-wasm'
import type { RendererOptions } from './types'
import { loadCanvasKit } from './load'

let surface: Surface | null = null
let canvas: HTMLCanvasElement | null = null
let ck: CanvasKit | null = null

let isAnimating = false
let rafId: number | null = null
let onDraw: ((canvas: Canvas, ck: CanvasKit) => void) | null = null

let width = 0
let height = 0

const pixelRatio = window.devicePixelRatio || 1

/**
 * Initializes the canvas renderer with the given options.
 * This function sets up the canvas element, the pixel ratio, and the CanvasKit surface.
 * It also loads the CanvasKit WASM module and creates a new CanvasKit instance.
 * @param {RendererOptions} s - The options for initializing the canvas renderer.
 * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
 */
export async function initializeCanvas(s: RendererOptions): Promise<void> {
  canvas = s.canvas
  height = canvas.clientHeight
  width = canvas.clientWidth
  surface = null
  onDraw = s.onDraw || null

  ck = await loadCanvasKit()
  rebuildSurface()
}

/**
 * Rebuilds the CanvasKit surface based on the current canvas size.
 * This function must be called after the canvas size has changed.
 * If the canvas size has not changed, this function does nothing.
 * @throws {Error} if the CanvasKit surface cannot be created.
 */
function rebuildSurface() {
  if (!ck || !canvas) return

  if (surface) {
    surface.delete()
    surface = null
  }

  const physicalWidth = Math.max(1, Math.round(width * pixelRatio))
  const physicalHeight = Math.max(1, Math.round(height * pixelRatio))

  canvas.width = physicalWidth
  canvas.height = physicalHeight
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  surface = ck.MakeWebGLCanvasSurface(canvas, ck.ColorSpace.SRGB, {
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

  if (!surface) {
    // Fallback if the webgl options failed
    surface = ck.MakeWebGLCanvasSurface(canvas)
  }

  if (!surface) {
    throw new Error('[renderer] Failed to create CanvasKit WebGL surface')
  }
}

/**
 * Resizes the canvas to the new width and height, and rebuilds the CanvasKit surface.
 * If the new dimensions are the same as the current dimensions, this function does nothing.
 * @param newWidth - The new width of the canvas.
 * @param newHeight - The new height of the canvas.
 */
export function resize(newWidth: number, newHeight: number) {
  if (width === newWidth && height === newHeight) return
  width = newWidth
  height = newHeight
  rebuildSurface()
}

// ---------------------------------------------------------
// Animation loop
// ---------------------------------------------------------

/**
 * Enables or disables the animation loop. When enabled, the animation loop will call the user-provided `onDraw` function at the next available frame.
 * When disabled, the animation loop will not call the user-provided `onDraw` function until it is re-enabled.
 * @param {boolean} animating - Whether to enable or disable the animation loop.
 */
export function setAnimating(animating: boolean) {
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

function frame() {
  if (!isAnimating) {
    rafId = null
    return
  }

  draw()
  rafId = requestAnimationFrame(frame)
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

/**
 * Disposes of the renderer, releasing all associated resources.
 * This function should be called when the renderer is no longer needed.
 * After calling this method, the renderer should not be used and will throw errors if methods are called.
 * This will delete the CanvasKit surface, set the CanvasKit instance to null, and set the onDraw callback to null.
 * @returns {void}
 */
export function dispose(): void {
  setAnimating(false)
  if (surface) {
    surface.delete()
    surface = null
  }

  ck = null
  onDraw = null
}
