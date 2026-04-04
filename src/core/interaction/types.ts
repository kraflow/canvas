import type { SceneNode } from '@/core/scene/types'

export type InteractionMode = 'edit' | 'move' | 'play'

export interface InteractionState {
  mode: InteractionMode
  hoveredNode: SceneNode | null
  selectedNodes: Set<string> // Set of node IDs
  draggedNode: SceneNode | null
  isPanning: boolean
  isDragging: boolean
}

export type InteractionEventType = 'click' | 'hover' | 'dragStart' | 'dragMove' | 'dragEnd' | 'scroll'

export interface InteractionEvent {
  type: InteractionEventType
  node: SceneNode | null
  originalEvent: PointerEvent | WheelEvent
  worldX: number
  worldY: number
  localX?: number
  localY?: number
}

export type InteractionCallback = (event: InteractionEvent) => void
