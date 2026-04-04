export type FlexAlignType = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'

export type Length = number | `${number}%` | `${number}px`
export type DimensionValue = Length | 'auto' | `${number}`

export interface FlexStyle {
  // Alignment & Flow
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around'
  alignItems?: FlexAlignType
  alignSelf?: 'auto' | FlexAlignType
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse'

  // Sizing
  flex?: number
  flexGrow?: number
  flexShrink?: number
  flexBasis?: DimensionValue

  // Dimensions
  width?: DimensionValue
  height?: DimensionValue
  minWidth?: DimensionValue
  minHeight?: DimensionValue
  maxWidth?: DimensionValue
  maxHeight?: DimensionValue
  aspectRatio?: number

  // Margins
  margin?: DimensionValue
  marginBottom?: DimensionValue
  marginHorizontal?: DimensionValue
  marginLeft?: DimensionValue
  marginRight?: DimensionValue
  marginTop?: DimensionValue
  marginVertical?: DimensionValue

  // Paddings
  padding?: DimensionValue
  paddingBottom?: DimensionValue
  paddingHorizontal?: DimensionValue
  paddingLeft?: DimensionValue
  paddingRight?: DimensionValue
  paddingTop?: DimensionValue
  paddingVertical?: DimensionValue

  // Borders (layout impacts)
  borderWidth?: number
  borderBottomWidth?: number
  borderLeftWidth?: number
  borderRightWidth?: number
  borderTopWidth?: number

  // Positioning
  position?: 'absolute' | 'relative'
  bottom?: DimensionValue
  left?: DimensionValue
  right?: DimensionValue
  top?: DimensionValue
  end?: DimensionValue
  start?: DimensionValue
  zIndex?: number

  // Gaps
  gap?: number
  rowGap?: number
  columnGap?: number

  display?: 'none' | 'flex' | 'contents'
  overflow?: 'visible' | 'hidden' | 'scroll'

  boxSizing?: 'border-box' | 'content-box'
}
