import type { SceneGraph } from '@/core/scene/scene-graph'
import { Viewport } from '@/core/viewport/Viewport'
import type { SceneNode } from '@/core/scene/types'
import type {
  InteractionState,
  InteractionCallback,
  InteractionEvent,
  InteractionEventType,
  InteractionMode,
} from './types'

export class InteractionManager {
  private canvas: HTMLCanvasElement
  private scene: SceneGraph
  public readonly viewport: Viewport

  private state: InteractionState = {
    mode: 'edit',
    hoveredNode: null,
    selectedNodes: new Set(),
    draggedNode: null,
    selectionBox: null,
    isPanning: false,
    isDragging: false,
    isBoxSelecting: false,
  }

  private lastMouseX = 0
  private lastMouseY = 0
  private boxStartPoint = { x: 0, y: 0 }
  private listeners: Set<InteractionCallback> = new Set()
  private originalMode: InteractionMode | null = null

  constructor(canvas: HTMLCanvasElement, scene: SceneGraph, viewport?: Viewport) {
    this.canvas = canvas
    this.scene = scene
    this.viewport = viewport || new Viewport()
    this.setupListeners()
  }

  public getState(): InteractionState {
    return { ...this.state, selectedNodes: new Set(this.state.selectedNodes) }
  }

  public setMode(mode: InteractionMode) {
    const oldMode = this.state.mode
    this.state.mode = mode
    this.state.isPanning = false
    this.state.isDragging = false
    this.state.isBoxSelecting = false
    this.state.draggedNode = null
    this.state.selectionBox = null
    this.state.hoveredNode = null

    if (oldMode !== mode) {
      this.dispatch('modeChange', null, new PointerEvent('pointermove'), 0, 0)
    }
  }

  public on(callback: InteractionCallback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private setupListeners() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  public dispose() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.listeners.clear()
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    const worldPoint = this.getEventWorldPoint(e)

    if (this.state.mode === 'move') {
      this.state.isPanning = true
      this.dispatch('panningStart', null, e, worldPoint.x, worldPoint.y)
      return
    }

    const hit = this.scene.hitTest(worldPoint.x, worldPoint.y)

    if (hit) {
      if (!this.state.selectedNodes.has(hit.id)) {
        // Not already selected -> update selection
        if (!e.shiftKey) {
          this.state.selectedNodes.clear()
        }
        this.state.selectedNodes.add(hit.id)
      } else if (e.shiftKey) {
        // Already selected + Shift -> toggle off
        this.state.selectedNodes.delete(hit.id)
        return
      }

      this.state.isDragging = true
      this.state.draggedNode = hit
      this.dispatch('dragStart', hit, e, worldPoint.x, worldPoint.y)
    } else {
      // Start marquee selection
      this.state.isBoxSelecting = true
      this.boxStartPoint = worldPoint
      if (!e.shiftKey) {
        this.state.selectedNodes.clear()
      }
      this.dispatch('boxSelectStart', null, e, worldPoint.x, worldPoint.y)
    }
  }

  private handlePointerMove = (e: PointerEvent) => {
    const worldPoint = this.getEventWorldPoint(e)
    const worldDx = (e.clientX - this.lastMouseX) / this.viewport.zoom
    const worldDy = (e.clientY - this.lastMouseY) / this.viewport.zoom

    if (this.state.isPanning) {
      const screenDx = e.clientX - this.lastMouseX
      const screenDy = e.clientY - this.lastMouseY
      this.viewport.translate(screenDx, screenDy)
      this.dispatch('panningMove', null, e, worldPoint.x, worldPoint.y)
    } else if (this.state.isBoxSelecting) {
      this.state.selectionBox = {
        x: Math.min(this.boxStartPoint.x, worldPoint.x),
        y: Math.min(this.boxStartPoint.y, worldPoint.y),
        w: Math.abs(worldPoint.x - this.boxStartPoint.x),
        h: Math.abs(worldPoint.y - this.boxStartPoint.y),
      }
      this.dispatch('boxSelectMove', null, e, worldPoint.x, worldPoint.y)
    } else if (this.state.isDragging && this.state.draggedNode) {
      // MOVE ALL SELECTED NODES
      for (const id of this.state.selectedNodes) {
        const node = this.scene.getNodeById(id)
        if (!node) continue
        const currentStyle = node.style as Record<string, unknown>
        this.scene.applyStyle(node, {
          ...currentStyle,
          left: ((currentStyle.left as number) || 0) + worldDx,
          top: ((currentStyle.top as number) || 0) + worldDy,
        })
      }
      this.dispatch('dragMove', this.state.draggedNode, e, worldPoint.x, worldPoint.y)
    } else if (this.state.mode !== 'move') {
      const hit = this.scene.hitTest(worldPoint.x, worldPoint.y)
      if (hit !== this.state.hoveredNode) {
        this.state.hoveredNode = hit
        this.dispatch('hover', hit, e, worldPoint.x, worldPoint.y)
      }
    }

    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  private handlePointerUp = (e: PointerEvent) => {
    const worldPoint = this.getEventWorldPoint(e)

    if (this.state.isBoxSelecting && this.state.selectionBox) {
      const hits = this.scene.boxTest(this.state.selectionBox)
      hits.forEach((h) => this.state.selectedNodes.add(h.id))
      this.dispatch('boxSelectEnd', null, e, worldPoint.x, worldPoint.y)
    }

    if (this.state.isPanning) {
      this.dispatch('panningEnd', null, e, worldPoint.x, worldPoint.y)
    }

    if (this.state.isDragging) {
      this.dispatch('dragEnd', this.state.draggedNode, e, worldPoint.x, worldPoint.y)
    }

    this.state.isPanning = false
    this.state.isDragging = false
    this.state.isBoxSelecting = false
    this.state.draggedNode = null
    this.state.selectionBox = null
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const canvasRect = this.canvas.getBoundingClientRect()

    if (e.ctrlKey || e.metaKey) {
      // 1. Pinch-to-zoom (most browsers send ctrlKey for trackpad pinch)
      const zoomDelta = 1 - e.deltaY * 0.01
      this.viewport.zoomAtPoint(zoomDelta, e.clientX, e.clientY, canvasRect)
    } else {
      // 2. Two-finger pan (standard wheel/scroll)
      this.viewport.translate(-e.deltaX, -e.deltaY)
    }

    this.dispatch('scroll', null, e, 0, 0)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat && this.state.mode === 'edit') {
      this.originalMode = 'edit'
      this.setMode('move')
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' && this.originalMode === 'edit') {
      this.setMode('edit')
      this.originalMode = null
    }
  }

  private getEventWorldPoint(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(e.clientX, e.clientY, rect)
  }

  private dispatch(
    type: InteractionEventType,
    node: SceneNode | null,
    originalEvent: PointerEvent | WheelEvent,
    worldX: number,
    worldY: number,
  ) {
    const event: InteractionEvent = { type, node, originalEvent, worldX, worldY }
    const interactionEvent = event as InteractionEvent
    this.listeners.forEach((cb) => cb(interactionEvent))
  }
}
