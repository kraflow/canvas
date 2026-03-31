import type { NodeID, NodeType, SceneNode, Screen, WalkFn } from './types'

/* ============================================================
 * Scene
 *
 * Owns the entire scene graph as data.
 * Responsibilities:
 *   - Store screens (root nodes with world positions)
 *   - Maintain a flat index for O(1) node lookup by id
 *   - Provide tree traversal utilities
 *   - Add / move / remove screens and nodes
 *
 * Does NOT:
 *   - Run layout (LayoutEngine's job)
 *   - Render anything (RenderBuilder's job)
 *   - Manage reactivity (StateManager's job — future)
 * ============================================================ */
export class Scene {
  /** Flat id → node index. Always in sync with the tree. */
  private index = new Map<NodeID, SceneNode>()

  /** Screens keyed by id */
  private screens = new Map<NodeID, Screen>()

  /** Insertion order — determines render/z order */
  private screenOrder: NodeID[] = []

  /* ----------------------------------------------------------
   * Screen management
   * ---------------------------------------------------------- */

  /**
   * Add a new screen to the scene.
   * All nodes in the screen's subtree are indexed automatically.
   */
  addScreen(screen: Screen): void {
    if (this.screens.has(screen.id)) {
      throw new Error(`Scene.addScreen: screen "${screen.id}" already exists.`)
    }
    this.screens.set(screen.id, screen)
    this.screenOrder.push(screen.id)
    this.indexSubtree(screen.root, null)
  }

  /**
   * Remove a screen and unindex all its nodes.
   */
  removeScreen(id: NodeID): void {
    const screen = this.screens.get(id)
    if (!screen) throw new Error(`Scene.removeScreen: screen "${id}" not found.`)
    this.unindexSubtree(screen.root)
    this.screens.delete(id)
    this.screenOrder = this.screenOrder.filter((s) => s !== id)
  }

  /**
   * Update the world-space position of a screen.
   * No layout recalculation needed — this is a camera-level concern.
   */
  moveScreen(id: NodeID, x: number, y: number): void {
    const screen = this.getScreen(id)
    screen.x = x
    screen.y = y
  }

  /**
   * Resize a screen's layout root.
   * Caller should trigger LayoutEngine.calculate() after this.
   */
  resizeScreen(id: NodeID, width: number, height: number): void {
    const screen = this.getScreen(id)
    screen.width = width
    screen.height = height
  }

  /**
   * Update a screen's label.
   */
  labelScreen(id: NodeID, label: string): void {
    this.getScreen(id).label = label
  }

  /**
   * Reorder screens — moves screenId to the given z-index position.
   * Index 0 = bottom, screenOrder.length - 1 = top.
   */
  reorderScreen(id: NodeID, toIndex: number): void {
    this.getScreen(id) // assert exists
    this.screenOrder = this.screenOrder.filter((s) => s !== id)
    const clamped = Math.max(0, Math.min(toIndex, this.screenOrder.length))
    this.screenOrder.splice(clamped, 0, id)
  }

  /* ----------------------------------------------------------
   * Node management
   * ---------------------------------------------------------- */

  /**
   * Append a child node to a parent.
   * Both must already be in the scene (parent indexed).
   */
  appendChild(parentId: NodeID, child: SceneNode): void {
    const parent = this.getNode(parentId)
    this.assertNotIndexed(child.id)

    if (!parent.children) parent.children = []
    parent.children.push(child)
    this.indexSubtree(child, parent)
  }

  /**
   * Insert a child at a specific index under a parent.
   */
  insertChild(parentId: NodeID, child: SceneNode, index: number): void {
    const parent = this.getNode(parentId)
    this.assertNotIndexed(child.id)

    if (!parent.children) parent.children = []
    const clamped = Math.max(0, Math.min(index, parent.children.length))
    parent.children.splice(clamped, 0, child)
    this.indexSubtree(child, parent)
  }

  /**
   * Remove a node from its parent and unindex its entire subtree.
   * The removed node is returned in case the caller wants to re-insert it.
   */
  removeNode(id: NodeID): SceneNode {
    const node = this.getNode(id)

    // Find the parent by searching the index for a node that has this child
    // We do a targeted search rather than full tree traversal
    const parentNode = this.findParentOf(id)

    if (parentNode) {
      parentNode.children = parentNode.children!.filter((c) => c.id !== id)
    } else {
      // node is a screen root — cannot be removed via removeNode
      throw new Error(`Scene.removeNode: "${id}" is a screen root. Use removeScreen() instead.`)
    }

    this.unindexSubtree(node)
    return node
  }

  /**
   * Move a node to a new parent (optionally at a specific index).
   * Equivalent to removeNode + appendChild/insertChild.
   */
  moveNode(id: NodeID, newParentId: NodeID, index?: number): void {
    const node = this.removeNode(id)
    if (index === undefined) {
      this.appendChild(newParentId, node)
    } else {
      this.insertChild(newParentId, node, index)
    }
  }

