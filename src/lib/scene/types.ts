import type { Rect } from '../geometry/types'
import type {
  ResolvedImageStyle,
  ResolvedTextStyle,
  ResolvedViewStyle,
} from '../styles/StyleResolver'
import type { ViewStyle, TextStyle, ImageStyle } from '../styles/types'
import type { Node as YogaNode } from 'yoga-layout'

/* ============================================================
 * Node types
 * ============================================================ */
export type NodeID = string

export type NodeType =
  | 'view' // generic container
  | 'text' // text leaf
  | 'image' // image leaf
  | 'screen' // screen root

/* ============================================================
 * Style mapping — derived from node type
 * ============================================================ */
export type NodeStyle<T extends NodeType> = T extends 'text'
  ? TextStyle
  : T extends 'image'
    ? ImageStyle
    : ViewStyle

export type NodeResolvedStyle<T extends NodeType> = T extends 'text'
  ? ResolvedTextStyle
  : T extends 'image'
    ? ResolvedImageStyle
    : ResolvedViewStyle

export type LayoutRect = Rect & {
  absX?: number
  absY?: number
}

interface BaseSceneNode<T extends NodeType = NodeType> {
  id: NodeID
  type: T
  style?: NodeStyle<T>

  // runtime only
  resolvedStyle?: NodeResolvedStyle<T>
  parent?: NodeID
  yogaNode?: YogaNode

  rect?: LayoutRect
}

export interface ImageSceneNode extends BaseSceneNode<'image'> {
  src: string
}

export interface TextSceneNode extends BaseSceneNode<'text'> {
  text: string
}

export interface ViewSceneNode extends BaseSceneNode<'view'> {
  children?: SceneNode[]
}

export type SceneNode<T extends NodeType = NodeType> = T extends 'image'
  ? ImageSceneNode
  : T extends 'text'
    ? TextSceneNode
    : T extends 'view'
      ? ViewSceneNode
      : T extends 'screen'
        ? Screen
        : never

/* ============================================================
 * Screen
 *
 * A root-level node with a world-space position.
 * Each Screen has exactly one root SceneNode as its content.
 * Screens can be referenced by other nodes (type: 'screen')
 * to act as reusable components.
 * ============================================================ */
export interface Screen extends BaseSceneNode<'screen'> {
  label?: string

  rect: LayoutRect
  children: SceneNode[]
}

/* ============================================================
 * Walk callback
 * ============================================================ */
export type WalkFn = (node: SceneNode, parent: SceneNode | null, depth: number) => void | false
// returning false stops traversal of that subtree

/**
 * One entry per node in the spatial index.
 * Stores pre-computed world-space AABB and DFS depth so hit tests need
 * nothing from the node object itself — the loop is a tight struct scan.
 *
 * absX2 / absY2 are stored pre-computed (absX + w, absY + h) so the
 * containment check is four comparisons with no arithmetic per entry.
 */
export interface SpatialEntry {
  readonly id: NodeID
  readonly absX: number
  readonly absY: number
  readonly absX2: number // absX + w
  readonly absY2: number // absY + h
  readonly depth: number // DFS depth — higher = visually on top
}
