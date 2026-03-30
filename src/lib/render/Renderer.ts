import type { CanvasKit, Surface, Canvas, FontMgr, Image, InputColor } from 'canvaskit-wasm'

import { loadCanvasKit } from '../load'
import { renderImage, renderText, renderView, type LayoutRect } from './NodeRender'
import type {
  ResolvedImageStyle,
  ResolvedTextStyle,
  ResolvedViewStyle,
} from '../styles/StyleResolver'

// ─── Types ────────────────────────────────────────────────────────────────────

type CachedImage = {
  img: Image
  refCount: number
}

export type DrawAPI = {
  view: (layout: LayoutRect, style: ResolvedViewStyle) => void
  text: (layout: LayoutRect, style: ResolvedTextStyle, content: string) => void
  image: (layout: LayoutRect, style: ResolvedImageStyle, image: Image) => void
  /** Direct access to the raw CanvasKit canvas for custom drawing */
  raw: Canvas
}

export type DrawFn = (api: DrawAPI) => void

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class Renderer {
  private ck: CanvasKit | null = null
  private surface: Surface | null = null
  private fontMgr: FontMgr | null = null

  private cache = new Map<string, CachedImage>()

  private initialized = false
  private _pixelRatio = window.devicePixelRatio || 1

  // rAF loop
  private rafId: number | null = null
  private dirty = false
  private currentDrawFn: DrawFn | null = null
  private currentBgColor: InputColor | null = null

  constructor(private readonly canvasEl: HTMLCanvasElement) {}

  // ─── Init ──────────────────────────────────────────────────────────────────

  async init(width: number, height: number): Promise<void> {
    if (this.initialized) return

    this.ck = await loadCanvasKit()
    this._setCanvasSize(width, height)
    this._createSurface()
    this._startLoop()

    this.initialized = true
  }

  // ─── Fonts ─────────────────────────────────────────────────────────────────

  async loadFonts(fonts: { url: string }[]): Promise<void> {
    if (!this.ck) throw new Error('Renderer not initialized')

    const buffers = await Promise.all(fonts.map((f) => fetch(f.url).then((r) => r.arrayBuffer())))

    this.fontMgr?.delete()
    this.fontMgr = null

    this.fontMgr = this.ck.FontMgr.FromData(...buffers)
    if (!this.fontMgr) throw new Error('Failed to create FontMgr')
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Schedule a redraw. Safe to call every frame — only repaints when dirty.
   * Call this whenever your scene data changes.
   */
  draw(drawFn: DrawFn, bgColor?: InputColor): void {
    if (!this.initialized) return
    this.currentDrawFn = drawFn
    this.currentBgColor = bgColor ?? null
    this.dirty = true
  }

  /** Force an immediate repaint without waiting for the rAF loop. */
  drawNow(drawFn: DrawFn, bgColor?: InputColor): void {
    if (!this.initialized) return
    this.currentDrawFn = drawFn
    this.currentBgColor = bgColor ?? null
    this._flush()
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (!this.ck || !this.initialized) return

    this._setCanvasSize(width, height)

    // Recreate surface for new dimensions
    this.surface?.delete()
    this.surface = null
    this._createSurface()

    // Redraw on new surface
    this.dirty = true
  }

  setPixelRatio(ratio: number): void {
    this._pixelRatio = ratio
  }

  // ─── Images ────────────────────────────────────────────────────────────────

  async loadImage(url: string): Promise<Image> {
    const cached = this.cache.get(url)
    if (cached) {
      cached.refCount++
      return cached.img
    }

    const buffer = await fetch(url).then((r) => r.arrayBuffer())
    const img = this.ck!.MakeImageFromEncoded(new Uint8Array(buffer))
    if (!img) throw new Error(`Failed to decode image: ${url}`)

    this.cache.set(url, { img, refCount: 1 })
    return img
  }

  releaseImage(url: string): void {
    const cached = this.cache.get(url)
    if (!cached) return

    cached.refCount--
    if (cached.refCount <= 0) {
      cached.img.delete()
      this.cache.delete(url)
    }
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Export the current canvas as a PNG data URL.
   * Useful for saving or sharing the rendered output.
   */
  toDataURL(type = 'image/png', quality = 1): string {
    return this.canvasEl.toDataURL(type, quality)
  }

  /**
   * Export the current canvas as a Blob.
   */
  toBlob(type = 'image/png', quality = 1): Promise<Blob | null> {
    return new Promise((resolve) => this.canvasEl.toBlob(resolve, type, quality))
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  getCk(): CanvasKit | null {
    return this.ck
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.canvasEl.clientWidth,
      height: this.canvasEl.clientHeight,
    }
  }

  getPixelRatio(): number {
    return this._pixelRatio
  }

  isReady(): boolean {
    return this.initialized && !!this.surface && !!this.fontMgr
  }

  // ─── Destroy ───────────────────────────────────────────────────────────────

  destroy(): void {
    if (!this.initialized) return
    this.initialized = false

    // Stop the loop first — nothing can draw after this
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.cache.forEach(({ img }) => img.delete())
    this.cache.clear()

    this.fontMgr?.delete()
    this.fontMgr = null

    this.surface?.delete()
    this.surface = null

    this.ck = null
    this.currentDrawFn = null
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _startLoop(): void {
    const loop = () => {
      if (this.dirty) {
        this.dirty = false
        this._flush()
      }
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private _flush(): void {
    if (!this.surface || !this.ck || !this.fontMgr || !this.currentDrawFn) return

    const ck = this.ck
    const fontMgr = this.fontMgr
    const surface = this.surface
    const canvas = surface.getCanvas()

    canvas.clear(this.currentBgColor ?? ck.WHITE)
    canvas.save()
    canvas.scale(this._pixelRatio, this._pixelRatio)

    this.currentDrawFn({
      view: (layout, style) => renderView(canvas, ck, layout, style),
      text: (layout, style, content) => renderText(canvas, ck, fontMgr, layout, style, content),
      image: (layout, style, image) => renderImage(canvas, ck, layout, style, image),
      raw: canvas,
    })

    canvas.restore()
    surface.flush()
  }

  private _setCanvasSize(width: number, height: number): void {
    const dpr = this._pixelRatio
    this.canvasEl.width = width * dpr
    this.canvasEl.height = height * dpr
    this.canvasEl.style.width = `${width}px`
    this.canvasEl.style.height = `${height}px`
  }

  private _createSurface(): void {
    if (!this.ck) throw new Error('CanvasKit not loaded')
    this.surface =
      this.ck.MakeWebGLCanvasSurface(this.canvasEl) ?? this.ck.MakeSWCanvasSurface(this.canvasEl)

    if (!this.surface) throw new Error('Failed to create surface')
  }
}
