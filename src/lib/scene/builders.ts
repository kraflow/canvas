import type {
  NodeID,
  NodeType,
  SceneNode,
  Screen,
  SceneNodeProps,
  Expr,
  DynamicExpression,
} from './types'

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

export function createNode<T extends NodeType>(
  type: T,
  props?: Partial<SceneNodeProps<T>>,
  children?: SceneNode[],
  id?: NodeID,
): SceneNode<T> {
  return {
    id: id ?? generateId(type),
    type,
    props,
    children: children?.length ? children : undefined,
  }
}

/** Shorthand builders for built-in types */

export function view(
  props?: Partial<SceneNodeProps<'view'>>,
  children?: SceneNode[],
  id?: NodeID,
): SceneNode<'view'> {
  return createNode('view', props, children, id)
}

export function text(
  content: string | Expr<string>,
  props?: Omit<Partial<SceneNodeProps<'text'>>, 'text'>,
  id?: NodeID,
): SceneNode<'text'> {
  return createNode(
    'text',
    { ...props, text: content } as Partial<SceneNodeProps<'text'>>,
    undefined,
    id,
  )
}

export function image(
  src: string | Expr<string>,
  props?: Omit<Partial<SceneNodeProps<'image'>>, 'src'>,
  id?: NodeID,
): SceneNode<'image'> {
  return createNode('image', { ...props, src } as Partial<SceneNodeProps<'image'>>, undefined, id)
}

/** Reference another screen as a component */
export function screenRef(screenId: NodeID, id?: NodeID): SceneNode<'screen'> {
  return createNode('screen', { screenId } as Partial<SceneNodeProps<'screen'>>, undefined, id)
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
  root: SceneNode<'view'>
}): Screen {
  return {
    id: options.id ?? generateId('screen'),
    label: options.label,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width,
    height: options.height,
    root: options.root,
  }
}

/** Type guard — true if value is a DynamicExpression */
export function isExpr<T>(v: Expr<T>): v is DynamicExpression<T> {
  return (
    typeof v === 'object' &&
    v !== null &&
    '__' in (v as object) &&
    (v as DynamicExpression<T>).__ === 'e'
  )
}

/** Resolve an Expr to its current value */
export function resolveExpr<T>(v: Expr<T>): T {
  return isExpr(v) ? v.value : v
}

/** Wrap a plain value as a DynamicExpression */
export function expr<T>(value: T, fn?: () => T): DynamicExpression<T> {
  return { value, expr: fn, __: 'e' }
}
