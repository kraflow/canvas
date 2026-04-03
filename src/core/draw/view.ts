import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { ViewStyle } from '@/core/styles'
import type { Rect, ScrollPosition } from './types'
import type { ViewContext } from './context'

/**
 * Draws a View constraint. Uses an explicitly provided ViewContext
 * to avoid memory leaks while allowing dynamic real-time style updates.
 */
export function view(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: ViewContext,
  style: ViewStyle,
  rect: Rect,
  scrollPosition?: ScrollPosition,
) {
  // -- Background Paint Management --
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    if (!ctx.bgPaint) {
      ctx.bgPaint = new ck.Paint()
      ctx.bgPaint.setStyle(ck.PaintStyle.Fill)
      ctx.bgPaint.setAntiAlias(true)
    }
    const color = ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0)
    if (color) ctx.bgPaint.setColor(color)
  } else if (ctx.bgPaint) {
    ctx.bgPaint.delete()
    ctx.bgPaint = null
  }

  // -- Border Paint Management --
  if (
    style.borderWidth &&
    style.borderColor &&
    style.borderWidth > 0 &&
    style.borderColor !== 'transparent'
  ) {
    if (!ctx.borderPaint) {
      ctx.borderPaint = new ck.Paint()
      ctx.borderPaint.setStyle(ck.PaintStyle.Stroke)
      ctx.borderPaint.setAntiAlias(true)
    }
    ctx.borderPaint.setStrokeWidth(style.borderWidth)
    const color = ck.parseColorString(style.borderColor) || ck.Color4f(0, 0, 0, 1)
    if (color) ctx.borderPaint.setColor(color)
  } else if (ctx.borderPaint) {
    ctx.borderPaint.delete()
    ctx.borderPaint = null
  }

  // -- Shadow Paint Management --
  if (style.shadowColor && style.shadowOpacity && style.shadowOpacity > 0) {
    if (!ctx.shadowPaint) {
      ctx.shadowPaint = new ck.Paint()
    }
    const baseCol = ck.parseColorString(style.shadowColor) || ck.Color4f(0, 0, 0, 1)
    baseCol[3] = style.shadowOpacity

    const offsetX = style.shadowOffset?.width || 0
    const offsetY = style.shadowOffset?.height || 0
    const blurRadius = style.shadowRadius || 0

    // ImageFilters are slightly immutable, so we remake it strictly on the existing paint
    ctx.shadowPaint.setImageFilter(
      ck.ImageFilter.MakeDropShadow(offsetX, offsetY, blurRadius, blurRadius, baseCol, null),
    )
  } else if (ctx.shadowPaint) {
    ctx.shadowPaint.delete()
    ctx.shadowPaint = null
  }

  // --- Drawing logic ---
  const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)

  let rrect: Float32Array | null = null
  if (style.borderRadius && style.borderRadius > 0) {
    rrect = ck.RRectXY(bounds, style.borderRadius, style.borderRadius)
  }

  if (ctx.shadowPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.shadowPaint)
    else canvas.drawRect(bounds, ctx.shadowPaint)
  }
  if (ctx.bgPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.bgPaint)
    else canvas.drawRect(bounds, ctx.bgPaint)
  }
  if (ctx.borderPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.borderPaint)
    else canvas.drawRect(bounds, ctx.borderPaint)
  }

  // Clip boundaries
  const isScrollOrHidden = style.overflow === 'scroll' || style.overflow === 'hidden'
  if (isScrollOrHidden) {
    canvas.save()
    if (rrect) canvas.clipRRect(rrect, ck.ClipOp.Intersect, true)
    else canvas.clipRect(bounds, ck.ClipOp.Intersect, true)

    if (scrollPosition) {
      canvas.translate(-scrollPosition.x, -scrollPosition.y)
    }
  }
}

/**
 * MUST be called by the graph iterator on a node AFTER it visits
 * its children nodes if it previously executed view(...) boundaries.
 */
export function restoreView(canvas: Canvas, style: ViewStyle) {
  const isScrollOrHidden = style.overflow === 'scroll' || style.overflow === 'hidden'
  if (isScrollOrHidden) {
    canvas.restore()
  }
}
