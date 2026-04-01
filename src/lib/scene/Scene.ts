import type { NodeID, NodeStyle, NodeType, SceneNode, Screen, ViewSceneNode, WalkFn } from './types'
import { applyFlexStyle, resetAllProperties } from '../layout/LayoutEngine'
import type { StyleResolver } from '../styles/StyleResolver'
import Yoga, { type Config, Direction, type Node as YogaNode } from 'yoga-layout'
import type { FlexStyle } from '../styles/types'

export class Scene {
  private index = new Map<NodeID, SceneNode>()
  private screens = new Map<NodeID, Screen>()
  private screenOrder: NodeID[] = []
  private readonly config: Config

  constructor(
    private readonly resolver: StyleResolver,
    pixelRatio: number,
  ) {
    this.config = Yoga.Config.create()
    this.config.setPointScaleFactor(pixelRatio)
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
      screen.width,
      screen.height,
      direction === 'ltr' ? Direction.LTR : Direction.RTL,
    )

    // Screen origin is its world position (set by moveScreen)
    const originX = screen.x ?? 0
    const originY = screen.y ?? 0

    this.walk(screenId, (node, parent) => {
      const parentAbsX = parent?.rect?.absX ?? originX
      const parentAbsY = parent?.rect?.absY ?? originY

      const relX = node.yogaNode!.getComputedLeft()
      const relY = node.yogaNode!.getComputedTop()

      node.rect = {
        x: relX,
        y: relY,
        absX: parentAbsX + relX,
        absY: parentAbsY + relY,
        w: node.yogaNode!.getComputedWidth(),
        h: node.yogaNode!.getComputedHeight(),
      }

      // Resolve visual style now that rect is populated.
      this.resolveNodeStyle(node)
    })
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
      height: screen.height,
      width: screen.width,
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
  }

  moveScreen(id: NodeID, x: number, y: number): void {
    const screen = this.getScreen(id)
    screen.x = x
    screen.y = y
  }

  /**
   * Resize a screen and update its yoga node dimensions so that subsequent
   * calculateLayout calls use the new size.
   */
  resizeScreen(id: NodeID, width: number, height: number): void {
    const screen = this.getScreen(id)
    screen.width = width
    screen.height = height
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

    if (node.rect) {
      // Rect is available: resolve immediately so resolvedStyle stays in sync.
      this.resolveNodeStyle(node)
    } else {
      // Rect not yet available (node added before first layout pass).
      // Clear any stale resolvedStyle so the renderer doesn't use outdated data.
      node.resolvedStyle = undefined
    }
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

  walk(screenId: NodeID, fn: WalkFn): void {
    const screen = this.getScreen(screenId)
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

  static fromJSON(
    data: { screens: Screen[]; order: NodeID[] },
    resolver: StyleResolver,
    pixelRatio: number,
  ): Scene {
    const scene = new Scene(resolver, pixelRatio)
    const screenMap = new Map(data.screens.map((s) => [s.id, s]))

    for (const id of data.order) {
      const screen = screenMap.get(id)
      if (!screen) {
        throw new Error(`Scene.fromJSON: screen "${id}" listed in order but missing from screens.`)
      }
      scene.addScreen(screen)
    }

    return scene
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
    this.index.set(node.id, node)

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
