import type { Image } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle, StyleProp } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import type { ScrollPosition } from '@/core/renderer/draw'
import type { Node as YogaNode } from 'yoga-layout/load'

// =============================================================================
// Node types
// =============================================================================

export type SceneNodeType = 'view' | 'text' | 'image'

/**
 * A scene node is a lightweight object representing one element in the UI tree.
 */
export interface SceneNode {
  readonly id: string
  type: SceneNodeType
  style: ViewStyle | TextStyle | ImageStyle
  children: SceneNode[]
  parent: SceneNode | null
  yogaNode: YogaNode
  rect: LayoutRect
  worldRect: LayoutRect // Pre-calculated world-space coordinates

  // ── Type-specific fields ──────────────────────────────────────────────────
  text?: string
  image?: Image | null
  src?: string
  scroll?: ScrollPosition
}

// =============================================================================
// Screen
// =============================================================================

export interface ScreenNode {
  readonly id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  root: SceneNode
  dirty: boolean
}

// =============================================================================
// Walk visitor
// =============================================================================

export type WalkVisitor = (node: SceneNode, absoluteRect: LayoutRect) => void

// =============================================================================
// Serialization types
// =============================================================================

export interface SerializedSceneNode {
  type: SceneNodeType
  style: StyleProp<ViewStyle | TextStyle | ImageStyle>
  text?: string
  src?: string
  scroll?: ScrollPosition
  children: SerializedSceneNode[]
}

export interface SerializedScreenNode {
  id: string
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
