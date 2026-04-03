import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'
import type { ViewStyle } from '@/core/styles'
import type { Rect, ScrollPosition } from './types'

interface CompiledView {
  bgPaint: Paint | null
  borderPaint: Paint | null
  shadowPaint: Paint | null
}

const compileCache = new WeakMap<ViewStyle, CompiledView>()

function compileViewStyle(ck: CanvasKit, style: ViewStyle): CompiledView {
  let bgPaint: Paint | null = null
  let borderPaint: Paint | null = null
  let shadowPaint: Paint | null = null

  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    bgPaint = new ck.Paint()
    bgPaint.setColor(ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0))
    bgPaint.setStyle(ck.PaintStyle.Fill)
    bgPaint.setAntiAlias(true)
  }

  if (
    style.borderWidth &&
    style.borderColor &&
    style.borderWidth > 0 &&
    style.borderColor !== 'transparent'
  ) {
    borderPaint = new ck.Paint()
    borderPaint.setColor(ck.parseColorString(style.borderColor) || ck.Color4f(0, 0, 0, 1))
    borderPaint.setStyle(ck.PaintStyle.Stroke)
    borderPaint.setStrokeWidth(style.borderWidth)
    borderPaint.setAntiAlias(true)
  }

  if (style.shadowColor && style.shadowOpacity && style.shadowOpacity > 0) {
    shadowPaint = new ck.Paint()
    const baseCol = ck.parseColorString(style.shadowColor) || ck.Color4f(0, 0, 0, 1)
    baseCol[3] = style.shadowOpacity

    const offsetX = style.shadowOffset?.width || 0
    const offsetY = style.shadowOffset?.height || 0
    const blurRadius = style.shadowRadius || 0

    shadowPaint.setImageFilter(
      ck.ImageFilter.MakeDropShadow(offsetX, offsetY, blurRadius, blurRadius, baseCol, null),
    )
  }

  return { bgPaint, borderPaint, shadowPaint }
}

/**
 * Draws a View constraint. If the view is a scroll-view, it configures
 * clipping and executes canvas.translate natively.
 */
export function view(
  ck: CanvasKit,
  canvas: Canvas,
  style: ViewStyle,
  rect: Rect,
  scrollPosition?: ScrollPosition,
) {
  let compiled = compileCache.get(style)
  if (!compiled) {
    compiled = compileViewStyle(ck, style)
    compileCache.set(style, compiled)
  }

  const { bgPaint, borderPaint, shadowPaint } = compiled
  const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)

  let rrect: Float32Array | null = null
  if (style.borderRadius && style.borderRadius > 0) {
    rrect = ck.RRectXY(bounds, style.borderRadius, style.borderRadius)
  }

  // Draw visual shapes backing the specific node bounding box
  if (shadowPaint) {
    if (rrect) canvas.drawRRect(rrect, shadowPaint)
    else canvas.drawRect(bounds, shadowPaint)
  }
  if (bgPaint) {
    if (rrect) canvas.drawRRect(rrect, bgPaint)
    else canvas.drawRect(bounds, bgPaint)
  }
  if (borderPaint) {
    if (rrect) canvas.drawRRect(rrect, borderPaint)
    else canvas.drawRect(bounds, borderPaint)
  }

  // Clip boundaries mapping and execution
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
