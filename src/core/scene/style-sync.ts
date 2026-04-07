import type { Node as YogaNode } from 'yoga-layout/load'
import {
  Align,
  Direction,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Wrap,
  BoxSizing,
} from 'yoga-layout/load'
import type { FlexStyle, DimensionValue } from '@/core/styles/types/flex'

/**
 * Full sync of a style object to a Yoga node.
 *
 * Every property is always written — absent properties are reset to the
 * Yoga default. This is required because Yoga does not reset properties
 * automatically when a style is replaced.
 */
export function syncStyleToYoga(node: YogaNode, style: FlexStyle): void {
  // ── Display ────────────────────────────────────────────────────────────────
  node.setDisplay(DISPLAY[style.display!] ?? Display.Flex)

  // ── Direction ──────────────────────────────────────────────────────────────
  node.setDirection(DIRECTION[style.direction!] ?? Direction.Inherit)

  // ── Flex direction ─────────────────────────────────────────────────────────
  node.setFlexDirection(FLEX_DIR[style.flexDirection!] ?? FlexDirection.Column)

  // ── Flex wrap ──────────────────────────────────────────────────────────────
  node.setFlexWrap(WRAP[style.flexWrap!] ?? Wrap.NoWrap)

  // ── Justify content ────────────────────────────────────────────────────────
  node.setJustifyContent(JUSTIFY[style.justifyContent!] ?? Justify.FlexStart)

  // ── Align items / content / self ──────────────────────────────────────────
  node.setAlignItems(ALIGN[style.alignItems!] ?? Align.Stretch)
  node.setAlignContent(ALIGN_CONTENT[style.alignContent!] ?? Align.FlexStart)
  node.setAlignSelf(ALIGN[style.alignSelf!] ?? Align.Auto)

  // ── Flex ───────────────────────────────────────────────────────────────────
  node.setFlex(style.flex !== undefined ? style.flex : NaN)
  node.setFlexGrow(style.flexGrow !== undefined ? style.flexGrow : 0)
  node.setFlexShrink(style.flexShrink !== undefined ? style.flexShrink : 1)
  setDimAuto(node, 'setFlexBasis', 'setFlexBasisPercent', 'setFlexBasisAuto', style.flexBasis)

  // ── Sizing ─────────────────────────────────────────────────────────────────
  setDimAuto(node, 'setWidth', 'setWidthPercent', 'setWidthAuto', style.width)
  setDimAuto(node, 'setHeight', 'setHeightPercent', 'setHeightAuto', style.height)
  setDim(node, 'setMinWidth', 'setMinWidthPercent', style.minWidth)
  setDim(node, 'setMaxWidth', 'setMaxWidthPercent', style.maxWidth)
  setDim(node, 'setMinHeight', 'setMinHeightPercent', style.minHeight)
  setDim(node, 'setMaxHeight', 'setMaxHeightPercent', style.maxHeight)

  // ── Aspect ratio ──────────────────────────────────────────────────────────
  node.setAspectRatio(
    style.aspectRatio !== undefined
      ? typeof style.aspectRatio === 'string'
        ? parseAspectRatio(style.aspectRatio)
        : style.aspectRatio
      : NaN,
  )

  // ── Box sizing ─────────────────────────────────────────────────────────────
  node.setBoxSizing(style.boxSizing === 'content-box' ? BoxSizing.ContentBox : BoxSizing.BorderBox)

  // ── Position ──────────────────────────────────────────────────────────────
  node.setPositionType(POS_TYPE[style.position!] ?? PositionType.Relative)
  setEdgeDim(node, 'setPosition', Edge.Top, style.top ?? style.insetBlockStart ?? style.inset)
  setEdgeDim(node, 'setPosition', Edge.Bottom, style.bottom ?? style.insetBlockEnd ?? style.inset)
  setEdgeDim(node, 'setPosition', Edge.Left, style.left ?? style.inset)
  setEdgeDim(node, 'setPosition', Edge.Right, style.right ?? style.inset)
  setEdgeDim(node, 'setPosition', Edge.Start, style.start ?? style.insetInlineStart)
  setEdgeDim(node, 'setPosition', Edge.End, style.end ?? style.insetInlineEnd)
  setEdgeDim(node, 'setPosition', Edge.Horizontal, style.insetInline)
  setEdgeDim(node, 'setPosition', Edge.Vertical, style.insetBlock)

  // ── Margin ─────────────────────────────────────────────────────────────────
  setEdgeMargin(
    node,
    Edge.Top,
    style.marginTop ??
      style.marginBlockStart ??
      style.marginVertical ??
      style.marginBlock ??
      style.margin,
  )
  setEdgeMargin(
    node,
    Edge.Bottom,
    style.marginBottom ??
      style.marginBlockEnd ??
      style.marginVertical ??
      style.marginBlock ??
      style.margin,
  )
  setEdgeMargin(
    node,
    Edge.Left,
    style.marginLeft ?? style.marginHorizontal ?? style.marginInline ?? style.margin,
  )
  setEdgeMargin(
    node,
    Edge.Right,
    style.marginRight ?? style.marginHorizontal ?? style.marginInline ?? style.margin,
  )
  setEdgeMargin(node, Edge.Start, style.marginStart ?? style.marginInlineStart)
  setEdgeMargin(node, Edge.End, style.marginEnd ?? style.marginInlineEnd)

  // ── Padding ────────────────────────────────────────────────────────────────
  setEdgeDim(
    node,
    'setPadding',
    Edge.Top,
    style.paddingTop ??
      style.paddingBlockStart ??
      style.paddingVertical ??
      style.paddingBlock ??
      style.padding,
  )
  setEdgeDim(
    node,
    'setPadding',
    Edge.Bottom,
    style.paddingBottom ??
      style.paddingBlockEnd ??
      style.paddingVertical ??
      style.paddingBlock ??
      style.padding,
  )
  setEdgeDim(
    node,
    'setPadding',
    Edge.Left,
    style.paddingLeft ?? style.paddingHorizontal ?? style.paddingInline ?? style.padding,
  )
  setEdgeDim(
    node,
    'setPadding',
    Edge.Right,
    style.paddingRight ?? style.paddingHorizontal ?? style.paddingInline ?? style.padding,
  )
  setEdgeDim(node, 'setPadding', Edge.Start, style.paddingStart ?? style.paddingInlineStart)
  setEdgeDim(node, 'setPadding', Edge.End, style.paddingEnd ?? style.paddingInlineEnd)

  // ── Border ─────────────────────────────────────────────────────────────────
  node.setBorder(Edge.All, toNum(style.borderWidth) ?? NaN)
  node.setBorder(Edge.Top, toNum(style.borderTopWidth) ?? NaN)
  node.setBorder(Edge.Bottom, toNum(style.borderBottomWidth) ?? NaN)
  node.setBorder(Edge.Left, toNum(style.borderLeftWidth) ?? NaN)
  node.setBorder(Edge.Right, toNum(style.borderRightWidth) ?? NaN)
  node.setBorder(Edge.Start, toNum(style.borderStartWidth) ?? NaN)
  node.setBorder(Edge.End, toNum(style.borderEndWidth) ?? NaN)

  // ── Gap ────────────────────────────────────────────────────────────────────
  setGap(node, Gutter.All, style.gap)
  setGap(node, Gutter.Row, style.rowGap)
  setGap(node, Gutter.Column, style.columnGap)

  // ── Overflow ──────────────────────────────────────────────────────────────
  node.setOverflow(OVERFLOW[style.overflow!] ?? Overflow.Visible)
}

