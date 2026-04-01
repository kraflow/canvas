import type { NodeID, NodeType, SceneNode, Screen } from './types'

/* ============================================================
 * ID generation
 * Lightweight — no dependency on uuid library.
 * ============================================================ */
let _counter = 0
export function generateId(prefix = 'n'): NodeID {
  return `${prefix}_${Date.now().toString(36)}_${(++_counter).toString(36)}`
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
): SceneNode<T>

export function createNode<T extends NodeType = 'text'>(
  type: T,
  style?: SceneNode<T>['style'],
  text?: string,
  id?: NodeID,
): SceneNode<T>

export function createNode<T extends NodeType = 'image'>(
  type: T,
  style?: SceneNode<T>['style'],
  src?: string,
  id?: NodeID,
): SceneNode<T>

export function createNode<T extends NodeType>(
  type: T,
  style?: SceneNode<T>['style'],
  children?: SceneNode[] | string,
  id?: NodeID,
): SceneNode<T> {
  // @ts-expect-error Ignore it
  return {
    id: id ?? generateId(type),
    type,
    style,
    ...(typeof children === 'string'
      ? type == 'image'
        ? { src: children }
        : { text: children }
      : { children: children }),
  }
}

/* ============================================================
 * Screen builder
 * ============================================================ */

export function createScreen(options: {
  id?: NodeID
  label?: string
  x?: number
  y?: number
  width: number
  height: number
  children: SceneNode[]
}): Screen {
  return {
    id: options.id ?? generateId('screen'),
    label: options.label,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width,
    height: options.height,
    children: options.children,
  }
}
