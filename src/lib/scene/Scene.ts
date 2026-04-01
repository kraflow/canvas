import type {
  NodeID,
  NodeStyle,
  NodeType,
  SceneNode,
  Screen,
  SpatialEntry,
  ViewSceneNode,
  WalkFn,
} from './types'
import { applyFlexStyle, resetAllProperties } from '../layout/LayoutEngine'
import type { StyleResolver } from '../styles/StyleResolver'
import Yoga, { type Config, Direction, type Node as YogaNode } from 'yoga-layout'
import type { FlexStyle } from '../styles/types'
import { createTextMeasureFunction } from './measure'
import type { Renderer } from '../render/Renderer'

export class Scene {
  private index = new Map<NodeID, SceneNode>()
  private screens = new Map<NodeID, Screen>()
  private screenOrder: NodeID[] = []
  private readonly config: Config

  /**
   * Spatial index — one flat sorted array per screen.
   * Sorted deepest-first so the first AABB match in a point query is always
   * the topmost visual node. Rebuilt at the end of every calculateLayout.
   */
  private spatialIndex = new Map<NodeID, SpatialEntry[]>()

  /**
   * Reverse map from any node ID to the screen it lives in.
   * Populated in indexSubtree, cleared in unindexSubtree.
   * Lets callers query by node ID without knowing which screen it belongs to.
   */
  private nodeToScreen = new Map<NodeID, NodeID>()

  constructor(
    private readonly resolver: StyleResolver,
    private readonly renderer: Renderer,
  ) {
    this.config = Yoga.Config.create()
    this.config.setPointScaleFactor(renderer.getPixelRatio())
  }

  /* ----------------------------------------------------------
   * Yoga Layout management
   * ---------------------------------------------------------- */

  setPixelRatio(ratio: number): void {
    this.config.setPointScaleFactor(ratio)
  }

  /**
   * Run Yoga layout for the given screen, update every node's `rect`, then
   * immediately resolve visual styles so the renderer always has a fresh
   * `resolvedStyle` after this call returns.
   *
   * Layout → rect → resolvedStyle are computed in a single walk so the
   * renderer never sees a node whose rect and resolvedStyle are out of sync.
   */
  calculateLayout(screenId: NodeID, direction: 'ltr' | 'rtl' = 'ltr'): void {
    const screen = this.getScreen(screenId)
    screen.yogaNode!.calculateLayout(
      screen.rect.w,
      screen.rect.h,
      direction === 'ltr' ? Direction.LTR : Direction.RTL,
    )

    // Resolve screen style now that rect is populated
    this.resolveNodeStyle(screen)

    // Screen origin is its world position (set by moveScreen)
    const originX = screen.rect.x ?? 0
    const originY = screen.rect.y ?? 0

    this.walk(screenId, (node, parent) => {
      const parentAbsX = parent?.rect?.absX ?? originX
      const parentAbsY = parent?.rect?.absY ?? originY

      const relX = node.yogaNode!.getComputedLeft()
      const relY = node.yogaNode!.getComputedTop()

      node.rect = {
        absX: relX,
        absY: relY,
        x: parentAbsX + relX,
        y: parentAbsY + relY,
        w: node.yogaNode!.getComputedWidth(),
        h: node.yogaNode!.getComputedHeight(),
      }

      // Resolve visual style now that rect is populated.
      this.resolveNodeStyle(node)
    })

    // Rebuild spatial index from the freshly computed rects.
    // Done after the walk so every node.rect is guaranteed to be current.
    this.rebuildSpatialIndex(screenId)
  }

  /* ----------------------------------------------------------
   * Resolved style management
   * ---------------------------------------------------------- */

  /**
   * Re-resolve visual styles for every node in a screen without re-running
   * Yoga layout. Useful when only visual properties change (colour, opacity,
   * font size, etc.) and the layout is already up-to-date.
   *
   * Throws if `calculateLayout` has never been called for this screen (rects
   * would be missing and the resolver would receive undefined).
   */
  resolveStyles(screenId: NodeID): void {
    this.walk(screenId, (node) => {
      if (!node.rect) {
        throw new Error(
          `Scene.resolveStyles: node "${node.id}" has no rect. ` +
            `Call calculateLayout("${screenId}") before resolveStyles().`,
        )
      }
      this.resolveNodeStyle(node)
    })
  }

