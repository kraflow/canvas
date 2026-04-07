import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import type { Node as YogaNode } from 'yoga-layout/load'

export type SceneNodeType = 'view' | 'text' | 'image'

export interface SceneNode {
  readonly id: string
  readonly type: SceneNodeType
  style: ViewStyle | TextStyle | ImageStyle
  // Only 'view' nodes have children; text/image always empty
  readonly children: SceneNode[]
  parent: SceneNode | null
  readonly yogaNode: YogaNode
  // Local rect relative to parent (set by Yoga)
  rect: LayoutRect
  // Absolute world-space rect (screen offset + local)
  worldRect: LayoutRect
  // text node only
  text?: string
  // image node only
  src?: string
  // scroll offset applied to children during world-rect calculation
  scroll: { x: number; y: number }
}

export interface ScreenNode {
  readonly id: string
  name: string
  // World-space position of the screen canvas (managed externally)
  x: number
  y: number
  width: number
  height: number
  readonly root: SceneNode
  dirty: boolean
}

export type WalkVisitor = (node: SceneNode, worldRect: LayoutRect) => void

// ── Serialization ─────────────────────────────────────────────────────────────

export interface SerializedSceneNode {
  readonly id: string
  readonly type: SceneNodeType
  style: ViewStyle | TextStyle | ImageStyle
  text?: string
  src?: string
  scroll: { x: number; y: number }
  children: SerializedSceneNode[]
}

export interface SerializedScreenNode {
  readonly id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  root: SerializedSceneNode
}

export interface SerializedProject {
  version: string
  screens: SerializedScreenNode[]
}
