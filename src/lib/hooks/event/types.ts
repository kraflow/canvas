export type ToolMode = 'select' | 'hand'

export interface PointerInfo {
  pointerId: number
  screen: { x: number; y: number }
  shift: boolean
  meta: boolean // ctrlKey or metaKey
  alt: boolean
  button: 0 | 1 | 2
}

export interface ScrollInfo {
  screen: { x: number; y: number }
  deltaX: number
  deltaY: number
  shift: boolean
  meta: boolean
  alt: boolean
}

export interface ZoomInfo {
  screen: { x: number; y: number } // anchor point (zoom toward this)
  delta: number // positive = zoom in, negative = zoom out
  shift: boolean
  meta: boolean
  alt: boolean
}

export interface PanInfo {
  screen: { x: number; y: number }
  deltaX: number
  deltaY: number
  pointerId: number
}

export interface UsePointerEventsOptions {
  mode: ToolMode

  onDown: (info: PointerInfo) => void
  onUp: (info: PointerInfo) => void
  onScroll: (info: ScrollInfo) => void
  onZoom: (info: ZoomInfo) => void
  onPan: (info: PanInfo) => void
}
