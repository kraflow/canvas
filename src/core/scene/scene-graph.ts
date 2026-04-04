import type { Yoga } from 'yoga-layout/load'
import { loadYoga, Direction } from 'yoga-layout/load'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import type { SceneNode, ScreenNode, SceneNodeType, WalkVisitor } from './types'
import { syncStyleToYoga } from './style-sync'

// =============================================================================
// ID generator
// =============================================================================

let nextId = 1
function genId(prefix: string): string {
  return `${prefix}_${nextId++}`
}

// =============================================================================
// SceneGraph
// =============================================================================

/**
 * A scene graph manages a collection of Screens, each containing a tree of
 * SceneNodes. Each node has an attached Yoga layout node for flex computation.
 *
 * The scene graph is **decoupled from the renderer**. It provides a `walk()`
 * method that traverses all nodes and calls a visitor with each node's
 * absolute canvas coordinates. The renderer uses this in its `onDraw` callback.
 *
 * Usage:
 * ```ts
 * const scene = await SceneGraph.create()
 *
 * const screen = scene.addScreen('main', 100, 50, 400, 600)
 * const card = scene.createNode('view', { backgroundColor: ... })
 * scene.appendChild(screen.root, card)
 *
 * const title = scene.createNode('text', { fontSize: 24 })
 * title.text = 'Hello'
 * scene.appendChild(card, title)
 *
 * scene.computeAllLayouts()
 *
 * // In onDraw:
 * scene.walk((node, rect) => {
 *   renderView(ck, canvas, node.style, rect, ...)
 * })
 * ```
 */
export class SceneGraph {
  private readonly yoga: Yoga
  private readonly screens = new Map<string, ScreenNode>()

  private constructor(yoga: Yoga) {
    this.yoga = yoga
  }