  /**
   * Re-resolve visual styles for a single node subtree (the node itself and
   * all its descendants). Rect must already exist on every node in the
   * subtree — call calculateLayout first.
   *
   * Typical use: after appendChild / insertChild + calculateLayout, call this
   * to populate resolvedStyle on the newly added nodes before the next render.
   */
  resolveSubtreeStyles(id: NodeID): void {
    this.walkSubtree(id, (node) => {
      if (!node.rect) {
        throw new Error(
          `Scene.resolveSubtreeStyles: node "${node.id}" has no rect. ` +
            `Call calculateLayout() for its screen before resolveSubtreeStyles().`,
        )
      }
      this.resolveNodeStyle(node)
    })
  }

  /* ----------------------------------------------------------
   * Hit testing
   * ---------------------------------------------------------- */

  /**
   * Returns the topmost node whose AABB contains the world-space point (x, y)
   * within the given screen, or null if no node is hit.
   *
   * "Topmost" means the deepest node in DFS order — i.e. the one that would
   * be painted last and therefore appears visually on top.
   *
   * O(n) scan over a flat pre-sorted array — fast constant due to no pointer
   * chasing and early exit on first match.
   */
  pointHit(screenId: NodeID, x: number, y: number): SceneNode | null {
    const entries = this.spatialIndex.get(screenId)
    if (!entries) return null

    for (const e of entries) {
      if (x >= e.absX && x <= e.absX2 && y >= e.absY && y <= e.absY2) {
        return this.index.get(e.id) ?? null
      }
    }
    return null
  }

  /**
   * Returns all nodes whose AABB contains (x, y), ordered topmost-first.
   * Use this to build a hover stack, tooltip chain, or pointer-events cascade.
   */
  pointHitAll(screenId: NodeID, x: number, y: number): SceneNode[] {
    const entries = this.spatialIndex.get(screenId)
    if (!entries) return []

    const result: SceneNode[] = []
    for (const e of entries) {
      if (x >= e.absX && x <= e.absX2 && y >= e.absY && y <= e.absY2) {
        const node = this.index.get(e.id)
        if (node) result.push(node)
      }
    }
    return result
  }

  /**
   * Returns all nodes whose AABB overlaps the given world-space rectangle,
   * ordered topmost-first. Use this for marquee / rubber-band selection.
   */
  regionHit(screenId: NodeID, rect: { x: number; y: number; w: number; h: number }): SceneNode[] {
    const entries = this.spatialIndex.get(screenId)
    if (!entries) return []

    const rx2 = rect.x + rect.w
    const ry2 = rect.y + rect.h
    const result: SceneNode[] = []

    for (const e of entries) {
      // AABB overlap: NOT (right < left OR left > right OR bottom < top OR top > bottom)
      if (e.absX2 >= rect.x && e.absX <= rx2 && e.absY2 >= rect.y && e.absY <= ry2) {
        const node = this.index.get(e.id)
        if (node) result.push(node)
      }
    }
    return result
  }

  /**
   * Returns the screen ID that owns the given node, or undefined if the node
   * is not currently in the scene. Avoids callers having to thread screenId
   * through every operation that only has a node ID.
   */
  getScreenForNode(id: NodeID): NodeID | undefined {
    return this.nodeToScreen.get(id)
  }

  /**
   * Given a world-space point, returns the screen whose bounding rectangle
   * contains it, or null. Screens are checked in reverse paint order so the
   * topmost screen wins when they overlap.
   *
   * This is the entry point for pointer events on the infinite canvas —
   * call this first, then call pointHit with the returned screenId.
   */
  screenAtPoint(x: number, y: number): Screen | null {
    // Reverse order — last in screenOrder is painted on top
    for (let i = this.screenOrder.length - 1; i >= 0; i--) {
      const screen = this.screens.get(this.screenOrder[i]!)!
      const sx = screen.rect.x ?? 0
      const sy = screen.rect.y ?? 0
      if (x >= sx && x <= sx + screen.rect.w && y >= sy && y <= sy + screen.rect.h) {
        return screen
      }
    }
    return null
  }

  private createYogaNode(style?: FlexStyle): YogaNode {
    const node = Yoga.Node.createWithConfig(this.config)
    if (style) applyFlexStyle(node, style)
    return node
  }

  /* ----------------------------------------------------------
   * Screen management
   * ---------------------------------------------------------- */

  addScreen(screen: Screen): void {
    if (this.screens.has(screen.id)) {
      throw new Error(`Scene.addScreen: screen "${screen.id}" already exists.`)
    }

    screen.yogaNode = this.createYogaNode({
      height: screen.rect.h,
      width: screen.rect.w,
    })

    this.screens.set(screen.id, screen)
    this.screenOrder.push(screen.id)

    // Index each top-level child and wire its yoga node into the screen's yoga node
    screen.children.forEach((child, i) => {
      this.indexSubtree(child, screen.id)
      screen.yogaNode!.insertChild(child.yogaNode!, i)
    })
  }

