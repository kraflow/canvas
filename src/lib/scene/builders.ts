import type {
  ImageSceneNode,
  LayoutRect,
  NodeID,
  NodeType,
  SceneNode,
  Screen,
  TextSceneNode,
  ViewSceneNode,
} from './types'

/* ============================================================
 * ID generation
 * Lightweight — no dependency on uuid library.
 * ============================================================ */
let _counter = 0
export function generateId(prefix = 'n'): NodeID {
  return `${prefix}_${Date.now().toString(36)}_${(++_counter).toString(36)}`
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/* ============================================================
 * Node builders
 *
 * These are plain factory functions — they return raw SceneNode
 * objects. No class needed since SceneNode is pure data.
 * ============================================================ */

export function createNode<T extends NodeType = 'view'>(
  type: T,
  style?: SceneNode<T>['style'],
  children?: SceneNode[],
  id?: NodeID,
): ViewSceneNode

export function createNode<T extends NodeType = 'screen'>(
  type: T,
  options?: { rect: LayoutRect; style?: SceneNode<T>['style']; label?: string },
  children?: SceneNode[],
  id?: NodeID,
): Screen

export function createNode<T extends NodeType = 'text'>(
  type: T,
  style?: SceneNode<T>['style'],
  text?: string,
  id?: NodeID,
): TextSceneNode

export function createNode<T extends NodeType = 'image'>(
  type: T,
  style?: SceneNode<T>['style'],
  src?: string,
  id?: NodeID,
): ImageSceneNode

export function createNode<T extends NodeType>(
  type: T,
  style?:
    | SceneNode<T>['style']
    | { rect: LayoutRect; style?: SceneNode<T>['style']; label?: string },
  children?: SceneNode[] | string,
  id?: NodeID,
): SceneNode<T> {
  // @ts-expect-error Ignore it
  return {
    id: id ?? generateId(type),
    type,
    ...(typeof children === 'string'
      ? type == 'image'
        ? { src: children }
        : { text: children }
      : { children }),
    ...(type == 'screen' ? style : { style }),
  }
}
