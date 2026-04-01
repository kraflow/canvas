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
  absX: number
  absY: number
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
      : never

/* ============================================================
 * Screen
 *
 * A root-level node with a world-space position.
 * Each Screen has exactly one root SceneNode as its content.
 * Screens can be referenced by other nodes (type: 'screen')
 * to act as reusable components.
 * ============================================================ */
export interface Screen {
  id: NodeID
  label?: string

  /** World-space position on the infinite canvas */
  x: number
  y: number

  /** Width/height of the screen's layout root — passed to Yoga */
  width: number
  height: number

  /** Yoga node for layout */
  yogaNode?: YogaNode

  /** The root node of this screen's content */
  children: SceneNode[]
}

/* ============================================================
 * Walk callback
 * ============================================================ */
export type WalkFn = (node: SceneNode, parent: SceneNode | null, depth: number) => void | false
// returning false stops traversal of that subtree