// =============================================================================
// Lookup tables (allocated once, avoids per-call string comparisons in hot path)
// =============================================================================

const DISPLAY: Record<string, Display> = {
  flex: Display.Flex,
  none: Display.None,
  contents: Display.Contents,
}
const DIRECTION: Record<string, Direction> = {
  inherit: Direction.Inherit,
  ltr: Direction.LTR,
  rtl: Direction.RTL,
}
const FLEX_DIR: Record<string, FlexDirection> = {
  column: FlexDirection.Column,
  'column-reverse': FlexDirection.ColumnReverse,
  row: FlexDirection.Row,
  'row-reverse': FlexDirection.RowReverse,
}
const WRAP: Record<string, Wrap> = {
  nowrap: Wrap.NoWrap,
  wrap: Wrap.Wrap,
  'wrap-reverse': Wrap.WrapReverse,
}
const JUSTIFY: Record<string, Justify> = {
  'flex-start': Justify.FlexStart,
  center: Justify.Center,
  'flex-end': Justify.FlexEnd,
  'space-between': Justify.SpaceBetween,
  'space-around': Justify.SpaceAround,
  'space-evenly': Justify.SpaceEvenly,
}
const ALIGN: Record<string, Align> = {
  auto: Align.Auto,
  'flex-start': Align.FlexStart,
  center: Align.Center,
  'flex-end': Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
}
const ALIGN_CONTENT: Record<string, Align> = {
  'flex-start': Align.FlexStart,
  center: Align.Center,
  'flex-end': Align.FlexEnd,
  stretch: Align.Stretch,
  'space-between': Align.SpaceBetween,
  'space-around': Align.SpaceAround,
  'space-evenly': Align.SpaceEvenly,
}
const POS_TYPE: Record<string, PositionType> = {
  relative: PositionType.Relative,
  absolute: PositionType.Absolute,
  static: PositionType.Static,
}
const OVERFLOW: Record<string, Overflow> = {
  visible: Overflow.Visible,
  hidden: Overflow.Hidden,
  scroll: Overflow.Scroll,
}

