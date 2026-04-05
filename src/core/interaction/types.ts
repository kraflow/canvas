import type { SceneNode } from '@/core/scene/types'
import type { LayoutRect } from '@/core/renderer/types'

export type InteractionMode = 'edit' | 'move' | 'play'

export interface InteractionState {
  mode: InteractionMode
  hoveredNode: SceneNode | null
  selectedNodes: Set<string> // Set of node IDs
  draggedNode: SceneNode | null
  selectionBox: LayoutRect | null // For marquee selection
  isPanning: boolean
  isDragging: boolean
  isBoxSelecting: boolean
}

export type InteractionEventType =
  | 'click'
  | 'hover'
  | 'dragStart'
  | 'dragMove'
  | 'dragEnd'
  | 'scroll'

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
