import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { LayoutRect } from '../types'
import type { DrawContext } from './draw-context'
import type { FontSystem, ParagraphOptions } from '@/core/fonts'
import { CONFIG } from '@/core/constants'

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
  paint.setStrokeWidth(CONFIG.OVERLAY_HOVER_STROKE_WIDTH / zoom)

  paint.setColor(CONFIG.OVERLAY_HOVER_COLOR)

  const dashValues = CONFIG.OVERLAY_HOVER_DASH.map((v) => v / zoom)
  const dash = ctx ? ctx.dashEffect(dashValues) : ck.PathEffect.MakeDash(dashValues, 0)

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
  paint.setStrokeWidth(CONFIG.OVERLAY_SELECTION_STROKE_WIDTH / zoom)

  paint.setColor(CONFIG.OVERLAY_SELECTION_COLOR)

  const offset = CONFIG.OVERLAY_SELECTION_OFFSET / zoom
  const skRect = ctx
    ? ctx.rect(rect.x - offset, rect.y - offset, rect.x + rect.w + offset, rect.y + rect.h + offset)
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
  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)

  const skRect = ctx
    ? ctx.rect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
    : ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(CONFIG.OVERLAY_MARQUEE_FILL_COLOR)
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(CONFIG.OVERLAY_MARQUEE_STROKE_WIDTH / zoom)
  paint.setColor(CONFIG.OVERLAY_MARQUEE_STROKE_COLOR)
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

  const fillColor = isError ? CONFIG.OVERLAY_GHOST_ERROR_FILL : CONFIG.OVERLAY_GHOST_VALID_FILL
  const strokeColor = isError
    ? CONFIG.OVERLAY_GHOST_ERROR_STROKE
    : CONFIG.OVERLAY_GHOST_VALID_STROKE

  // Fill
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(fillColor)
  canvas.drawRect(skRect, paint)

  // Stroke
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(CONFIG.OVERLAY_GHOST_STROKE_WIDTH / zoom)
  paint.setColor(strokeColor)
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
  const fontSize = CONFIG.OVERLAY_SCREEN_TITLE_FONT_SIZE / zoom

  const opts = {
    fontSize,
    color: CONFIG.OVERLAY_SCREEN_TITLE_COLOR,
    fontWeight: 500,
  }

  // Use the font system to create the paragraph safely
  const paragraph = fonts.makeParagraphSync(name, 'Inter', opts as ParagraphOptions, 1000)

  // Draw scaled margin above the screen
  const marginY = CONFIG.OVERLAY_SCREEN_TITLE_MARGIN_Y / zoom
  canvas.drawParagraph(paragraph, rect.x, rect.y - paragraph.getHeight() - marginY)

  paragraph.delete()
}
