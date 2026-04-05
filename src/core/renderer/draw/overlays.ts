import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { LayoutRect } from '../types'
import type { DrawContext } from './draw-context'

/**
 * Renders a dashed hover highlight around a node.
 */
export function drawHoverHighlight(
  ck: CanvasKit,
  canvas: Canvas,
  rect: LayoutRect,
  zoom: number,
  ctx?: DrawContext,
): void {
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(1.5 / zoom)
  paint.setColor(ck.Color(99, 102, 241, 0.4))
  
  const dash = ck.PathEffect.MakeDash([5 / zoom, 5 / zoom], 0)
  paint.setPathEffect(dash)
  
  canvas.drawRect(
    ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h),
    paint,
  )
  
  if (!ctx) {
    paint.delete()
    dash.delete()
  } else {
    // Note: Dash effects are not yet cached in DrawContext for custom zoom
  }
}

/**
 * Renders a solid selection border around a node.
 */
export function drawSelectionHighlight(
  ck: CanvasKit,
  canvas: Canvas,
  rect: LayoutRect,
  zoom: number,
  ctx?: DrawContext,
): void {
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(2 / zoom)
  paint.setColor(ck.Color(99, 102, 241, 1))
  
  canvas.drawRect(
    ck.LTRBRect(rect.x - 1 / zoom, rect.y - 1 / zoom, rect.x + rect.w + 1 / zoom, rect.y + rect.h + 1 / zoom),
    paint,
  )
  
  if (!ctx) paint.delete()
}

/**
 * Renders a semi-transparent marquee selection box.
 */
export function drawMarqueeSelection(
  ck: CanvasKit,
  canvas: Canvas,
  rect: LayoutRect,
  zoom: number,
  ctx?: DrawContext,
): void {
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  
  const skRect = ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
  
  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(ck.Color(99, 102, 241, 0.1))
  canvas.drawRect(skRect, paint)
  
  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(1 / zoom)
  paint.setColor(ck.Color(99, 102, 241, 0.5))
  canvas.drawRect(skRect, paint)
  
  if (!ctx) paint.delete()
}

/**
 * Renders a ghost screen for placement feedback.
 */
export function drawPlacementGhost(
  ck: CanvasKit,
  canvas: Canvas,
  rect: LayoutRect,
  zoom: number,
  isError: boolean,
  ctx?: DrawContext,
): void {
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  
  const skRect = ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
  const baseColor = isError ? [239, 68, 68] : [99, 102, 241]
  
  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(ck.Color(baseColor[0], baseColor[1], baseColor[2], 0.1))
  canvas.drawRect(skRect, paint)
  
  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(2 / zoom)
  paint.setColor(ck.Color(baseColor[0], baseColor[1], baseColor[2], 0.5))
  canvas.drawRect(skRect, paint)
  
  if (!ctx) paint.delete()
}
