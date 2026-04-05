import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { Viewport } from '../../viewport/Viewport'

/**
 * Renders an infinite background grid that pans and zooms with the viewport.
 * The grid should be drawn BEFORE applying viewport transformations to the canvas,
 * or it should be calculated to align with the transformed world space.
 * 
 * Drawing it in screen space (before viewport transform) is often easier to manage
 * for fixed pixel-width lines.
 */
export function renderInfiniteGrid(
  ck: CanvasKit,
  canvas: Canvas,
  viewport: Viewport,
  width: number,
  height: number,
): void {
  const zoom = viewport.zoom
  const bounds = viewport.getVisibleBounds(width, height)

  // Base grid size in world units
  let gridSize = 50
  if (zoom < 0.15) gridSize = 1000
  else if (zoom < 0.4) gridSize = 200
  else if (zoom > 2.5) gridSize = 10

  const paint = new ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(ck.PaintStyle.Stroke)

  // 1. Draw Minor Grid
  paint.setColor(ck.Color(255, 255, 255, 0.05))
  paint.setStrokeWidth(1 / zoom) // Keep line width constant in screen space

  const startX = Math.floor(bounds.left / gridSize) * gridSize
  for (let x = startX; x <= bounds.right; x += gridSize) {
    canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
  }

  const startY = Math.floor(bounds.top / gridSize) * gridSize
  for (let y = startY; y <= bounds.bottom; y += gridSize) {
    canvas.drawLine(bounds.left, y, bounds.right, y, paint)
  }

  // 2. Draw Major Grid (every 5 base units)
  const majorGridSize = gridSize * 5
  paint.setColor(ck.Color(255, 255, 255, 0.12))
  paint.setStrokeWidth(1.5 / zoom)

  const majorStartX = Math.floor(bounds.left / majorGridSize) * gridSize * 5
  for (let x = majorStartX; x <= bounds.right; x += majorGridSize) {
    canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
  }

  const majorStartY = Math.floor(bounds.top / majorGridSize) * majorGridSize
  for (let y = majorStartY; y <= bounds.bottom; y += majorGridSize) {
    canvas.drawLine(bounds.left, y, bounds.right, y, paint)
  }

  // 3. Draw Axis Lines (World 0,0)
  paint.setStrokeWidth(2 / zoom)
  paint.setColor(ck.Color(99, 102, 241, 0.3)) // Indigo-500

  // Y-axis (Vertical line at x=0)
  if (bounds.left <= 0 && bounds.right >= 0) {
    canvas.drawLine(0, bounds.top, 0, bounds.bottom, paint)
  }
  // X-axis (Horizontal line at y=0)
  if (bounds.top <= 0 && bounds.bottom >= 0) {
    canvas.drawLine(bounds.left, 0, bounds.right, 0, paint)
  }

  paint.delete()
}
