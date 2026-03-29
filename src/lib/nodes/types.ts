import type { Node as YogaNode } from 'yoga-layout'
import type { ViewStyle } from '../styles/types'
import type { Rect } from '../geometry/types'

export type NodeID = string
export type DefaultSlot = 'default'

export type DefaultProps = object

export interface VNodePropsMap {
  view: DefaultProps
}

export interface VNodeSlotsMap {
  view: DefaultSlot
}

export interface VNodesMap {
  view: unknown
}

export interface VNodesStyleMap {
  view: ViewStyle
}

export type NodeType = keyof VNodesMap

export type VNodeStyle<T extends NodeType> = T extends keyof VNodesStyleMap
  ? VNodesStyleMap[T]
  : ViewStyle
export type VNodeProps<T extends NodeType> = T extends keyof VNodePropsMap
  ? VNodePropsMap[T]
  : { style?: VNodeStyle<T> }
export type VNodeSlot<T> = T extends keyof VNodeSlotsMap ? VNodeSlotsMap[T] : DefaultSlot

export interface Node<T extends NodeType> {
  id: string
  type: T

  style?: VNodeStyle<T> // This is has higher priority than `props.style`
  props?: VNodeProps<T>

  parent?: NodeID
  children?: NodeID[] | Record<VNodeSlot<T>, NodeID[]> // This has higher priority than `props.children`

  yogaNode?: YogaNode
  layout?: Rect
}