  removeScreen(id: NodeID): void {
    const screen = this.screens.get(id)
    if (!screen) throw new Error(`Scene.removeScreen: screen "${id}" not found.`)

    // Unindex subtree first (frees all child yoga nodes)
    screen.children.forEach((child) => {
      screen.yogaNode!.removeChild(child.yogaNode!)
      this.unindexSubtree(child)
    })

    // Free the screen's own yoga node last
    screen.yogaNode!.free()
    screen.yogaNode = undefined

    this.screens.delete(id)
    this.screenOrder = this.screenOrder.filter((s) => s !== id)
    this.spatialIndex.delete(id)
  }

  moveScreen(id: NodeID, x: number, y: number): void {
    const screen = this.getScreen(id)
    screen.rect.x = x
    screen.rect.y = y
  }

  /**
   * Resize a screen and update its yoga node dimensions so that subsequent
   * calculateLayout calls use the new size.
   */
  resizeScreen(id: NodeID, width: number, height: number): void {
    const screen = this.getScreen(id)
    screen.rect.w = width
    screen.rect.h = height

    // Keep the yoga node in sync — without this, calculateLayout ignores the
    // new dimensions because it still reads the stale values from the yoga node.
    applyFlexStyle(screen.yogaNode!, { width, height })
  }

  labelScreen(id: NodeID, label: string): void {
    this.getScreen(id).label = label
  }

  reorderScreen(id: NodeID, toIndex: number): void {
    this.getScreen(id) // assert exists
    this.screenOrder = this.screenOrder.filter((s) => s !== id)
    const clamped = Math.max(0, Math.min(toIndex, this.screenOrder.length))
    this.screenOrder.splice(clamped, 0, id)
  }

  /* ----------------------------------------------------------
   * Node management
   * ---------------------------------------------------------- */

  appendChild(parentId: NodeID, child: SceneNode): void {
    this.assertNotIndexed(child.id)
    const parent = this.getNodeAsView(parentId)

    if (!parent.children) parent.children = []
    const insertIndex = parent.children.length

    parent.children.push(child)
    this.indexSubtree(child, parentId)
    parent.yogaNode!.insertChild(child.yogaNode!, insertIndex)
  }

  insertChild(parentId: NodeID, child: SceneNode, index: number): void {
    this.assertNotIndexed(child.id)
    const parent = this.getNodeAsView(parentId)

    if (!parent.children) parent.children = []
    const clamped = Math.max(0, Math.min(index, parent.children.length))

    parent.children.splice(clamped, 0, child)
    this.indexSubtree(child, parentId)
    parent.yogaNode!.insertChild(child.yogaNode!, clamped)
  }

  removeNode(id: NodeID): SceneNode {
    const node = this.getNode(id)
    const parent = node.parent ? (this.getNode(node.parent) as ViewSceneNode) : null

    if (!parent) {
      throw new Error(`Scene.removeNode: "${id}" is a screen root. Use removeScreen() instead.`)
    }

    // Detach from Yoga tree before unindexing
    parent.yogaNode!.removeChild(node.yogaNode!)

    // Remove from parent's children array
    parent.children = parent.children!.filter((c) => c.id !== id)

    // Unindex (frees node.yogaNode and all descendants)
    this.unindexSubtree(node)

    return node
  }

  /**
   * Move a node to a new parent, optionally at a specific index.
   * The operation is kept as atomic as possible: the node is detached from
   * its yoga parent first, then re-inserted. If re-insertion throws, the node
   * is restored to the original parent to avoid silent data loss.
   */
  moveNode(id: NodeID, newParentId: NodeID, index?: number): void {
    const node = this.getNode(id)
    const originalParent = node.parent ? (this.getNode(node.parent) as ViewSceneNode) : null

    if (!originalParent) {
      throw new Error(`Scene.moveNode: "${id}" is a screen root and cannot be moved.`)
    }

    // Detach from yoga tree and data tree
    originalParent.yogaNode!.removeChild(node.yogaNode!)
    originalParent.children = originalParent.children!.filter((c) => c.id !== id)

    // Clear parent reference and re-use indexSubtree path via appendChild / insertChild
    node.parent = undefined

    try {
      if (index === undefined) {
        this.appendChild(newParentId, node)
      } else {
        this.insertChild(newParentId, node, index)
      }
    } catch (err) {
      // Rollback: restore to original parent at the end
      const originalIndex = originalParent.children?.length ?? 0
      originalParent.children = [...(originalParent.children ?? []), node]
      originalParent.yogaNode!.insertChild(node.yogaNode!, originalIndex)
      node.parent = originalParent.id
      throw err
    }
  }

