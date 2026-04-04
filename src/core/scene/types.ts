import type { Image } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import type { ScrollPosition } from '@/core/renderer/draw'
import type { Node as YogaNode } from 'yoga-layout/load'

// =============================================================================
// Node types
// =============================================================================

export type SceneNodeType = 'view' | 'text' | 'image'

/**
 * A scene node is a lightweight object representing one element in the UI tree.
 *
 * Each node has:
 * - A type ('view' | 'text' | 'image')
 * - A style object (ViewStyle, TextStyle, or ImageStyle)
 * - An attached Yoga layout node (for flex computation)
 * - A computed rect (result of yoga calculateLayout)
 * - Optional type-specific data (text content, image reference, scroll)
 */
export interface SceneNode {
  /** Unique auto-generated ID */
  readonly id: string

  /** Node type discriminator */
  type: SceneNodeType

  /** Visual + layout style */
  style: ViewStyle | TextStyle | ImageStyle

  /** Ordered child nodes */
  children: SceneNode[]

  /** Parent (null for screen roots) */
  parent: SceneNode | null

  /** Attached Yoga layout node — created/freed by SceneGraph */
  yogaNode: YogaNode

  /**
   * Computed layout rect from Yoga.
   * Values are relative to the parent node.
   * The walk() function computes absolute rects.
   */
  rect: LayoutRect

  // ── Type-specific fields ──────────────────────────────────────────────────

  /** Text content (only for type === 'text') */
  text?: string

  /** CanvasKit image reference (only for type === 'image') */
  image?: Image | null

  /** Source path/URL for the image (only for type === 'image', used for persistence) */
  src?: string

  /** Scroll offset (only for type === 'view') */
  scroll?: ScrollPosition
}

// =============================================================================
// Screen
// =============================================================================

/**
 * A Screen is a root-level container on the infinite canvas.
 *
 * Unlike child nodes whose position comes from Yoga layout,
 * a Screen has a custom (x, y) position that the user controls directly.
 * Its width and height are set as the Yoga root's dimensions.
 *
 * Multiple Screens can coexist on the same canvas, each at a different position.
 */
export interface ScreenNode {
  /** Unique screen ID */
  readonly id: string

  /** Canvas position — NOT controlled by Yoga */
  x: number
  y: number

  /** Root dimensions (set on the Yoga root node) */
  width: number
  height: number

  /** The root SceneNode (always type = 'view') */
  root: SceneNode

  /** Whether layout needs recomputation */
  dirty: boolean
}

// =============================================================================
// Walk visitor
// =============================================================================

/**
 * Callback invoked by walk() for each node in the scene graph.
 *
 * @param node - The current scene node
 * @param absoluteRect - The node's absolute rect (canvas coordinates)
 */
export type WalkVisitor = (node: SceneNode, absoluteRect: LayoutRect) => void

// =============================================================================
// Serialization types
// =============================================================================

/** Serializable version of a SceneNode (plain data, no WASM objects) */
export interface SerializedSceneNode {
  type: SceneNodeType
  style: ViewStyle | TextStyle | ImageStyle
  text?: string
  src?: string
  scroll?: ScrollPosition
  children: SerializedSceneNode[]
}

/** Serializable version of a ScreenNode */
export interface SerializedScreenNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  root: SerializedSceneNode
}

/** Complete project state for file storage */
export interface SerializedProject {
  version: string
  screens: SerializedScreenNode[]
}
