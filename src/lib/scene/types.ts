import type { ViewStyle, TextStyle, ImageStyle } from '../styles/types'

/* ============================================================
 * Extension points
 * Users register custom node types and their props here via
 * module augmentation:
 *
 *   declare module './types' {
 *     interface NodesMap {
 *       button: true
 *     }
 *     interface NodesProps {
 *       button: { label: string; onPress?: () => void; style?: ViewStyle }
 *     }
 *   }
 * ============================================================ */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NodesMap {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NodesProps {}

/* ============================================================
 * Node types
 * ============================================================ */
export type NodeID = string

export type BuiltinNodeType =
  | 'view' // generic container
  | 'text' // text leaf
  | 'image' // image leaf
  | 'screen' // reference to another screen (component use)
  | 'each' // loop (future)
  | 'switch' // conditional (future)

export type NodeType = BuiltinNodeType | keyof NodesMap

/* ============================================================
 * Style mapping — derived from node type
 * ============================================================ */
export type NodeStyle<T extends NodeType> = T extends 'text'
  ? TextStyle
  : T extends 'image'
    ? ImageStyle
    : ViewStyle

/* ============================================================
 * Props — per node type, no children here (children on node)
 * ============================================================ */
export type NodeProps<T extends NodeType> = T extends 'text'
  ? { text: string; style?: NodeStyle<T> }
  : T extends 'image'
    ? { src: string; style?: NodeStyle<T> }
    : T extends 'screen'
      ? { screenId: NodeID } // embed another screen as component
      : T extends 'each'
        ? { items: unknown[]; keyExtractor?: (item: unknown, index: number) => string }
        : T extends 'switch'
          ? { condition: boolean }
          : T extends keyof NodesProps
            ? NodesProps[T]
            : { style?: NodeStyle<T> } // view / custom fallback

/* ============================================================
 * Dynamic expression
 *
 * A value that may be static or reactive (backed by state).
 * The `__: 'e'` discriminant allows cheap runtime detection.
 * `expr` is unused in v1 but reserved for the reactivity layer.
 * ============================================================ */
export interface DynamicExpression<T> {
  value: T
  expr?: (...args: unknown[]) => T
  __: 'e'
}

export type Expr<T> = T | DynamicExpression<T>

/* ============================================================
 * SceneNode
 *
 * Pure data. No methods. The tree structure is expressed via
 * children (direct node references, not ids).
 * ============================================================ */
export type SceneNodeProps<T extends NodeType> = {
  [K in keyof NodeProps<T>]: Expr<NodeProps<T>[K]>
}

export interface SceneNode<T extends NodeType = NodeType> {
  id: NodeID
  type: T
  key?: string | number
  props?: Partial<SceneNodeProps<T>>
  children?: SceneNode[]
}

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

  /** The root node of this screen's content */
  root: SceneNode<'view'>
}

/* ============================================================
 * Walk callback
 * ============================================================ */
export type WalkFn = (node: SceneNode, parent: SceneNode | null, depth: number) => void | false
// returning false stops traversal of that subtree
