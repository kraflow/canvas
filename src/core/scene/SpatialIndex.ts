import type { SceneNode } from './types'
import type { LayoutRect } from '@/core/renderer/types'

/**
 * SpatialIndex provides fast spatial lookups for SceneNodes.
 * It uses a flat grid-based partitioning to narrow down candidates
 * for hit-testing and box-selection.
 */
export class SpatialIndex {
  private readonly cellSize: number
  private readonly grid = new Map<string, SceneNode[]>()

  /**
   * @param cellSize The size of each grid cell in world pixels. Default is 100.
   */
  constructor(cellSize = 100) {
    this.cellSize = cellSize
  }

  /**
   * Clears the index and rebuilds it from the given nodes.
   */
  public rebuild(nodes: IterableIterator<SceneNode>): void {
    this.grid.clear()
    for (const node of nodes) {
      const rect = node.worldRect
      const startX = Math.floor(rect.x / this.cellSize)
      const startY = Math.floor(rect.y / this.cellSize)
      const endX = Math.floor((rect.x + rect.w) / this.cellSize)
      const endY = Math.floor((rect.y + rect.h) / this.cellSize)

      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          const key = `${x},${y}`
          let cell = this.grid.get(key)
          if (!cell) {
            cell = []
            this.grid.set(key, cell)
          }
          cell.push(node)
        }
      }
    }
  }

  /**
   * Returns all nodes that intersect the given point.
   */
  public getCandidatesAtPoint(x: number, y: number): SceneNode[] {
    const cellX = Math.floor(x / this.cellSize)
    const cellY = Math.floor(y / this.cellSize)
    return this.grid.get(`${cellX},${cellY}`) || []
  }

  /**
   * Returns all nodes that intersect the given rectangle.
   */
  public getCandidatesInRect(rect: LayoutRect): Set<SceneNode> {
    const candidates = new Set<SceneNode>()
    const startX = Math.floor(rect.x / this.cellSize)
    const startY = Math.floor(rect.y / this.cellSize)
    const endX = Math.floor((rect.x + rect.w) / this.cellSize)
    const endY = Math.floor((rect.y + rect.h) / this.cellSize)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const cell = this.grid.get(`${x},${y}`)
        if (cell) {
          for (const node of cell) {
            candidates.add(node)
          }
        }
      }
    }

    return candidates
  }

  public insert(node: SceneNode): void {
    const rect = node.worldRect
    const startX = Math.floor(rect.x / this.cellSize)
    const startY = Math.floor(rect.y / this.cellSize)
    const endX = Math.floor((rect.x + rect.w) / this.cellSize)
    const endY = Math.floor((rect.y + rect.h) / this.cellSize)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`
        let cell = this.grid.get(key)
        if (!cell) {
          cell = []
          this.grid.set(key, cell)
        }
        cell.push(node)
      }
    }
  }

  public remove(node: SceneNode): void {
    const rect = node.worldRect
    const startX = Math.floor(rect.x / this.cellSize)
    const startY = Math.floor(rect.y / this.cellSize)
    const endX = Math.floor((rect.x + rect.w) / this.cellSize)
    const endY = Math.floor((rect.y + rect.h) / this.cellSize)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`
        const cell = this.grid.get(key)
        if (cell) {
          const idx = cell.indexOf(node)
          if (idx !== -1) {
            cell.splice(idx, 1)
          }
          if (cell.length === 0) {
            this.grid.delete(key)
          }
        }
      }
    }
  }

  public update(node: SceneNode): void {
    this.remove(node)
    this.insert(node)
  }

  public clear(): void {
    this.grid.clear()
  }
}