  updateContent(id: NodeID, value: string): void {
    const node = this.getNode(id)
    if (node.type === 'image') {
      node.src = value
    } else if (node.type === 'text') {
      node.text = value
    }
  }

  updateStyle<T extends NodeType>(id: NodeID, style?: NodeStyle<T>): void {
    const node = this.getNode(id)
    if (!node.style && !style) return

    const isLayoutChange = this.resolver.hasLayoutChanged(node.style ?? {}, style ?? {})
    if (isLayoutChange) {
      resetAllProperties(node.yogaNode!)
      if (style) {
        applyFlexStyle(node.yogaNode!, style)
      }
    }

    node.style = style
  }

  /* ----------------------------------------------------------
   * Lookup
   * ---------------------------------------------------------- */

  getNode(id: NodeID): SceneNode {
    const node = this.index.get(id)
    if (!node) throw new Error(`Scene.getNode: node "${id}" not found.`)
    return node
  }

  findNode(id: NodeID): SceneNode | undefined {
    return this.index.get(id)
  }

  getScreen(id: NodeID): Screen {
    const screen = this.screens.get(id)
    if (!screen) throw new Error(`Scene.getScreen: screen "${id}" not found.`)
    return screen
  }

  findScreen(id: NodeID): Screen | undefined {
    return this.screens.get(id)
  }

  hasNode(id: NodeID): boolean {
    return this.index.has(id)
  }

  hasScreen(id: NodeID): boolean {
    return this.screens.has(id)
  }

  /* ----------------------------------------------------------
   * Traversal
   * ---------------------------------------------------------- */

  forEachScreen(fn: (screen: Screen) => void): void {
    for (const id of this.screenOrder) {
      const screen = this.screens.get(id)
      if (screen) fn(screen)
    }
  }

  walk(screenId: NodeID, fn: WalkFn, includeSelf = true): void {
    const screen = this.getScreen(screenId)
    if (includeSelf) fn(screen, null, 0)
    screen.children.forEach((node) => this.walkNode(node, null, fn, 0))
  }

  walkAll(fn: WalkFn): void {
    this.forEachScreen((screen) =>
      screen.children.forEach((node) => this.walkNode(node, null, fn, 0)),
    )
  }

  walkSubtree(id: NodeID, fn: WalkFn): void {
    const node = this.getNode(id)
    const parent = node.parent ? (this.findNode(node.parent) ?? null) : null
    this.walkNode(node, parent, fn, 0)
  }

  /**
   * Returns the IDs of all strict descendants of the given node
   * (the node itself is excluded).
   */
  descendants(id: NodeID): NodeID[] {
    const result: NodeID[] = []
    const node = this.getNode(id) as ViewSceneNode

    for (const child of node.children ?? []) {
      this.walkNode(
        child,
        node,
        (n) => {
          result.push(n.id)
        },
        0,
      )
    }

    return result
  }

  /* ----------------------------------------------------------
   * Introspection
   * ---------------------------------------------------------- */

  get screenCount(): number {
    return this.screens.size
  }

  get nodeCount(): number {
    return this.index.size
  }

  getScreenOrder(): NodeID[] {
    return [...this.screenOrder]
  }

  getScreens(): Screen[] {
    return this.screenOrder.map((id) => this.screens.get(id)!).filter(Boolean)
  }

  /* ----------------------------------------------------------
   * Serialization
   * ---------------------------------------------------------- */

  toJSON(): { screens: Screen[]; order: NodeID[] } {
    return {
      screens: this.getScreens(),
      order: [...this.screenOrder],
    }
  }

  /* ----------------------------------------------------------
   * Private helpers
   * ---------------------------------------------------------- */

  /**
   * Resolve (or clear) the visual style for a single node.
   * Requires node.rect to be populated — always called after layout.
   *
   * We use a type-discriminated call so TypeScript can verify the style /
   * resolvedStyle pair matches the node type at each branch.
   */
  private resolveNodeStyle(node: SceneNode): void {
    if (!node.style || !node.rect) {
      node.resolvedStyle = undefined
      return
    }

    switch (node.type) {
      case 'screen':
        node.resolvedStyle = this.resolver.view(node.style, node.rect)
        break
      case 'view':
        node.resolvedStyle = this.resolver.view(node.style, node.rect)
        break
      case 'text':
        node.resolvedStyle = this.resolver.text(node.style, node.rect)
        break
      case 'image':
        node.resolvedStyle = this.resolver.image(node.style, node.rect)
        break
    }
  }

