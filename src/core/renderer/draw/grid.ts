import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { Viewport } from '../../viewport/Viewport'
import type { DrawContext } from './draw-context'
import { CONFIG } from '../../constants'

/**
 * Renders an infinite background grid that pans and zooms with the viewport.
 * Features dynamic density (Figma-style) and zoom-dependent visibility.
 */
export function renderInfiniteGrid(
  ck: CanvasKit,
  canvas: Canvas,
  viewport: Viewport,
  width: number,
  height: number,
  showGrid: boolean = true,
  ctx?: DrawContext,
): void {
  if (!showGrid) return

  const zoom = viewport.zoom

  // Figma-style: hide grid when zoomed out below threshold
  if (!CONFIG.GRID_SHOW) return
  const bounds = viewport.getVisibleBounds(width, height)

  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)

  // Determine grid sizes based on zoom
  // Figma style: 100px base grid, shows 10px lines when zoomed in (> 150%)
  const baseSize = CONFIG.GRID_BASE_SIZE
  const showSubGrid = zoom >= CONFIG.GRID_SUB_GRID_THRESHOLD
  const subGridSize = baseSize / CONFIG.GRID_SUB_GRID_DIVISION // e.g. 10px

  // 1. Draw Minor/Sub Grid (only when zoomed in)
  if (showSubGrid) {
    paint.setColor(CONFIG.GRID_COLOR_MINOR)
    paint.setStrokeWidth(CONFIG.GRID_STROKE_WIDTH_MINOR / zoom)

    const startX = Math.floor(bounds.left / subGridSize) * subGridSize
    for (let x = startX; x <= bounds.right; x += subGridSize) {
      // Skip lines that coincide with the major grid to avoid overdraw
      if (Math.abs(x % baseSize) < 0.1) continue
      canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
    }

    const startY = Math.floor(bounds.top / subGridSize) * subGridSize
    for (let y = startY; y <= bounds.bottom; y += subGridSize) {
      if (Math.abs(y % baseSize) < 0.1) continue
      canvas.drawLine(bounds.left, y, bounds.right, y, paint)
    }
  }

  // 2. Draw Major Grid
  paint.setColor(CONFIG.GRID_COLOR_MAJOR)
  paint.setStrokeWidth(CONFIG.GRID_STROKE_WIDTH_MAJOR / zoom)

  const majorStartX = Math.floor(bounds.left / baseSize) * baseSize
  for (let x = majorStartX; x <= bounds.right; x += baseSize) {
    canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
  }

  const majorStartY = Math.floor(bounds.top / baseSize) * baseSize
  for (let y = majorStartY; y <= bounds.bottom; y += baseSize) {
    canvas.drawLine(bounds.left, y, bounds.right, y, paint)
  }

  // 3. Draw Axis Lines (World 0,0)
  paint.setColor(CONFIG.GRID_COLOR_AXIS)
  paint.setStrokeWidth(CONFIG.GRID_STROKE_WIDTH_AXIS / zoom)

  // Y-axis (Vertical line at x=0)
  if (bounds.left <= 0 && bounds.right >= 0) {
    canvas.drawLine(0, bounds.top, 0, bounds.bottom, paint)
  }
  // X-axis (Horizontal line at y=0)
  if (bounds.top <= 0 && bounds.bottom >= 0) {
    canvas.drawLine(bounds.left, 0, bounds.right, 0, paint)
  }

  if (!ctx) paint.delete()
}