  /**
   * Update props on an existing node.
   * Merges — only keys present in `props` are changed.
   * Caller should re-resolve styles and trigger LayoutEngine
   * if layout-affecting props changed.
   */
  updateProps<T extends NodeType>(id: NodeID, props: SceneNode<T>['props']): void {
    const node = this.getNode(id)
    node.props = { ...node.props, ...props } as typeof node.props
  }

  /**
   * Replace a node's props entirely.
   */
  setProps<T extends NodeType>(id: NodeID, props: SceneNode<T>['props']): void {
    this.getNode(id).props = props as SceneNode['props']
  }

  /* ----------------------------------------------------------
   * Lookup
   * ---------------------------------------------------------- */

  /** O(1) node lookup by id. */
  getNode(id: NodeID): SceneNode {
    const node = this.index.get(id)
    if (!node) throw new Error(`Scene.getNode: node "${id}" not found.`)
    return node
  }

  /** Returns undefined if not found (non-throwing variant). */
  findNode(id: NodeID): SceneNode | undefined {
    return this.index.get(id)
  }

  /** O(1) screen lookup by id. */
  getScreen(id: NodeID): Screen {
    const screen = this.screens.get(id)
    if (!screen) throw new Error(`Scene.getScreen: screen "${id}" not found.`)
    return screen
  }

  /** Returns undefined if not found. */
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

  /**
   * Iterate over all screens in z-order (bottom to top).
   */
  forEachScreen(fn: (screen: Screen) => void): void {
    for (const id of this.screenOrder) {
      const screen = this.screens.get(id)
      if (screen) fn(screen)
    }
  }

  /**
   * Walk a single screen's subtree, parent before children.
   * Return false from the callback to skip that node's children.
   */
  walk(screenId: NodeID, fn: WalkFn): void {
    const screen = this.getScreen(screenId)
    this.walkNode(screen.root, null, fn, 0)
  }

  /**
   * Walk every screen in z-order.
   */
  walkAll(fn: WalkFn): void {
    this.forEachScreen((screen) => this.walkNode(screen.root, null, fn, 0))
  }

  /**
   * Walk the subtree rooted at a specific node.
   */
  walkSubtree(id: NodeID, fn: WalkFn): void {
    const node = this.getNode(id)
    const parent = this.findParentOf(id)
    this.walkNode(node, parent!, fn, 0)
  }

  /**
   * Collect all descendant ids of a node (not including itself).
   */
  descendants(id: NodeID): NodeID[] {
    const result: NodeID[] = []
    const node = this.getNode(id)
    this.walkNode(
      node,
      null,
      (n) => {
        if (n.id !== id) result.push(n.id)
      },
      0,
    )
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
   *
   * Scene is pure data — serialization is straightforward.
   * DynamicExpressions with `expr` functions are stripped
   * (functions can't be serialized).
   * ---------------------------------------------------------- */
  toJSON(): { screens: Screen[]; order: NodeID[] } {
    return {
      screens: this.getScreens(),
      order: [...this.screenOrder],
    }
  }

  static fromJSON(data: { screens: Screen[]; order: NodeID[] }): Scene {
    const scene = new Scene()
    // Insert in stored z-order
    const screenMap = new Map(data.screens.map((s) => [s.id, s]))
    for (const id of data.order) {
      const screen = screenMap.get(id)
      if (screen) scene.addScreen(screen)
    }
    return scene
  }

  /* ----------------------------------------------------------
   * Private helpers
   * ---------------------------------------------------------- */

  private walkNode(node: SceneNode, parent: SceneNode | null, fn: WalkFn, depth: number): void {
    const result = fn(node, parent, depth)
    if (result === false) return // caller skipped this subtree
    for (const child of node.children ?? []) {
      this.walkNode(child, node, fn, depth + 1)
    }
  }

  private indexSubtree(node: SceneNode, _parent: SceneNode | null): void {
    if (this.index.has(node.id)) {
      throw new Error(
        `Scene: duplicate node id "${node.id}". ` +
          `Every node in the scene must have a unique id.`,
      )
    }
    this.index.set(node.id, node)
    for (const child of node.children ?? []) {
      this.indexSubtree(child, node)
    }
  }

  private unindexSubtree(node: SceneNode): void {
    this.index.delete(node.id)
    for (const child of node.children ?? []) {
      this.unindexSubtree(child)
    }
  }

  private assertNotIndexed(id: NodeID): void {
    if (this.index.has(id)) {
      throw new Error(
        `Scene: node "${id}" is already in the scene. ` + `Call removeNode() before re-inserting.`,
      )
    }
  }

  /**
   * Find the parent of a node by scanning the index.
   * O(n) but only called on structural mutations, not per-frame.
   */
  private findParentOf(id: NodeID): SceneNode | undefined {
    for (const node of this.index.values()) {
      if (node.children?.some((c) => c.id === id)) {
        return node
      }
    }
    return undefined
  }
}
