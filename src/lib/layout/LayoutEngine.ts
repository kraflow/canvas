import {
  type Node as YogaNode,
  FlexDirection,
  Justify,
  Align,
  Wrap,
  PositionType,
  Overflow,
  Display,
  Edge,
  Gutter,
  BoxSizing,
} from 'yoga-layout'
import type { FlexStyle } from '../styles/types'

/* ============================================================
 * Yoga defaults — used by resetAllProperties()
 * These match Yoga's internal defaults exactly so a reset node
 * behaves identically to a freshly created one.
 * ============================================================ */
const ALL_EDGES = [
  Edge.Top,
  Edge.Right,
  Edge.Bottom,
  Edge.Left,
  Edge.Start,
  Edge.End,
  Edge.All,
  Edge.Horizontal,
  Edge.Vertical,
] as const

export function resetAllProperties(yn: YogaNode): void {
  // dimensions
  yn.setWidthAuto()
  yn.setHeightAuto()
  yn.setMinWidth(NaN)
  yn.setMinHeight(NaN)
  yn.setMaxWidth(NaN)
  yn.setMaxHeight(NaN)

  // flex
  yn.setFlex(NaN)
  yn.setFlexGrow(NaN)
  yn.setFlexShrink(NaN)
  yn.setFlexBasisAuto()
  yn.setFlexDirection(FlexDirection.Column)
  yn.setFlexWrap(Wrap.NoWrap)

  // alignment
  yn.setJustifyContent(Justify.FlexStart)
  yn.setAlignItems(Align.Stretch)
  yn.setAlignSelf(Align.Auto)
  yn.setAlignContent(Align.FlexStart)

  // position
  yn.setPositionType(PositionType.Relative)
  for (const edge of ALL_EDGES) {
    yn.setPosition(edge, NaN)
  }

  // spacing
  for (const edge of ALL_EDGES) {
    yn.setMargin(edge, NaN)
    yn.setPadding(edge, NaN)
  }

  yn.setBoxSizing(BoxSizing.BorderBox)

  // gap
  yn.setGap(Gutter.All, NaN)

  // misc
  yn.setDisplay(Display.Flex)
  yn.setOverflow(Overflow.Visible)
}

/* ============================================================
 * Style → Yoga property mapping
 * Only FlexStyle properties. Visual styles (color, border, etc.)
 * are StyleResolver's responsibility.
 * ============================================================ */
function parseLength(value: number | string): number | 'auto' | `${number}%` {
  if (typeof value === 'number') return value
  if (value === 'auto') return 'auto'
  if (value.endsWith('%')) return value as `${number}%`
  if (value.endsWith('px')) return parseFloat(value)
  return parseFloat(value)
}

