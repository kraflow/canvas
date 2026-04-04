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
  }

  // ── Direction ──────────────────────────────────────────────────────────────
  if (style.direction !== undefined) {
    const dirMap: Record<string, Direction> = {
      inherit: Direction.Inherit,
      ltr: Direction.LTR,
      rtl: Direction.RTL,
    }
    node.setDirection(dirMap[style.direction] ?? Direction.Inherit)
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
  if (style.minWidth !== undefined) {
    setDimension(node, 'setMinWidth', 'setMinWidthPercent', style.minWidth)
  }
  if (style.maxWidth !== undefined) {
    setDimension(node, 'setMaxWidth', 'setMaxWidthPercent', style.maxWidth)
  }
  if (style.minHeight !== undefined) {
    setDimension(node, 'setMinHeight', 'setMinHeightPercent', style.minHeight)
  }
  if (style.maxHeight !== undefined) {
    setDimension(node, 'setMaxHeight', 'setMaxHeightPercent', style.maxHeight)
  }

  // ── Aspect ratio ──────────────────────────────────────────────────────────
  if (style.aspectRatio !== undefined) {
    const ratio =
      typeof style.aspectRatio === 'string'
        ? parseAspectRatio(style.aspectRatio)
        : style.aspectRatio
    node.setAspectRatio(ratio)
  }

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
  }

  setEdgeDimension(node, 'setPosition', Edge.Top, style.top)
  setEdgeDimension(node, 'setPosition', Edge.Bottom, style.bottom)
  setEdgeDimension(node, 'setPosition', Edge.Left, style.left)
  setEdgeDimension(node, 'setPosition', Edge.Right, style.right)

  // ── Margin ─────────────────────────────────────────────────────────────────
  setEdgeMargin(node, Edge.All, style.margin)
  setEdgeMargin(node, Edge.Top, style.marginTop)
  setEdgeMargin(node, Edge.Bottom, style.marginBottom)
  setEdgeMargin(node, Edge.Left, style.marginLeft)
  setEdgeMargin(node, Edge.Right, style.marginRight)

  // ── Padding ────────────────────────────────────────────────────────────────
  setEdgeDimension(node, 'setPadding', Edge.All, style.padding)
  setEdgeDimension(node, 'setPadding', Edge.Top, style.paddingTop)
  setEdgeDimension(node, 'setPadding', Edge.Bottom, style.paddingBottom)
  setEdgeDimension(node, 'setPadding', Edge.Left, style.paddingLeft)
  setEdgeDimension(node, 'setPadding', Edge.Right, style.paddingRight)

  // ── Border widths (layout contribution) ───────────────────────────────────
  if (style.borderWidth !== undefined) {
    node.setBorder(Edge.All, toNum(style.borderWidth))
  }
  if (style.borderTopWidth !== undefined) {
    node.setBorder(Edge.Top, toNum(style.borderTopWidth))
  }
  if (style.borderBottomWidth !== undefined) {
    node.setBorder(Edge.Bottom, toNum(style.borderBottomWidth))
  }
  if (style.borderLeftWidth !== undefined) {
    node.setBorder(Edge.Left, toNum(style.borderLeftWidth))
  }
  if (style.borderRightWidth !== undefined) {
    node.setBorder(Edge.Right, toNum(style.borderRightWidth))
  }

  // ── Gap ────────────────────────────────────────────────────────────────────
  if (style.gap !== undefined) node.setGap(Gutter.All, style.gap)
  if (style.rowGap !== undefined) node.setGap(Gutter.Row, style.rowGap)
  if (style.columnGap !== undefined) node.setGap(Gutter.Column, style.columnGap)

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
  if (value === null || value === undefined) return
  if (value === 'auto') {
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
  if (value === null || value === undefined) return
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
  if (value === null || value === undefined) return
  if (typeof value === 'number') {
    node[fn](edge, value)
    return
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    node[fn](edge, `${parseFloat(value)}%` as `${number}%`)
    return
  }
  const n = parseFloat(value as string)
  if (!Number.isNaN(n)) node[fn](edge, n)
}

/**
 * Sets margin (supports number, '%', and 'auto').
 */
function setEdgeMargin(node: YogaNode, edge: Edge, value: DimensionValue): void {
  if (value === null || value === undefined) return
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
  if (!Number.isNaN(n)) node.setMargin(edge, n)
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
