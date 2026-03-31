import Yoga, {
  type Config,
  type Node as YogaNode,
  Direction,
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
import type { LayoutRect } from '../render/NodeRender'

/* ============================================================
 * Internal node record
 * ============================================================ */
interface LayoutNode {
  id: string
  yogaNode: YogaNode
  children: string[]
  parentId: string | null
}

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

function resetAllProperties(yn: YogaNode): void {
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

function applyFlexStyle(yn: YogaNode, style: FlexStyle): void {
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

/* ============================================================
 * LayoutEngine
 * ============================================================ */
export class LayoutEngine {
  private config: Config
  private nodes = new Map<string, LayoutNode>()
  private roots = new Set<string>()

  constructor(pixelRatio: number) {
    this.config = Yoga.Config.create()
    this.config.setPointScaleFactor(pixelRatio) // we work in logical pixels
  }

  setPixelRatio(ratio: number) {
    this.config.setPointScaleFactor(ratio)
  }

  /* ----------------------------------------------------------
   * createNode
   * Allocates a Yoga node, applies style, registers with id.
   * Throws if id already exists.
   * ---------------------------------------------------------- */
  createNode(id: string, style: FlexStyle = {}): this {
    if (this.nodes.has(id)) {
      throw new Error(
        `LayoutEngine.createNode: "${id}" already exists. ` +
          `Use updateNode() to restyle or destroyNode() to recreate.`,
      )
    }
    const yogaNode = Yoga.Node.createWithConfig(this.config)
    applyFlexStyle(yogaNode, style)
    this.nodes.set(id, { id, yogaNode, children: [], parentId: null })
    this.roots.add(id)
    return this
  }

  /* ----------------------------------------------------------
   * updateNode
   * Merges new style properties into an existing node.
   * Only the properties present in style are changed —
   * everything else stays as-is.
   * Use resetNode() to wipe all properties first.
   * ---------------------------------------------------------- */
  updateNode(id: string, style: FlexStyle): this {
    applyFlexStyle(this.get(id).yogaNode, style)
    return this
  }

  /* ----------------------------------------------------------
   * resetNode
   * Resets ALL layout properties to Yoga defaults, then applies
   * the new style from scratch. This is the correct way to
   * remove previously set properties.
   *
   * updateNode({ flex: 1 })  →  only sets flex, leaves margin etc.
   * resetNode({ flex: 1 })   →  clears everything, then sets flex
   * resetNode({})             →  clears everything, plain default node
   * ---------------------------------------------------------- */
  resetNode(id: string, style: FlexStyle = {}): this {
    const { yogaNode } = this.get(id)
    resetAllProperties(yogaNode)
    applyFlexStyle(yogaNode, style)
    return this
  }

  /* ----------------------------------------------------------
   * appendChild
   * Appends childId as the last child of parentId.
   * ---------------------------------------------------------- */
  appendChild(parentId: string, childId: string): this {
    const parent = this.get(parentId)
    const child = this.get(childId)

    if (child.parentId !== null) {
      throw new Error(
        `LayoutEngine.appendChild: "${childId}" already has parent "${child.parentId}". ` +
          `Call removeChild() first.`,
      )
    }

    parent.yogaNode.insertChild(child.yogaNode, parent.children.length)
    parent.children.push(childId)
    child.parentId = parentId
    this.roots.delete(childId)
    return this
  }

  /* ----------------------------------------------------------
   * insertChild
   * Inserts childId at a specific index under parentId.
   * ---------------------------------------------------------- */
  insertChild(parentId: string, childId: string, index: number): this {
    const parent = this.get(parentId)
    const child = this.get(childId)

    if (child.parentId !== null) {
      throw new Error(
        `LayoutEngine.insertChild: "${childId}" already has parent "${child.parentId}". ` +
          `Call removeChild() first.`,
      )
    }

    const clampedIndex = Math.max(0, Math.min(index, parent.children.length))
    parent.yogaNode.insertChild(child.yogaNode, clampedIndex)
    parent.children.splice(clampedIndex, 0, childId)
    child.parentId = parentId
    this.roots.delete(childId)
    return this
  }

  /* ----------------------------------------------------------
   * removeChild
   * Detaches childId from its parent. Does NOT destroy it —
   * the node stays registered and becomes a root again.
   * ---------------------------------------------------------- */
  removeChild(childId: string): this {
    const child = this.get(childId)
    if (child.parentId === null) return this

    const parent = this.get(child.parentId)
    parent.yogaNode.removeChild(child.yogaNode)
    parent.children = parent.children.filter((id) => id !== childId)
    child.parentId = null
    this.roots.add(childId)
    return this
  }

  /* ----------------------------------------------------------
   * moveChild
   * Moves childId from its current parent to a new parent at
   * the given index. Combines removeChild + insertChild in one
   * call so callers don't need to manage intermediate state.
   * ---------------------------------------------------------- */
  moveChild(childId: string, newParentId: string, index?: number): this {
    this.removeChild(childId)
    if (index === undefined) {
      this.appendChild(newParentId, childId)
    } else {
      this.insertChild(newParentId, childId, index)
    }
    return this
  }

  /* ----------------------------------------------------------
   * calculate
   * Runs Yoga layout calculation on all root nodes.
   * Must be called after any createNode / updateNode / resetNode
   * / appendChild / removeChild / moveChild before reading layout.
   * ---------------------------------------------------------- */
  calculate(availableWidth: number, availableHeight: number): this {
    for (const rootId of this.roots) {
      this.get(rootId).yogaNode.calculateLayout(availableWidth, availableHeight, Direction.LTR)
    }
    return this
  }

  /* ----------------------------------------------------------
   * getLayout
   * Returns absolute LayoutRect (relative to root / canvas origin).
   * Safe to call every frame — reads cached Yoga results, no
   * re-calculation.
   * ---------------------------------------------------------- */
  getLayout(id: string): LayoutRect {
    const node = this.get(id)
    const computed = node.yogaNode.getComputedLayout()

    let x = computed.left
    let y = computed.top
    let currentId = node.parentId

    while (currentId !== null) {
      const parent = this.get(currentId)
      const pl = parent.yogaNode.getComputedLayout()
      x += pl.left
      y += pl.top
      currentId = parent.parentId
    }

    return { x, y, w: computed.width, h: computed.height }
  }

  /* ----------------------------------------------------------
   * getLayoutRelative
   * Returns layout relative to parent, exactly as Yoga computed.
   * Use this when you're managing canvas translate() per node.
   * ---------------------------------------------------------- */
  getLayoutRelative(id: string): LayoutRect {
    const { left, top, width, height } = this.get(id).yogaNode.getComputedLayout()
    return { x: left, y: top, w: width, h: height }
  }

  /* ----------------------------------------------------------
   * destroyNode
   * Detaches from parent, destroys all descendants recursively,
   * frees this node's Yoga WASM memory. Throws if not found.
   * ---------------------------------------------------------- */
  destroyNode(id: string): void {
    const node = this.get(id)

    // Detach from parent before freeing
    if (node.parentId !== null) this.removeChild(id)

    // Free all descendants first (depth-first, children before parent)
    this.freeDescendants(id)

    node.yogaNode.free()
    this.nodes.delete(id)
    this.roots.delete(id)
  }

  /* ----------------------------------------------------------
   * destroyAll
   * Frees every node and the shared Config.
   * Call this in onBeforeUnmount / component teardown.
   * The engine instance must not be used after this.
   * ---------------------------------------------------------- */
  destroyAll(): void {
    for (const node of this.nodes.values()) {
      node.yogaNode.free()
    }
    this.nodes.clear()
    this.roots.clear()
    this.config.free()
  }

  /* ----------------------------------------------------------
   * Inspection utilities
   * ---------------------------------------------------------- */

  has(id: string): boolean {
    return this.nodes.has(id)
  }

  getChildren(id: string): string[] {
    return [...this.get(id).children]
  }

  getParentId(id: string): string | null {
    return this.get(id).parentId
  }

  getRoots(): string[] {
    return [...this.roots]
  }

  /** Total number of registered nodes. */
  get size(): number {
    return this.nodes.size
  }

  /* ----------------------------------------------------------
   * Private helpers
   * ---------------------------------------------------------- */

  private get(id: string): LayoutNode {
    const node = this.nodes.get(id)
    if (!node) throw new Error(`LayoutEngine: node "${id}" not found.`)
    return node
  }

  /**
   * Recursively frees all descendants of id.
   * Does NOT free the node itself — caller handles that.
   */
  private freeDescendants(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return

    for (const childId of node.children) {
      this.freeDescendants(childId)
      const child = this.nodes.get(childId)
      if (child) {
        child.yogaNode.free()
        this.nodes.delete(childId)
        this.roots.delete(childId)
      }
    }

    node.children = []
  }
}
