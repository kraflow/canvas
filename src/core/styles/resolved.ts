import type { TransformStyle } from './types'
import type { ParagraphOptions } from '../fonts/paragraph-builder'

export interface ResolvedShadow {
  inset: boolean
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadDistance: number
  color: Float32Array
}

export interface ResolvedBorder {
  topWidth: number
  rightWidth: number
  bottomWidth: number
  leftWidth: number
  topColor: Float32Array
  rightColor: Float32Array
  bottomColor: Float32Array
  leftColor: Float32Array
  style: 'solid' | 'dashed' | 'dotted'
  isUniform: boolean
}

export interface ResolvedRadius {
  tl: number
  tr: number
  br: number
  bl: number
  isUniform: boolean
}

export interface ResolvedViewStyle {
  // background
  backgroundColor: Float32Array | null

  // borders
  border: ResolvedBorder

  // radius
  radius: ResolvedRadius

  // shadows
  outsetShadows: ResolvedShadow[]
  insetShadows: ResolvedShadow[]

  // layer
  opacity: number
  needsLayer: boolean
  blendModeValue: number | null

  // filters (passed as raw structures to build locally)
  filterEntries: Array<{ blur?: number }> | null

  // transforms
  transform?: TransformStyle['transform']
  transformOrigin?: TransformStyle['transformOrigin']

  // overflow
  clipContent: boolean

  // outline
  outline: { color: Float32Array; width: number; style: string; offset: number } | null

  // display
  display: boolean
}

export type ResolvedTextStyle = ResolvedViewStyle & ParagraphOptions

export interface ResolvedImageStyle extends ResolvedViewStyle {
  mode: 'cover' | 'contain' | 'stretch' | 'fill' | 'repeat' | 'center' | 'scale-down'
  tintColor: Float32Array | undefined
  overlayColor: Float32Array | undefined
}
