import type { ViewStyle } from './view'

export type FontVariant =
  | 'small-caps'
  | 'oldstyle-nums'
  | 'lining-nums'
  | 'tabular-nums'
  | 'proportional-nums'

export interface TextStyle extends ViewStyle {
  color?: string
  fontFamily?: string
  fontSize?: number
  fontStyle?: 'normal' | 'italic'
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify'
  verticalAlign?: 'auto' | 'top' | 'bottom' | 'middle'
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center' // Android strictly
  includeFontPadding?: boolean
  textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through'
  textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed'
  textDecorationColor?: string
  textShadowColor?: string
  textShadowOffset?: { width: number; height: number }
  textShadowRadius?: number
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase'
  fontVariant?: FontVariant[]
  userSelect?: 'auto' | 'none' | 'text' | 'contain' | 'all'
  writingDirection?: 'auto' | 'ltr' | 'rtl'
}