export function applyFlexStyle(yn: YogaNode, style: FlexStyle): void {
  if (style.boxSizing !== undefined) {
    yn.setBoxSizing(style.boxSizing === 'content-box' ? BoxSizing.ContentBox : BoxSizing.BorderBox)
  }

  // --- dimensions ---
  if (style.width !== undefined) {
    const v = parseLength(style.width as string | number)
    if (v === 'auto') yn.setWidthAuto()
    else if (typeof v === 'string') yn.setWidthPercent(parseFloat(v))
    else yn.setWidth(v)
  }
  if (style.height !== undefined) {
    const v = parseLength(style.height as string | number)
    if (v === 'auto') yn.setHeightAuto()
    else if (typeof v === 'string') yn.setHeightPercent(parseFloat(v))
    else yn.setHeight(v)
  }
  if (style.minWidth !== undefined) {
    const v = parseLength(style.minWidth as string | number)
    if (typeof v === 'string') yn.setMinWidthPercent(parseFloat(v))
    else yn.setMinWidth(v)
  }
  if (style.minHeight !== undefined) {
    const v = parseLength(style.minHeight as string | number)
    if (typeof v === 'string') yn.setMinHeightPercent(parseFloat(v))
    else yn.setMinHeight(v)
  }
  if (style.maxWidth !== undefined) {
    const v = parseLength(style.maxWidth as string | number)
    if (typeof v === 'string') yn.setMaxWidthPercent(parseFloat(v))
    else yn.setMaxWidth(v)
  }
  if (style.maxHeight !== undefined) {
    const v = parseLength(style.maxHeight as string | number)
    if (typeof v === 'string') yn.setMaxHeightPercent(parseFloat(v))
    else yn.setMaxHeight(v)
  }

  // --- flex ---
  if (style.flex !== undefined) yn.setFlex(style.flex)
  if (style.flexGrow !== undefined) yn.setFlexGrow(style.flexGrow)
  if (style.flexShrink !== undefined) yn.setFlexShrink(style.flexShrink)
  if (style.flexBasis !== undefined) {
    const v = parseLength(style.flexBasis as string | number)
    if (v === 'auto') yn.setFlexBasisAuto()
    else if (typeof v === 'string') yn.setFlexBasisPercent(parseFloat(v))
    else yn.setFlexBasis(v)
  }

  // --- flex container ---
  if (style.flexDirection !== undefined) {
    yn.setFlexDirection(
      {
        row: FlexDirection.Row,
        'row-reverse': FlexDirection.RowReverse,
        column: FlexDirection.Column,
        'column-reverse': FlexDirection.ColumnReverse,
      }[style.flexDirection] ?? FlexDirection.Column,
    )
  }
  if (style.flexWrap !== undefined) {
    yn.setFlexWrap(
      {
        nowrap: Wrap.NoWrap,
        wrap: Wrap.Wrap,
        'wrap-reverse': Wrap.WrapReverse,
      }[style.flexWrap] ?? Wrap.NoWrap,
    )
  }
  if (style.justifyContent !== undefined) {
    yn.setJustifyContent(
      {
        'flex-start': Justify.FlexStart,
        'flex-end': Justify.FlexEnd,
        center: Justify.Center,
        'space-between': Justify.SpaceBetween,
        'space-around': Justify.SpaceAround,
        'space-evenly': Justify.SpaceEvenly,
      }[style.justifyContent] ?? Justify.FlexStart,
    )
  }
  if (style.alignItems !== undefined) {
    yn.setAlignItems(
      {
        'flex-start': Align.FlexStart,
        'flex-end': Align.FlexEnd,
        center: Align.Center,
        stretch: Align.Stretch,
        baseline: Align.Baseline,
      }[style.alignItems] ?? Align.Stretch,
    )
  }
  if (style.alignSelf !== undefined) {
    yn.setAlignSelf(
      {
        auto: Align.Auto,
        'flex-start': Align.FlexStart,
        'flex-end': Align.FlexEnd,
        center: Align.Center,
        stretch: Align.Stretch,
        baseline: Align.Baseline,
      }[style.alignSelf] ?? Align.Auto,
    )
  }
  if (style.alignContent !== undefined) {
    yn.setAlignContent(
      {
        'flex-start': Align.FlexStart,
        'flex-end': Align.FlexEnd,
        center: Align.Center,
        stretch: Align.Stretch,
        'space-between': Align.SpaceBetween,
        'space-around': Align.SpaceAround,
        'space-evenly': Align.SpaceEvenly,
      }[style.alignContent] ?? Align.FlexStart,
    )
  }

  // --- position ---
  if (style.position !== undefined) {
    yn.setPositionType(
      style.position === 'absolute' ? PositionType.Absolute : PositionType.Relative,
    )
  }
  if (style.top !== undefined)
    yn.setPosition(Edge.Top, parseLength(style.top as string | number) as number)
  if (style.right !== undefined)
    yn.setPosition(Edge.Right, parseLength(style.right as string | number) as number)
  if (style.bottom !== undefined)
    yn.setPosition(Edge.Bottom, parseLength(style.bottom as string | number) as number)
  if (style.left !== undefined)
    yn.setPosition(Edge.Left, parseLength(style.left as string | number) as number)
  if (style.start !== undefined)
    yn.setPosition(Edge.Start, parseLength(style.start as string | number) as number)
  if (style.end !== undefined)
    yn.setPosition(Edge.End, parseLength(style.end as string | number) as number)

  // --- margin (shorthands first, then per-edge overrides) ---
  const setMargin = (edge: Edge, value: number | string | undefined) => {
    if (value === undefined) return
    const v = parseLength(value as string | number)
    if (v === 'auto') yn.setMarginAuto(edge)
    else if (typeof v === 'string') yn.setMarginPercent(edge, parseFloat(v))
    else yn.setMargin(edge, v)
  }
  setMargin(Edge.All, style.margin)
  setMargin(Edge.Vertical, style.marginVertical)
  setMargin(Edge.Horizontal, style.marginHorizontal)
  setMargin(Edge.Top, style.marginTop)
  setMargin(Edge.Right, style.marginRight)
  setMargin(Edge.Bottom, style.marginBottom)
  setMargin(Edge.Left, style.marginLeft)
  setMargin(Edge.Start, style.marginStart)
  setMargin(Edge.End, style.marginEnd)

  // --- padding (shorthands first, then per-edge overrides) ---
  const setPadding = (edge: Edge, value: number | string | undefined) => {
    if (value === undefined) return
    const v = parseLength(value as string | number)
    if (typeof v === 'string') yn.setPaddingPercent(edge, parseFloat(v))
    else yn.setPadding(edge, v)
  }
  setPadding(Edge.All, style.padding)
  setPadding(Edge.Vertical, style.paddingVertical)
  setPadding(Edge.Horizontal, style.paddingHorizontal)
  setPadding(Edge.Top, style.paddingTop)
  setPadding(Edge.Right, style.paddingRight)
  setPadding(Edge.Bottom, style.paddingBottom)
  setPadding(Edge.Left, style.paddingLeft)
  setPadding(Edge.Start, style.paddingStart)
  setPadding(Edge.End, style.paddingEnd)

  // --- gap ---
  if (style.gap !== undefined) yn.setGap(Gutter.All, style.gap)
  if (style.rowGap !== undefined) yn.setGap(Gutter.Row, style.rowGap)
  if (style.columnGap !== undefined) yn.setGap(Gutter.Column, style.columnGap)

  // --- display / overflow ---
  if (style.display !== undefined) {
    yn.setDisplay(style.display === 'none' ? Display.None : Display.Flex)
  }
  if (style.overflow !== undefined) {
    yn.setOverflow(
      {
        visible: Overflow.Visible,
        hidden: Overflow.Hidden,
        scroll: Overflow.Scroll,
      }[style.overflow] ?? Overflow.Visible,
    )
  }
}
