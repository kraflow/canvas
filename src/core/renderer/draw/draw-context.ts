import type { CanvasKit, Paint, MaskFilter, PathEffect } from 'canvaskit-wasm'
import { CONFIG } from '../../constants'

/**
 * DrawContext provides pooled CanvasKit resources to avoid per-frame
 * WASM object allocation/deallocation overhead.
 *
 * Usage:
 *   const ctx = new DrawContext(ck)
 *
 *   // Each frame:
 *   ctx.beginFrame()
 *   renderView(ck, canvas, style, rect, undefined, undefined, ctx)
 *   // … render more nodes …
 *
 *   // On cleanup:
 *   ctx.dispose()
 *
 * Key optimisations:
 * - Paint pool: Paints are allocated on demand and reused across frames.
 *   After the initial few frames the pool stabilises and zero allocs occur.
 * - MaskFilter cache: Blur MaskFilters keyed by (sigma) are created once
 *   and reused whenever the same sigma is requested.
 * - PathEffect cache: Dash/dot PathEffects keyed by (style, width) are
 *   created once and reused.
 */
export class DrawContext {
  private readonly ck: CanvasKit

  // ── Paint pool ────────────────────────────────────────────────────────────
  private readonly paints: Paint[] = []
  private paintIdx = 0

  // ── MaskFilter cache (blur sigma → filter) ────────────────────────────────
  private readonly blurCache = new Map<number, MaskFilter>()

  // ── PathEffect cache (key → effect) ───────────────────────────────────────
  private readonly pathEffectCache = new Map<string, PathEffect>()
  private readonly dashCache = new Map<string, PathEffect>()

  // ── Rect pool (Float32Array [l, t, r, b]) ──────────────────────────────────
  private readonly rects: Float32Array[] = []
  private rectIdx = 0

  constructor(ck: CanvasKit) {
    this.ck = ck
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Frame lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Call at the start of each frame before any render calls.
   * Resets the paint pool index so all paints become available for reuse.
   */
  beginFrame(): void {
    this.paintIdx = 0
    this.rectIdx = 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paint pool
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a clean Paint ready for use.
   * Reuses an existing Paint from the pool when possible;
   * allocates a new one only when the pool is exhausted (then grows).
   *
   * The returned paint has:
   *  - antiAlias = true
   *  - all filters/effects/shaders cleared
   *  - alpha = 1
   *  - style = Fill
   *  - blendMode = SrcOver
   */
  paint(): Paint {
    const ck = this.ck

    if (this.paintIdx < this.paints.length) {
      const p = this.paints[this.paintIdx++]!
      // Reset to clean state
      this.resetPaint(p)
      return p
    }

    // Pool exhausted — grow by one
    const p = new ck.Paint()
    this.paints.push(p)
    this.paintIdx++
    p.setAntiAlias(true)
    return p
  }

  /**
   * Resets a paint to a clean default state for reuse.
   */
  private resetPaint(p: Paint): void {
    const ck = this.ck
    p.setAntiAlias(true)
    p.setStyle(ck.PaintStyle.Fill)
    p.setBlendMode(ck.BlendMode.SrcOver)
    p.setAlphaf(1)
    p.setColor(ck.BLACK)
    p.setStrokeWidth(0)
    // Clear optional attachments
    p.setColorFilter(null)
    p.setImageFilter(null)
    p.setMaskFilter(null)
    p.setPathEffect(null)
    p.setShader(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MaskFilter cache (blur)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a cached blur MaskFilter for the given sigma.
   * Creates one on first request; subsequent calls with the same sigma
   * return the cached instance (zero allocation).
   *
   * @param sigma - The blur sigma. Must be > 0.
   */
  blurMask(sigma: number): MaskFilter {
    // Round to improve cache hit rate
    const key = Math.round(sigma * CONFIG.PRECISION_BLUR_SIGMA) / CONFIG.PRECISION_BLUR_SIGMA

    let mf = this.blurCache.get(key)
    if (!mf) {
      mf = this.ck.MaskFilter.MakeBlur(this.ck.BlurStyle.Normal, key, true)
      this.blurCache.set(key, mf)
    }
    return mf
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PathEffect cache (border dash/dot)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a cached PathEffect for the given border style and width.
   * Returns null for 'solid' (no effect needed).
   *
   * @param borderStyle - 'solid' | 'dashed' | 'dotted'
   * @param width - The border/outline stroke width.
   */
  borderEffect(borderStyle: 'solid' | 'dotted' | 'dashed', width: number): PathEffect | null {
    if (borderStyle === 'solid') return null

    // Round width to improve cache hits
    const roundedW =
      Math.round(width * CONFIG.PRECISION_STROKE_WIDTH) / CONFIG.PRECISION_STROKE_WIDTH
    const key = `${borderStyle}:${roundedW}`

    let pe = this.pathEffectCache.get(key)
    if (!pe) {
      if (borderStyle === 'dashed') {
        const dashLen = Math.max(3, roundedW * CONFIG.BORDER_DASH_LENGTH_MULTIPLIER)
        const gapLen = Math.max(3, roundedW * CONFIG.BORDER_DASH_GAP_MULTIPLIER)
        pe = this.ck.PathEffect.MakeDash([dashLen, gapLen])
      } else {
        // dotted
        const dotSize = Math.max(1, roundedW * CONFIG.BORDER_DOT_SIZE_MULTIPLIER)
        pe = this.ck.PathEffect.MakeDash([dotSize, dotSize * CONFIG.BORDER_DOT_GAP_MULTIPLIER])
      }
      this.pathEffectCache.set(key, pe)
    }
    return pe
  }

  /**
   * Returns a cached/pooled dash PathEffect for arbitrary intervals.
   * To be used for interactive overlays (hover, etc).
   */
  dashEffect(intervals: number[]): PathEffect {
    const key = intervals.map((v) => Math.round(v * 10) / 10).join(',')
    let pe = this.dashCache.get(key)
    if (!pe) {
      pe = this.ck.PathEffect.MakeDash(intervals)
      this.dashCache.set(key, pe)
    }
    return pe
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rect pool (Float32Array [l, t, r, b])
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a pooled Float32Array rect in LTRB format.
   * CanvasKit functions like drawRect often accept these directly.
   */
  rect(l: number, t: number, r: number, b: number): Float32Array {
    if (this.rectIdx < this.rects.length) {
      const arr = this.rects[this.rectIdx++]!
      arr[0] = l
      arr[1] = t
      arr[2] = r
      arr[3] = b
      return arr
    }

    const arr = new Float32Array([l, t, r, b])
    this.rects.push(arr)
    this.rectIdx++
    return arr
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the current number of Paint objects in the pool.
   */
  get poolSize(): number {
    return this.paints.length
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Disposal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deletes all pooled/cached WASM resources.
   * Call when the renderer is being disposed.
   */
  dispose(): void {
    for (const p of this.paints) p.delete()
    this.paints.length = 0
    this.paintIdx = 0

    for (const mf of this.blurCache.values()) mf.delete()
    this.blurCache.clear()

    for (const pe of this.pathEffectCache.values()) pe.delete()
    this.pathEffectCache.clear()

    for (const pe of this.dashCache.values()) pe.delete()
    this.dashCache.clear()

    this.rects.length = 0
    this.rectIdx = 0
  }
}