// =============================================================================
// Dimension helpers
// =============================================================================

type PointFnAuto = 'setWidth' | 'setHeight' | 'setFlexBasis'
type PctFnAuto = 'setWidthPercent' | 'setHeightPercent' | 'setFlexBasisPercent'
type AutoFn = 'setWidthAuto' | 'setHeightAuto' | 'setFlexBasisAuto'
type PointFn = 'setMinWidth' | 'setMaxWidth' | 'setMinHeight' | 'setMaxHeight'
type PctFn =
  | 'setMinWidthPercent'
  | 'setMaxWidthPercent'
  | 'setMinHeightPercent'
  | 'setMaxHeightPercent'
type EdgeFn = 'setPosition' | 'setPadding'

function setDimAuto(
  node: YogaNode,
  pt: PointFnAuto,
  pct: PctFnAuto,
  auto: AutoFn,
  value: DimensionValue,
): void {
  if (value == null || value === 'auto') {
    node[auto]()
    return
  }
  if (typeof value === 'number') {
    node[pt](value)
    return
  }
  if (value.endsWith('%')) {
    node[pct](parseFloat(value))
    return
  }
  const n = parseFloat(value)
  if (!Number.isNaN(n)) node[pt](n)
  else node[auto]()
}

function setDim(node: YogaNode, pt: PointFn, pct: PctFn, value: DimensionValue): void {
  if (value == null) {
    node[pt](NaN)
    return
  }
  if (typeof value === 'number') {
    node[pt](value)
    return
  }
  if (value.endsWith('%')) {
    node[pct](parseFloat(value))
    return
  }
  const n = parseFloat(value)
  node[pt](Number.isNaN(n) ? NaN : n)
}

function setEdgeDim(node: YogaNode, fn: EdgeFn, edge: Edge, value: DimensionValue): void {
  if (value == null) {
    node[fn](edge, NaN)
    return
  }
  if (typeof value === 'number') {
    node[fn](edge, value)
    return
  }
  if (value.endsWith('%')) {
    node[fn](edge, `${parseFloat(value)}%` as `${number}%`)
    return
  }
  const n = parseFloat(value)
  node[fn](edge, Number.isNaN(n) ? NaN : n)
}

function setEdgeMargin(node: YogaNode, edge: Edge, value: DimensionValue): void {
  if (value == null) {
    node.setMargin(edge, NaN)
    return
  }
  if (value === 'auto') {
    node.setMarginAuto(edge)
    return
  }
  if (typeof value === 'number') {
    node.setMargin(edge, value)
    return
  }
  if (value.endsWith('%')) {
    node.setMargin(edge, `${parseFloat(value)}%` as `${number}%`)
    return
  }
  const n = parseFloat(value)
  node.setMargin(edge, Number.isNaN(n) ? NaN : n)
}

function setGap(node: YogaNode, gutter: Gutter, value: DimensionValue): void {
  if (value == null) {
    node.setGap(gutter, NaN)
    return
  }
  if (typeof value === 'number') {
    node.setGap(gutter, value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    node.setGap(gutter, parseFloat(value))
    return
  }
  const n = parseFloat(value as string)
  node.setGap(gutter, Number.isNaN(n) ? NaN : n)
}

function toNum(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value
  const n = parseFloat(value)
  return Number.isNaN(n) ? undefined : n
}

function parseAspectRatio(value: string): number {
  const slash = value.indexOf('/')
  if (slash !== -1) {
    const a = parseFloat(value),
      b = parseFloat(value.slice(slash + 1))
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) return a / b
  }
  return parseFloat(value) || NaN
}
