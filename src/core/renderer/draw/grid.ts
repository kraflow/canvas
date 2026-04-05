import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { Viewport } from '../../viewport/Viewport'
import type { DrawContext } from './draw-context'
import { GRID_CONFIG } from '../../constants'

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
  const bounds = viewport.getVisibleBounds(width, height)

  const paint = ctx ? ctx.paint() : new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)

  // Determine grid sizes based on zoom
  // Figma style: 100px base grid, shows 10px lines when zoomed in (> 150%)
  const baseSize = GRID_CONFIG.BASE_SIZE
  const showSubGrid = zoom >= GRID_CONFIG.SUB_GRID_THRESHOLD
  const subGridSize = baseSize / 10 // e.g. 10px

  // 1. Draw Minor/Sub Grid (only when zoomed in)
  if (showSubGrid) {
    const [r, g, b, a] = GRID_CONFIG.COLOR_MINOR
    paint.setColor(ck.Color(r! / 255, g! / 255, b! / 255, a!))
    paint.setStrokeWidth(1 / zoom)

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
  const [mr, mg, mb, ma] = GRID_CONFIG.COLOR_MAJOR
  paint.setColor(ck.Color(mr! / 255, mg! / 255, mb! / 255, ma!))
  paint.setStrokeWidth(1.5 / zoom)

  const majorStartX = Math.floor(bounds.left / baseSize) * baseSize
  for (let x = majorStartX; x <= bounds.right; x += baseSize) {
    canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
  }

  const majorStartY = Math.floor(bounds.top / baseSize) * baseSize
  for (let y = majorStartY; y <= bounds.bottom; y += baseSize) {
    canvas.drawLine(bounds.left, y, bounds.right, y, paint)
  }

  // 3. Draw Axis Lines (World 0,0)
  const [ar, ag, ab, aa] = GRID_CONFIG.COLOR_AXIS
  paint.setColor(ck.Color(ar! / 255, ag! / 255, ab! / 255, aa!))
  paint.setStrokeWidth(2 / zoom)

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
