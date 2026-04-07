import type { SceneNode } from './types'
import type { LayoutRect } from '@/core/renderer/types'

/**
 * Grid-based spatial index for fast hit-test and box-selection.
 *
 * Cells are keyed by a single number: (cellX & 0x7FFF) | ((cellY & 0x7FFF) << 15)
 * — avoids string allocation on every lookup.
 *
 * Each cell is a Set<SceneNode> for O(1) insert/delete.
 */
export class SpatialIndex {
  private readonly cellSize: number
  private readonly grid = new Map<number, Set<SceneNode>>()

  constructor(cellSize = 256) {
    this.cellSize = cellSize
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private key(cx: number, cy: number): number {
    // Supports canvas coords in [-4096 * cellSize … 4095 * cellSize]
    return ((cx & 0x7fff) | ((cy & 0x7fff) << 15)) >>> 0
  }

  private insertRect(rect: LayoutRect, node: SceneNode): void {
    const cs = this.cellSize
    const x0 = Math.floor(rect.x / cs)
    const y0 = Math.floor(rect.y / cs)
    const x1 = Math.floor((rect.x + rect.w) / cs)
    const y1 = Math.floor((rect.y + rect.h) / cs)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy)
        let cell = this.grid.get(k)
        if (!cell) {
          cell = new Set()
          this.grid.set(k, cell)
        }
        cell.add(node)
      }
    }
  }

  private removeRect(rect: LayoutRect, node: SceneNode): void {
    const cs = this.cellSize
    const x0 = Math.floor(rect.x / cs)
    const y0 = Math.floor(rect.y / cs)
    const x1 = Math.floor((rect.x + rect.w) / cs)
    const y1 = Math.floor((rect.y + rect.h) / cs)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy)
        const cell = this.grid.get(k)
        if (!cell) continue
        cell.delete(node)
        if (cell.size === 0) this.grid.delete(k)
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public insert(node: SceneNode): void {
    this.insertRect(node.worldRect, node)
  }

  /**
   * Must be called with the node's OLD worldRect before it is mutated.
   */
  public update(node: SceneNode, oldRect: LayoutRect): void {
    this.removeRect(oldRect, node)
    this.insertRect(node.worldRect, node)
  }

  public remove(node: SceneNode): void {
    this.removeRect(node.worldRect, node)
  }

  public getCandidatesAtPoint(x: number, y: number): Set<SceneNode> {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
    return this.grid.get(k) ?? new Set()
  }

  public getCandidatesInRect(rect: LayoutRect): Set<SceneNode> {
    const result = new Set<SceneNode>()
    const cs = this.cellSize
    const x0 = Math.floor(rect.x / cs)
    const y0 = Math.floor(rect.y / cs)
    const x1 = Math.floor((rect.x + rect.w) / cs)
    const y1 = Math.floor((rect.y + rect.h) / cs)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.grid.get(this.key(cx, cy))
        if (!cell) continue
        for (const node of cell) result.add(node)
      }
    }
    return result
  }

  public rebuild(nodes: Iterable<SceneNode>): void {
    this.grid.clear()
    for (const node of nodes) this.insertRect(node.worldRect, node)
  }

  public clear(): void {
    this.grid.clear()
  }
}
