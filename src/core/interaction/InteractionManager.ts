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
import type { InteractionOverlayManager } from './InteractionOverlayManager'

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
  private dragStartStates = new Map<string, { 
    initialX: number; 
    initialY: number; 
    grabOffsetX: number; 
    grabOffsetY: number; 
    parentId?: string; 
    style?: unknown 
  }>()
  private listeners: Set<InteractionCallback> = new Set()
  private originalMode: InteractionMode | null = null
  private overlayManager: InteractionOverlayManager | null = null

  constructor(
    canvas: HTMLCanvasElement,
    scene: SceneGraph,
    viewport?: Viewport,
    overlayManager?: InteractionOverlayManager,
  ) {
    this.canvas = canvas
    this.scene = scene
    this.viewport = viewport || new Viewport()
    this.overlayManager = overlayManager || null
    this.setupListeners()
  }

  public getOverlayManager(): InteractionOverlayManager | null {
    return this.overlayManager
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
      let targetId = hit.id
      
      // If we hit a root node, prefer its screen
      for (const s of this.scene.allScreens) {
        if (s.root.id === hit.id) {
          targetId = s.id
          break
        }
      }

      if (!this.state.selectedNodes.has(targetId)) {
        if (!e.shiftKey) this.state.selectedNodes.clear()
        this.state.selectedNodes.add(targetId)
      } else if (e.shiftKey) {
        this.state.selectedNodes.delete(targetId)
        return
      }

      this.state.isDragging = true
      this.state.draggedNode = hit
      
      // Store start states for all selected items
      this.dragStartStates.clear()
      for (const id of this.state.selectedNodes) {
        const screen = this.scene.getScreen(id)
        if (screen) {
          const gX = worldPoint.x - screen.x
          const gY = worldPoint.y - screen.y
          this.dragStartStates.set(id, { 
            initialX: screen.x, 
            initialY: screen.y,
            grabOffsetX: gX,
            grabOffsetY: gY
          })
        } else {
          const node = this.scene.getNodeById(id)
          if (node) {
            const style = node.style as Record<string, unknown>
            const gX = worldPoint.x - node.worldRect.x
            const gY = worldPoint.y - node.worldRect.y
            this.dragStartStates.set(id, { 
              initialX: (style.left as number) || 0, 
              initialY: (style.top as number) || 0,
              grabOffsetX: gX,
              grabOffsetY: gY,
              parentId: node.parent?.id,
              style: { ...node.style }
            })
          }
        }
      }

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
    this.dispatch('move', null, e, worldPoint.x, worldPoint.y)

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
      for (const id of this.state.selectedNodes) {
        const startState = this.dragStartStates.get(id)
        if (!startState) continue

        const screen = this.scene.getScreen(id)
        if (screen) {
          const newX = worldPoint.x - startState.grabOffsetX;
          const newY = worldPoint.y - startState.grabOffsetY;
          if (id === this.state.draggedNode?.id) {
             // console.log(`[DragMove] Screen id=${id}, world.x=${worldPoint.x}, gX=${startState.grabOffsetX}, newX=${newX}`);
          }
          this.scene.updateNode(id, {
            x: newX,
            y: newY,
          })
        } else {
          const node = this.scene.getNodeById(id)
          if (node) {
            const style = node.style as Record<string, unknown>
            const startState = this.dragStartStates.get(id)
            if (!startState) continue

            // Use absolute positioning during drag for perfect following
            let targetWorldX = worldPoint.x - startState.grabOffsetX
            let targetWorldY = worldPoint.y - startState.grabOffsetY

            if (node.parent) {
              const parentBounds = node.parent.worldRect
              
              // Clamp to parent boundaries
              targetWorldX = Math.max(parentBounds.x, Math.min(targetWorldX, parentBounds.x + parentBounds.w - node.rect.w))
              targetWorldY = Math.max(parentBounds.y, Math.min(targetWorldY, parentBounds.y + parentBounds.h - node.rect.h))
              
              const localX = targetWorldX - parentBounds.x
              const localY = targetWorldY - parentBounds.y

              this.scene.updateNode(id, {
                style: { 
                  ...style, 
                  position: 'absolute',
                  left: localX, 
                  top: localY 
                }
              })
            } else {
               // Node has no parent but isn't a screen? Should be handled by snapback later.
               this.scene.updateNode(id, {
                style: { ...style, left: targetWorldX, top: targetWorldY }
              })
            }
          }
        }
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
      for (const id of this.state.selectedNodes) {
        const screen = this.scene.getScreen(id)
        if (screen) continue // Screens can be dropped anywhere on canvas

        const node = this.scene.getNodeById(id)
        const startState = this.dragStartStates.get(id)
        if (!node || !startState) continue

        // 1. Find valid drop target (screen or view that accepts children)
        const hits = this.scene.spatialIndex.getCandidatesAtPoint(worldPoint.x, worldPoint.y)
        let bestTarget: SceneNode | null = null
        let maxDepth = -1

        for (const hit of hits) {
          if (hit.id === node.id) continue // Can't drop on self
          
          // Check if this hit is or is inside a Screen
          // Only 'view' nodes or Screen roots can accept children
          if (hit.type === 'view') {
            const depth = this.getNodeDepth(hit)
            if (depth > maxDepth) {
              maxDepth = depth
              bestTarget = hit
            }
          }
        }

        if (bestTarget) {
          // Reparenting logic
          const style = node.style as Record<string, unknown>
          
          this.scene.updateNode(id, {
            style: { 
              ...style, 
              position: 'relative', // Yoga takes over now!
              left: 0, // Reset offsets
              top: 0 
            }
          })
          
          if (node.parent?.id !== bestTarget.id) {
            this.scene.reparent(id, bestTarget.id)
          }
        } else {
          // Invalid drop (on canvas or non-view node) -> Snap back to original parent
          if (startState.parentId) {
            this.scene.reparent(id, startState.parentId)
            this.scene.updateNode(id, { style: startState.style as Record<string, unknown> })
          } else {
             // This node was somehow at root but not a screen? Snap back anyway.
             this.scene.updateNode(id, { style: startState.style as Record<string, unknown> })
          }
        }
      }

      this.dispatch('dragEnd', this.state.draggedNode, e, worldPoint.x, worldPoint.y)
    }

    this.dragStartStates.clear()
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

  private getNodeDepth(node: SceneNode): number {
    let depth = 0
    let curr = node.parent
    while (curr) {
      depth++
      curr = curr.parent
    }
    return depth
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
