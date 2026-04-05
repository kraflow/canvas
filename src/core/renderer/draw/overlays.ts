import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { LayoutRect } from '../types'
import type { DrawContext } from './draw-context'
import type { FontSystem } from '@/core/fonts'

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
  paint.setColor(ck.Color(99 / 255, 102 / 255, 241 / 255, 0.4))

  const dash = ctx 
    ? ctx.dashEffect([5 / zoom, 5 / zoom])
    : ck.PathEffect.MakeDash([5 / zoom, 5 / zoom], 0)
    
  paint.setPathEffect(dash)

  const skRect = ctx 
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    
  canvas.drawRect(skRect, paint)

  if (!ctx) {
    paint.delete()
    dash.delete()
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
  paint.setColor(ck.Color(99 / 255, 102 / 255, 241 / 255, 1))

  const skRect = ctx 
    ? ctx.rect(
        rect.x - 1 / zoom,
        rect.y - 1 / zoom,
        rect.x + rect.w + 1 / zoom,
        rect.y + rect.h + 1 / zoom,
      )
    : ck.LTRBRect(
        rect.x - 1 / zoom,
        rect.y - 1 / zoom,
        rect.x + rect.w + 1 / zoom,
        rect.y + rect.h + 1 / zoom,
      )
      
  canvas.drawRect(skRect, paint)

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

  const skRect = ctx 
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(ck.Color(99 / 255, 102 / 255, 241 / 255, 0.1))
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(1 / zoom)
  paint.setColor(ck.Color(99 / 255, 102 / 255, 241 / 255, 0.5))
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

  const skRect = ctx 
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    
  const baseColor = isError ? [239, 68, 68] : [99, 102, 241]

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(ck.Color(baseColor[0]! / 255, baseColor[1]! / 255, baseColor[2]! / 255, 0.1))
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(2 / zoom)
  paint.setColor(ck.Color(baseColor[0]! / 255, baseColor[1]! / 255, baseColor[2]! / 255, 0.5))
  canvas.drawRect(skRect, paint)

  if (!ctx) paint.delete()
}

/**
 * Renders a small screen title above the screen.
 */
export function drawScreenTitle(
  _ck: CanvasKit,
  canvas: Canvas,
  name: string,
  rect: LayoutRect,
  zoom: number,
  fonts: FontSystem,
): void {
  const textColor = new Float32Array([161 / 255, 161 / 255, 170 / 255, 1]) // Gray-400
  const fontSize = 12 / zoom
  
  const opts = {
    fontSize,
    color: textColor,
    fontWeight: 500,
  }

  // Use the font system to create the paragraph safely
  const paragraph = fonts.makeParagraphSync(name, 'Inter', opts, 1000)
  
  // Draw 8 world pixels (scaled) above the screen
  const marginY = 8 / zoom
  canvas.drawParagraph(paragraph, rect.x, rect.y - paragraph.getHeight() - marginY)
  
  paragraph.delete()
}