  /**
   * Creates a new SceneGraph. Loads the Yoga WASM module.
   */
  static async create(): Promise<SceneGraph> {
    const yoga = await loadYoga()
    return new SceneGraph(yoga)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Screen management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adds a new screen at the given canvas position with the specified dimensions.
   * The screen's root is a 'view' node with its Yoga node set to the given width/height.
   */
  addScreen(id: string, x: number, y: number, width: number, height: number): ScreenNode {
    if (this.screens.has(id)) {
      throw new Error(`[SceneGraph] Screen "${id}" already exists`)
    }

    // Create root yoga node
    const yogaRoot = this.yoga.Node.create()
    yogaRoot.setWidth(width)
    yogaRoot.setHeight(height)

    const root: SceneNode = {
      id: genId('root'),
      type: 'view',
      style: {},
      children: [],
      parent: null,
      yogaNode: yogaRoot,
      rect: { x: 0, y: 0, w: width, h: height },
    }

    const screen: ScreenNode = {
      id,
      x,
      y,
      width,
      height,
      root,
      dirty: true,
    }

    this.screens.set(id, screen)
    return screen
  }

  /**
   * Removes a screen and frees all its Yoga nodes recursively.
   */
  removeScreen(id: string): void {
    const screen = this.screens.get(id)
    if (!screen) return

    // Free the entire Yoga tree
    screen.root.yogaNode.freeRecursive()
    this.screens.delete(id)
  }

  /**
   * Moves a screen to a new canvas position.
   */
  moveScreen(id: string, x: number, y: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.x = x
    screen.y = y
  }

  /**
   * Resizes a screen and marks it dirty.
   */
  resizeScreen(id: string, width: number, height: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.width = width
    screen.height = height
    screen.root.yogaNode.setWidth(width)
    screen.root.yogaNode.setHeight(height)
    screen.dirty = true
  }

  /**
   * Returns the screen with the given ID, or undefined.
   */
  getScreen(id: string): ScreenNode | undefined {
    return this.screens.get(id)
  }

  /**
   * Returns all screens as an iterable.
   */
  get allScreens(): IterableIterator<ScreenNode> {
    return this.screens.values()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new detached SceneNode with a Yoga node.
   * The node is not attached to any parent until `appendChild` or `insertChild`.
   */
  createNode(
    type: SceneNodeType,
    style: ViewStyle | TextStyle | ImageStyle,
  ): SceneNode {
    const yogaNode = this.yoga.Node.create()

    // Sync layout properties from style to Yoga
    syncStyleToYoga(this.yoga, yogaNode, style)

    const node: SceneNode = {
      id: genId(type),
      type,
      style,
      children: [],
      parent: null,
      yogaNode,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    }

    return node
  }

  /**
   * Appends a child node to a parent. Updates both the JS tree and the Yoga tree.
   */
  appendChild(parent: SceneNode, child: SceneNode): void {
    if (child.parent) {
      this.removeChild(child.parent, child)
    }

    child.parent = parent
    parent.children.push(child)
    parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount())

    this.markDirtyUp(parent)
  }

  /**
   * Inserts a child at a specific index.
   */
  insertChild(parent: SceneNode, child: SceneNode, index: number): void {
    if (child.parent) {
      this.removeChild(child.parent, child)
    }

    child.parent = parent
    parent.children.splice(index, 0, child)
    parent.yogaNode.insertChild(child.yogaNode, index)

    this.markDirtyUp(parent)
  }

  /**
   * Removes a child from its parent. The child's Yoga node is also detached
   * (but NOT freed — call `destroyNode` to free it).
   */
  removeChild(parent: SceneNode, child: SceneNode): void {
    const idx = parent.children.indexOf(child)
    if (idx === -1) return

    parent.children.splice(idx, 1)
    parent.yogaNode.removeChild(child.yogaNode)
    child.parent = null

    this.markDirtyUp(parent)
  }

  /**
   * Frees a detached node and all its descendants' Yoga nodes.
   * The node must be detached (no parent) before calling this.
   */
  destroyNode(node: SceneNode): void {
    if (node.parent) {
      throw new Error('[SceneGraph] Node must be detached before destroying')
    }
    node.yogaNode.freeRecursive()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Style updates
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Updates a node's style and syncs the layout-relevant properties to Yoga.
   */
  applyStyle(node: SceneNode, style: ViewStyle | TextStyle | ImageStyle): void {
    node.style = style
    syncStyleToYoga(this.yoga, node.yogaNode, style)
    this.markDirtyUp(node)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout computation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Computes the Yoga layout for a specific screen,
   * then reads computed rects into each node.
   */
  computeLayout(screen: ScreenNode): void {
    screen.root.yogaNode.calculateLayout(screen.width, screen.height, Direction.LTR)
    readLayout(screen.root)
    screen.dirty = false
  }

  /**
   * Computes layout for all dirty screens.
   */
  computeAllLayouts(): void {
    for (const screen of this.screens.values()) {
      if (screen.dirty) {
        this.computeLayout(screen)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Traversal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Walks all screens and all nodes in DFS order.
   * The visitor receives each node with its absolute canvas rect.
   */
  walk(visitor: WalkVisitor): void {
    for (const screen of this.screens.values()) {
      this.walkScreen(screen, visitor)
    }
  }

  /**
   * Walks a single screen's node tree in DFS order.
   */
  walkScreen(screen: ScreenNode, visitor: WalkVisitor): void {
    walkNode(screen.root, screen.x, screen.y, visitor)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Disposes of all screens and frees all Yoga resources.
   */
  dispose(): void {
    for (const screen of this.screens.values()) {
      screen.root.yogaNode.freeRecursive()
    }
    this.screens.clear()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Marks the screen containing this node as dirty (needs layout recomputation).
   */
  private markDirtyUp(node: SceneNode): void {
    // Walk up to find the root, then find the screen
    let current: SceneNode | null = node
    while (current?.parent) {
      current = current.parent
    }
    // current is the root — find its screen
    for (const screen of this.screens.values()) {
      if (screen.root === current) {
        screen.dirty = true
        return
      }
    }
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Reads computed layout from Yoga nodes into SceneNode.rect (recursive).
 * Rects are relative to the parent.
 */
function readLayout(node: SceneNode): void {
  const layout = node.yogaNode.getComputedLayout()
  node.rect.x = layout.left
  node.rect.y = layout.top
  node.rect.w = layout.width
  node.rect.h = layout.height

  for (const child of node.children) {
    readLayout(child)
  }
}

/**
 * DFS walk: computes absolute rect from parent offset + node's relative rect.
 */
function walkNode(
  node: SceneNode,
  parentAbsX: number,
  parentAbsY: number,
  visitor: WalkVisitor,
): void {
  const absRect: LayoutRect = {
    x: parentAbsX + node.rect.x,
    y: parentAbsY + node.rect.y,
    w: node.rect.w,
    h: node.rect.h,
  }

  visitor(node, absRect)

  // Account for scroll offset when walking children
  let childOffX = absRect.x
  let childOffY = absRect.y
  if (node.scroll) {
    childOffX -= node.scroll.x
    childOffY -= node.scroll.y
  }

  for (const child of node.children) {
    walkNode(child, childOffX, childOffY, visitor)
  }
}
