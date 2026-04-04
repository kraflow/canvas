import type { Node as YogaNode, Yoga } from 'yoga-layout/load'
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
 * Synchronizes a FlexStyle object to a Yoga layout node.
 *
 * This maps every layout-relevant property from the style to the corresponding
 * Yoga setter. Non-layout properties (colors, shadows, etc.) are ignored.
 *
 * Call this whenever a node's style changes to keep Yoga in sync.
 */
export function syncStyleToYoga(_yoga: Yoga, node: YogaNode, style: FlexStyle): void {
  // ── Display ────────────────────────────────────────────────────────────────
  if (style.display !== undefined) {
    const displayMap: Record<string, Display> = {
      flex: Display.Flex,
      none: Display.None,
      contents: Display.Contents,
    }
    node.setDisplay(displayMap[style.display] ?? Display.Flex)
  } else {
    node.setDisplay(Display.Flex)
  }

  // ── Direction ──────────────────────────────────────────────────────────────
  if (style.direction !== undefined) {
    const dirMap: Record<string, Direction> = {
      inherit: Direction.Inherit,
      ltr: Direction.LTR,
      rtl: Direction.RTL,
    }
    node.setDirection(dirMap[style.direction] ?? Direction.Inherit)
  } else {
    node.setDirection(Direction.Inherit)
  }

  // ── Flex direction ─────────────────────────────────────────────────────────
  if (style.flexDirection !== undefined) {
    const fdMap: Record<string, FlexDirection> = {
      column: FlexDirection.Column,
      'column-reverse': FlexDirection.ColumnReverse,
      row: FlexDirection.Row,
      'row-reverse': FlexDirection.RowReverse,
    }
    node.setFlexDirection(fdMap[style.flexDirection] ?? FlexDirection.Column)
  }

  // ── Flex wrap ──────────────────────────────────────────────────────────────
  if (style.flexWrap !== undefined) {
    const wrapMap: Record<string, Wrap> = {
      nowrap: Wrap.NoWrap,
      wrap: Wrap.Wrap,
      'wrap-reverse': Wrap.WrapReverse,
    }
    node.setFlexWrap(wrapMap[style.flexWrap] ?? Wrap.NoWrap)
  }

  // ── Justify content ────────────────────────────────────────────────────────
  if (style.justifyContent !== undefined) {
    const jcMap: Record<string, Justify> = {
      'flex-start': Justify.FlexStart,
      center: Justify.Center,
      'flex-end': Justify.FlexEnd,
      'space-between': Justify.SpaceBetween,
      'space-around': Justify.SpaceAround,
      'space-evenly': Justify.SpaceEvenly,
    }
    node.setJustifyContent(jcMap[style.justifyContent] ?? Justify.FlexStart)
  } else {
    node.setJustifyContent(Justify.FlexStart)
  }

  // ── Align items ────────────────────────────────────────────────────────────
  if (style.alignItems !== undefined) {
    node.setAlignItems(resolveAlign(style.alignItems))
  }

  // ── Align content ──────────────────────────────────────────────────────────
  if (style.alignContent !== undefined) {
    const acMap: Record<string, Align> = {
      'flex-start': Align.FlexStart,
      center: Align.Center,
      'flex-end': Align.FlexEnd,
      stretch: Align.Stretch,
      'space-between': Align.SpaceBetween,
      'space-around': Align.SpaceAround,
      'space-evenly': Align.SpaceEvenly,
    }
    node.setAlignContent(acMap[style.alignContent] ?? Align.FlexStart)
  }

  // ── Align self ─────────────────────────────────────────────────────────────
  if (style.alignSelf !== undefined) {
    node.setAlignSelf(resolveAlign(style.alignSelf))
  }

  // ── Flex (shorthand) ──────────────────────────────────────────────────────
  if (style.flex !== undefined) {
    node.setFlex(style.flex)
  }

  // ── Flex grow / shrink / basis ─────────────────────────────────────────────
  if (style.flexGrow !== undefined) node.setFlexGrow(style.flexGrow)
  if (style.flexShrink !== undefined) node.setFlexShrink(style.flexShrink)

  if (style.flexBasis !== undefined) {
    setDimensionAuto(
      node,
      'setFlexBasis',
      'setFlexBasisPercent',
      'setFlexBasisAuto',
      style.flexBasis,
    )
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────
  if (style.width !== undefined) {
    setDimensionAuto(node, 'setWidth', 'setWidthPercent', 'setWidthAuto', style.width)
  }
  if (style.height !== undefined) {
    setDimensionAuto(node, 'setHeight', 'setHeightPercent', 'setHeightAuto', style.height)
  }
  setDimension(node, 'setMinWidth', 'setMinWidthPercent', style.minWidth)
  setDimension(node, 'setMaxWidth', 'setMaxWidthPercent', style.maxWidth)
  setDimension(node, 'setMinHeight', 'setMinHeightPercent', style.minHeight)
  setDimension(node, 'setMaxHeight', 'setMaxHeightPercent', style.maxHeight)

  // ── Aspect ratio ──────────────────────────────────────────────────────────
  node.setAspectRatio(
    style.aspectRatio !== undefined
      ? typeof style.aspectRatio === 'string'
        ? parseAspectRatio(style.aspectRatio)
        : style.aspectRatio
      : NaN,
  )

  // ── Box sizing ─────────────────────────────────────────────────────────────
  if (style.boxSizing !== undefined) {
    node.setBoxSizing(
      style.boxSizing === 'content-box' ? BoxSizing.ContentBox : BoxSizing.BorderBox,
    )
  }

  // ── Position ──────────────────────────────────────────────────────────────
  if (style.position !== undefined) {
    const posMap: Record<string, PositionType> = {
      relative: PositionType.Relative,
      absolute: PositionType.Absolute,
      static: PositionType.Static,
    }
    node.setPositionType(posMap[style.position] ?? PositionType.Relative)
  } else {
    node.setPositionType(PositionType.Relative)
  }

  setEdgeDimension(node, 'setPosition', Edge.Top, style.top)
  setEdgeDimension(node, 'setPosition', Edge.Bottom, style.bottom)
  setEdgeDimension(node, 'setPosition', Edge.Left, style.left)
  setEdgeDimension(node, 'setPosition', Edge.Right, style.right)
  setEdgeDimension(node, 'setPosition', Edge.Start, style.start)
  setEdgeDimension(node, 'setPosition', Edge.End, style.end)

  // Logical Insets
  setEdgeDimension(node, 'setPosition', Edge.All, style.inset)
  setEdgeDimension(node, 'setPosition', Edge.Vertical, style.insetBlock)
  setEdgeDimension(node, 'setPosition', Edge.Top, style.insetBlockStart)
  setEdgeDimension(node, 'setPosition', Edge.Bottom, style.insetBlockEnd)
  setEdgeDimension(node, 'setPosition', Edge.Horizontal, style.insetInline)
  setEdgeDimension(node, 'setPosition', Edge.Start, style.insetInlineStart)
  setEdgeDimension(node, 'setPosition', Edge.End, style.insetInlineEnd)

  // ── Margin ─────────────────────────────────────────────────────────────────
  setEdgeMargin(node, Edge.All, style.margin)
  setEdgeMargin(node, Edge.Top, style.marginTop)
  setEdgeMargin(node, Edge.Bottom, style.marginBottom)
  setEdgeMargin(node, Edge.Left, style.marginLeft)
  setEdgeMargin(node, Edge.Right, style.marginRight)

  // Logical margins
  setEdgeMargin(node, Edge.Horizontal, style.marginHorizontal)
  setEdgeMargin(node, Edge.Vertical, style.marginVertical)
  setEdgeMargin(node, Edge.Start, style.marginStart)
  setEdgeMargin(node, Edge.End, style.marginEnd)

  // CSS mappings
  setEdgeMargin(node, Edge.Vertical, style.marginBlock)
  setEdgeMargin(node, Edge.Top, style.marginBlockStart)
  setEdgeMargin(node, Edge.Bottom, style.marginBlockEnd)
  setEdgeMargin(node, Edge.Horizontal, style.marginInline)
  setEdgeMargin(node, Edge.Start, style.marginInlineStart)
  setEdgeMargin(node, Edge.End, style.marginInlineEnd)

  // ── Padding ────────────────────────────────────────────────────────────────
  setEdgeDimension(node, 'setPadding', Edge.All, style.padding)
  setEdgeDimension(node, 'setPadding', Edge.Top, style.paddingTop)
  setEdgeDimension(node, 'setPadding', Edge.Bottom, style.paddingBottom)
  setEdgeDimension(node, 'setPadding', Edge.Left, style.paddingLeft)
  setEdgeDimension(node, 'setPadding', Edge.Right, style.paddingRight)

  // Logical paddings
  setEdgeDimension(node, 'setPadding', Edge.Horizontal, style.paddingHorizontal)
  setEdgeDimension(node, 'setPadding', Edge.Vertical, style.paddingVertical)
  setEdgeDimension(node, 'setPadding', Edge.Start, style.paddingStart)
  setEdgeDimension(node, 'setPadding', Edge.End, style.paddingEnd)

  // CSS mappings
  setEdgeDimension(node, 'setPadding', Edge.Vertical, style.paddingBlock)
  setEdgeDimension(node, 'setPadding', Edge.Top, style.paddingBlockStart)
  setEdgeDimension(node, 'setPadding', Edge.Bottom, style.paddingBlockEnd)
  setEdgeDimension(node, 'setPadding', Edge.Horizontal, style.paddingInline)
  setEdgeDimension(node, 'setPadding', Edge.Start, style.paddingInlineStart)
  setEdgeDimension(node, 'setPadding', Edge.End, style.paddingInlineEnd)

  // ── Border widths (layout contribution) ───────────────────────────────────
  node.setBorder(Edge.All, toNum(style.borderWidth) ?? NaN)
  node.setBorder(Edge.Top, toNum(style.borderTopWidth) ?? NaN)
  node.setBorder(Edge.Bottom, toNum(style.borderBottomWidth) ?? NaN)
  node.setBorder(Edge.Left, toNum(style.borderLeftWidth) ?? NaN)
  node.setBorder(Edge.Right, toNum(style.borderRightWidth) ?? NaN)
  node.setBorder(Edge.Start, toNum(style.borderStartWidth) ?? NaN)
  node.setBorder(Edge.End, toNum(style.borderEndWidth) ?? NaN)

  // ── Gap ────────────────────────────────────────────────────────────────────
  setGapDimension(node, Gutter.All, style.gap)
  setGapDimension(node, Gutter.Row, style.rowGap)
  setGapDimension(node, Gutter.Column, style.columnGap)

  // ── Overflow ──────────────────────────────────────────────────────────────
  if (style.overflow !== undefined) {
    const ovMap: Record<string, Overflow> = {
      visible: Overflow.Visible,
      hidden: Overflow.Hidden,
      scroll: Overflow.Scroll,
    }
    node.setOverflow(ovMap[style.overflow] ?? Overflow.Visible)
  }
}

// =============================================================================
// Helpers
// =============================================================================

function resolveAlign(value: string): Align {
  const map: Record<string, Align> = {
    auto: Align.Auto,
    'flex-start': Align.FlexStart,
    center: Align.Center,
    'flex-end': Align.FlexEnd,
    stretch: Align.Stretch,
    baseline: Align.Baseline,
  }
  return map[value] ?? Align.Auto
}

/**
 * Sets a dimension property that supports number, 'auto', and '%' values.
 */
function setDimensionAuto(
  node: YogaNode,
  pointFn: 'setWidth' | 'setHeight' | 'setFlexBasis',
  percentFn: 'setWidthPercent' | 'setHeightPercent' | 'setFlexBasisPercent',
  autoFn: 'setWidthAuto' | 'setHeightAuto' | 'setFlexBasisAuto',
  value: DimensionValue,
): void {
  if (value === null || value === undefined || value === 'auto') {
    node[autoFn]()
    return
  }
  if (typeof value === 'number') {
    node[pointFn](value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    node[percentFn](parseFloat(value))
    return
  }
  // Fallback: parse as number
  const n = parseFloat(value as string)
  if (!Number.isNaN(n)) node[pointFn](n)
  else node[autoFn]()
}

/**
 * Sets a dimension property that supports number and '%' values (no 'auto').
 */
function setDimension(
  node: YogaNode,
  pointFn: 'setMinWidth' | 'setMaxWidth' | 'setMinHeight' | 'setMaxHeight',
  percentFn:
    | 'setMinWidthPercent'
    | 'setMaxWidthPercent'
    | 'setMinHeightPercent'
    | 'setMaxHeightPercent',
  value: DimensionValue,
): void {
  if (value === null || value === undefined) {
    node[pointFn](NaN)
    return
  }
  if (typeof value === 'number') {
    node[pointFn](value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    node[percentFn](parseFloat(value))
    return
  }
  const n = parseFloat(value as string)
  if (!Number.isNaN(n)) node[pointFn](n)
  else node[pointFn](NaN)
}

/**
 * Sets an edge-based dimension (position, padding) that supports number and '%'.
 */
function setEdgeDimension(
  node: YogaNode,
  fn: 'setPosition' | 'setPadding',
  edge: Edge,
  value: DimensionValue,
): void {
  if (value === null || value === undefined) {
    node[fn](edge, NaN)
    return
  }
  if (typeof value === 'number') {
    node[fn](edge, value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    node[fn](edge, `${parseFloat(value)}%` as `${number}%`)
    return
  }
  const n = parseFloat(value as string)
  node[fn](edge, Number.isNaN(n) ? NaN : n)
}

/**
 * Sets margin (supports number, '%', and 'auto').
 */
function setEdgeMargin(node: YogaNode, edge: Edge, value: DimensionValue): void {
  if (value === null || value === undefined) {
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
  if (typeof value === 'string' && value.endsWith('%')) {
    node.setMargin(edge, `${parseFloat(value)}%` as `${number}%`)
    return
  }
  const n = parseFloat(value as string)
  node.setMargin(edge, Number.isNaN(n) ? NaN : n)
}

/**
 * Sets gap (supports number and '%').
 */
function setGapDimension(node: YogaNode, gutter: Gutter, value: DimensionValue): void {
  if (value === null || value === undefined) {
    node.setGap(gutter, NaN)
    return
  }
  if (typeof value === 'number') {
    node.setGap(gutter, value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    // If Yoga supports setGapPercent, use it. Otherwise fallback to setGap.
    const val = parseFloat(value)
    if (
      'setGapPercent' in node &&
      typeof (node as { setGapPercent: (gutter: Gutter, value: number) => void }).setGapPercent ===
        'function'
    ) {
      ;(node as { setGapPercent: (gutter: Gutter, value: number) => void }).setGapPercent(
        gutter,
        val,
      )
    } else {
      node.setGap(gutter, val)
    }
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
  if (value.includes('/')) {
    const [a, b] = value.split('/')
    const na = parseFloat(a!)
    const nb = parseFloat(b!)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && nb !== 0) return na / nb
  }
  return parseFloat(value) || 1
}