  private walkNode(node: SceneNode, parent: SceneNode | null, fn: WalkFn, depth: number): void {
    const result = fn(node, parent, depth)
    if (result === false) return

    for (const child of (node as ViewSceneNode).children ?? []) {
      this.walkNode(child, node, fn, depth + 1)
    }
  }

  /**
   * Recursively index a node and all its descendants.
   * Creates a yoga node for each and sets node.parent for tree tracking.
   *
   * Note: flex style is applied once here via createYogaNode — updateStyle is
   * NOT called during indexing because node.rect is not yet available and the
   * visual resolver would crash on a missing rect.
   */
  private indexSubtree(node: SceneNode, parent?: NodeID): void {
    if (this.index.has(node.id)) {
      throw new Error(
        `Scene: duplicate node id "${node.id}". ` +
          `Every node in the scene must have a unique id.`,
      )
    }

    node.parent = parent
    // createYogaNode already applies the flex style — do not call updateStyle
    // here to avoid a double-apply and a premature resolver call (rect is null).
    node.yogaNode = this.createYogaNode(node.style as FlexStyle | undefined)
    if (node.type === 'text') {
      node.yogaNode.setMeasureFunc(createTextMeasureFunction(this.renderer, this.resolver, node))
    }
    this.index.set(node.id, node)

    // Track which screen this node belongs to so callers can resolve
    // screenId from a node ID alone (used by hit-test helpers).
    const screenId = this.resolveScreenId(parent)
    if (screenId) this.nodeToScreen.set(node.id, screenId)

    const children = (node as ViewSceneNode).children ?? []

    children.forEach((child, i) => {
      this.indexSubtree(child, node.id)
      node.yogaNode!.insertChild(child.yogaNode!, i)
    })
  }

  /**
   * Recursively unindex a node and its descendants.
   * Children are detached from their parent yoga node and freed depth-first
   * to avoid use-after-free in the native Yoga binding.
   */
  private unindexSubtree(node: SceneNode): void {
    for (const child of (node as ViewSceneNode).children ?? []) {
      // Detach child from this yoga node before recursing so the native
      // binding never holds a reference to a freed node.
      node.yogaNode!.removeChild(child.yogaNode!)
      this.unindexSubtree(child)
    }

    node.yogaNode!.free()
    node.yogaNode = undefined
    this.index.delete(node.id)
    this.nodeToScreen.delete(node.id)
  }

  /**
   * Rebuild the flat spatial index for one screen from its current rects.
   * Called at the end of calculateLayout — never call before rects are set.
   *
   * The array is sorted deepest-first (highest depth wins) so that the first
   * AABB match in pointHit is the topmost visual node without needing a
   * secondary pass.
   */
  private rebuildSpatialIndex(screenId: NodeID): void {
    const entries: SpatialEntry[] = []

    this.walk(screenId, (node, _parent, depth) => {
      if (!node.rect) return
      entries.push({
        id: node.id,
        absX: node.rect.x,
        absY: node.rect.y,
        absX2: node.rect.x + node.rect.w,
        absY2: node.rect.y + node.rect.h,
        depth,
      })
    })

    entries.sort((a, b) => b.depth - a.depth)
    this.spatialIndex.set(screenId, entries)
  }

  /**
   * Walks up the parent chain from a given node ID to find the screen root.
   * Used during indexSubtree to populate nodeToScreen.
   *
   * We check the screens map first because top-level children of a screen
   * have `parent = screenId`, and screenId IS a valid screen — not a node.
   */
  private resolveScreenId(parentId?: NodeID): NodeID | undefined {
    if (!parentId) return undefined
    // If the parent is a screen, we're done
    if (this.screens.has(parentId)) return parentId
    // Otherwise walk up via nodeToScreen (already populated for ancestors)
    return this.nodeToScreen.get(parentId)
  }

  private assertNotIndexed(id: NodeID): void {
    if (this.index.has(id)) {
      throw new Error(
        `Scene: node "${id}" is already in the scene. Call removeNode() before re-inserting.`,
      )
    }
  }

  /** Returns the node cast as ViewSceneNode, asserting it can hold children. */
  private getNodeAsView(id: NodeID): ViewSceneNode {
    const node = this.getNode(id)
    if (node.type !== 'view') {
      throw new Error(
        `Scene: node "${id}" has type "${node.type}". Only 'view' nodes can accept children.`,
      )
    }
    return node as ViewSceneNode
  }
}
