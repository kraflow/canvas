import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { LayoutRect } from '../types'
import type { DrawContext } from './draw-context'
import type { FontSystem, ParagraphOptions } from '@/core/fonts'
import { OVERLAY_CONFIG } from '@/core/constants'

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
  const config = OVERLAY_CONFIG.HOVER
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(config.strokeWidth / zoom)
  
  const [r, g, b, a] = config.color as [number, number, number, number]
  paint.setColor(ck.Color(r / 255, g / 255, b / 255, a))

  const dashValues = config.dash.map(v => v / zoom)
  const dash = ctx 
    ? ctx.dashEffect(dashValues)
    : ck.PathEffect.MakeDash(dashValues, 0)
    
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
  const config = OVERLAY_CONFIG.SELECTION
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(config.strokeWidth / zoom)

  const [r, g, b, a] = config.color as [number, number, number, number]
  paint.setColor(ck.Color(r / 255, g / 255, b / 255, a))

  const offset = config.offset / zoom
  const skRect = ctx 
    ? ctx.rect(
        rect.x - offset,
        rect.y - offset,
        rect.x + rect.w + offset,
        rect.y + rect.h + offset,
      )
    : ck.LTRBRect(
        rect.x - offset,
        rect.y - offset,
        rect.x + rect.w + offset,
        rect.y + rect.h + offset,
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
  const config = OVERLAY_CONFIG.MARQUEE
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)

  const skRect = ctx 
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  const [fr, fg, fb, fa] = config.fillColor as [number, number, number, number]
  paint.setColor(ck.Color(fr / 255, fg / 255, fb / 255, fa))
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(config.strokeWidth / zoom)
  const [sr, sg, sb, sa] = config.strokeColor as [number, number, number, number]
  paint.setColor(ck.Color(sr / 255, sg / 255, sb / 255, sa))
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
  const config = OVERLAY_CONFIG.PLACEMENT_GHOST
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)

  const skRect = ctx 
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    
  const fillColor = isError ? (config.errorFill as number[]) : (config.validFill as number[])
  const strokeColor = isError ? (config.errorStroke as number[]) : (config.validStroke as number[])

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(ck.Color(fillColor[0]! / 255, fillColor[1]! / 255, fillColor[2]! / 255, fillColor[3]!))
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(config.strokeWidth / zoom)
  paint.setColor(ck.Color(strokeColor[0]! / 255, strokeColor[1]! / 255, strokeColor[2]! / 255, strokeColor[3]!))
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
  const config = OVERLAY_CONFIG.SCREEN_TITLE
  const fontSize = config.fontSize / zoom
  
  const opts = {
    fontSize,
    color: config.color,
    fontWeight: 500,
  }

  // Use the font system to create the paragraph safely
  const paragraph = fonts.makeParagraphSync(name, 'Inter', opts as ParagraphOptions, 1000)
  
  // Draw scaled margin above the screen
  const marginY = config.marginY / zoom
  canvas.drawParagraph(paragraph, rect.x, rect.y - paragraph.getHeight() - marginY)
  
  paragraph.delete()
}
