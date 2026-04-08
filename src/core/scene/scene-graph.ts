import type { Yoga } from 'yoga-layout/load'
import { loadYoga, Direction, MeasureMode } from 'yoga-layout/load'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import type { FontSystem, ParagraphOptions } from '@/core/fonts'
import type {
  SceneNode,
  ScreenNode,
  SceneNodeType,
  WalkVisitor,
  SerializedProject,
  SerializedSceneNode,
  SerializedScreenNode,
} from './types'
import { syncStyleToYoga } from './style-sync'
import { flattenStyle } from '@/core/styles/flatten'
import { TextMeasureCache } from './text-measure-cache'
import { SpatialIndex } from './SpatialIndex'
import { toSerializableScreen } from './serialization'
import { ImageCache } from '../renderer/draw'
import { CONFIG } from '../constants'

// ─────────────────────────────────────────────────────────────────────────────
// SceneGraph
// ─────────────────────────────────────────────────────────────────────────────

export class SceneGraph {
  private readonly textMeasureCache = new TextMeasureCache()
  public readonly spatialIndex = new SpatialIndex()

  // Screens are top-level roots; their root SceneNode has parent === null.
  private readonly screens = new Map<string, ScreenNode>()
  // Every SceneNode including root nodes of screens.
  private readonly nodes = new Map<string, SceneNode>()

  private nextId = CONFIG.ID_START_COUNTER
  private _anyDirty = false

  private constructor(
    private readonly version: string,
    private readonly yoga: Yoga,
    private readonly fonts: FontSystem,
    private readonly imageCache: ImageCache,
  ) {}

  public static async init(
    version: string,
    fonts: FontSystem,
    imageCache: ImageCache,
  ): Promise<SceneGraph> {
    const yoga = await loadYoga()
    return new SceneGraph(version, yoga, fonts, imageCache)
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  public addScreen(
    id: string,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style?: ViewStyle,
  ): ScreenNode {
    if (this.screens.has(id)) throw new Error(`[SceneGraph] Screen "${id}" already exists`)

    const yogaNode = this.yoga.Node.create()
    yogaNode.setWidth(width)
    yogaNode.setHeight(height)

    const root: SceneNode = {
      id: this._genId('root'),
      type: 'view',
      style: flattenStyle(style ?? {}),
      children: [],
      parent: null,
      yogaNode,
      rect: { x: 0, y: 0, w: width, h: height },
      worldRect: { x, y, w: width, h: height },
      scroll: { x: 0, y: 0 },
    }

    const screen: ScreenNode = { id, name, x, y, width, height, root, dirty: true }
    this.screens.set(id, screen)
    this.nodes.set(root.id, root)
    this.spatialIndex.insert(root)
    this._anyDirty = true

    return screen
  }

  public removeScreen(id: string): void {
    const screen = this.screens.get(id)
    if (!screen) return
    this._freeNodeTree(screen.root)
    this.screens.delete(id)
  }

  /** Move the screen canvas in world space. Updates all world rects. */
  public moveScreen(id: string, x: number, y: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    const dx = x - screen.x
    const dy = y - screen.y
    if (dx === 0 && dy === 0) return
    screen.x = x
    screen.y = y
    this._shiftWorldRects(screen.root, dx, dy)
  }

  /** Resize the screen canvas. Marks layout dirty. */
  public resizeScreen(id: string, width: number, height: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    if (screen.width === width && screen.height === height) return
    screen.width = width
    screen.height = height
    screen.root.yogaNode.setWidth(width)
    screen.root.yogaNode.setHeight(height)
    screen.dirty = true
    this._anyDirty = true
  }

  public getScreen(id: string): ScreenNode | undefined {
    return this.screens.get(id)
  }

  public get allScreens(): IterableIterator<ScreenNode> {
    return this.screens.values()
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────

  public getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id)
  }

  /**
   * Creates a detached node. Attach it with appendChild / insertChild.
   * text nodes: set `text`. image nodes: set `src`.
   * view nodes can have children; text and image cannot.
   */
  public createNode(
    type: SceneNodeType,
    style: ViewStyle | TextStyle | ImageStyle,
    options?: { text?: string; src?: string },
  ): SceneNode {
    const flatStyle = flattenStyle(style)
    const yogaNode = this.yoga.Node.create()
    syncStyleToYoga(yogaNode, flatStyle)

    const node: SceneNode = {
      id: this._genId(type),
      type,
      style: flatStyle,
      children: [],
      parent: null,
      yogaNode,
      rect: { x: 0, y: 0, w: 0, h: 0 },
      worldRect: { x: 0, y: 0, w: 0, h: 0 },
      scroll: { x: 0, y: 0 },
      text: type === 'text' ? (options?.text ?? '') : undefined,
      src: type === 'image' ? options?.src : undefined,
    }

    if (type === 'text') this._setupTextMeasure(node)

    this.nodes.set(node.id, node)
    // worldRect is zeroed until appended and layout runs — don't insert into
    // spatial index until the node has a real world position.

    return node
  }

  public appendChild(parent: SceneNode, child: SceneNode): void {
    if (parent.type !== 'view') throw new Error('[SceneGraph] Only view nodes accept children')
    if (child.parent) this._detach(child)
    child.parent = parent
    ;(parent.children as SceneNode[]).push(child)
    parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount())
    this._markLayoutDirty(parent)
  }

  public insertChild(parent: SceneNode, child: SceneNode, index: number): void {
    if (parent.type !== 'view') throw new Error('[SceneGraph] Only view nodes accept children')
    if (child.parent) this._detach(child)
    child.parent = parent
    ;(parent.children as SceneNode[]).splice(index, 0, child)
    parent.yogaNode.insertChild(child.yogaNode, index)
    this._markLayoutDirty(parent)
  }

  public removeChild(parent: SceneNode, child: SceneNode): void {
    const idx = parent.children.indexOf(child)
    if (idx === -1) return
    this.spatialIndex.remove(child)
    ;(parent.children as SceneNode[]).splice(idx, 1)
    parent.yogaNode.removeChild(child.yogaNode)
    child.parent = null
    this._markLayoutDirty(parent)
  }

  /** Detach and permanently destroy a node and all its descendants. */
  public destroyNode(node: SceneNode): void {
    if (node.parent) this._detach(node)
    this._freeNodeTree(node)
  }

  /** Reparent a node. Optionally specify insertion index in the new parent. */
  public reparent(nodeId: string, newParentId: string, index?: number): void {
    const node = this.nodes.get(nodeId)
    const newParent = this.nodes.get(newParentId)
    if (!node || !newParent || node === newParent) return
    if (newParent.type !== 'view') return
    // Prevent cycles
    let cur: SceneNode | null = newParent
    while (cur) {
      if (cur === node) return
      cur = cur.parent
    }
    if (node.parent) this._detach(node)
    if (index !== undefined) {
      this.insertChild(newParent, node, index)
    } else {
      this.appendChild(newParent, node)
    }
  }

  // ── Style / content updates ────────────────────────────────────────────────

  /**
   * Apply a new style to any node (including a screen's root).
   * Yoga is updated; spatial index is refreshed after next layout.
   */
  public applyStyle(node: SceneNode, style: ViewStyle | TextStyle | ImageStyle): void {
    const flatStyle = flattenStyle(style)
    node.style = flatStyle
    syncStyleToYoga(node.yogaNode, { ...flatStyle, height: node.rect.h, width: node.rect.w })
    this._markLayoutDirty(node)
  }

  /** Update text content of a text node. */
  public setText(node: SceneNode, text: string): void {
    if (node.type !== 'text' || node.text === text) return
    node.text = text
    node.yogaNode.markDirty() // invalidate text measure cache slot
    this._markLayoutDirty(node)
  }

  /** Update image source of an image node. */
  public setSrc(node: SceneNode, src: string): void {
    if (node.type !== 'image' || node.src === src) return
    this.imageCache.load(src)
    node.src = src
  }

  /** Update scroll offset of any node. Does not trigger layout. */
  public setScroll(node: SceneNode, scroll: { x: number; y: number }): void {
    node.scroll = scroll
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  /**
   * Recalculate Yoga layout for all dirty screens and rebuild spatial index
   * if anything changed. Call once per frame before rendering.
   */
  public computeLayouts(): void {
    if (!this._anyDirty) return
    for (const screen of this.screens.values()) {
      if (!screen.dirty) continue
      screen.root.yogaNode.calculateLayout(screen.width, screen.height, Direction.LTR)
      this._readLayout(screen.root, screen.x, screen.y)
      screen.dirty = false
    }
    this.spatialIndex.rebuild(this.nodes.values())
    this._anyDirty = false
  }

  // ── Walk ───────────────────────────────────────────────────────────────────

  /** Walk every node in every screen. */
  public walk(visitor: WalkVisitor): void {
    for (const screen of this.screens.values()) {
      this._walkNode(screen.root, visitor)
    }
  }

  /** Walk every node inside a specific screen. */
  public walkScreen(screenId: string, visitor: WalkVisitor): void {
    const screen = this.screens.get(screenId)
    if (screen) {
      this._walkNode(screen.root, visitor)
    }
  }

  // ── Hit testing ────────────────────────────────────────────────────────────

  public hitTest(worldX: number, worldY: number): SceneNode | null {
    const candidates = this.spatialIndex.getCandidatesAtPoint(worldX, worldY)
    let best: SceneNode | null = null
    let maxDepth = -1
    for (const node of candidates) {
      if (!this._containsPoint(node.worldRect, worldX, worldY)) continue
      if ((node.style as Record<string, unknown>).pointerEvents === 'none') continue
      const depth = this._depth(node)
      if (depth > maxDepth) {
        maxDepth = depth
        best = node
      }
    }
    return best
  }

  public boxTest(worldRect: LayoutRect): SceneNode[] {
    const candidates = this.spatialIndex.getCandidatesInRect(worldRect)
    const screenRoots = new Set<string>()
    for (const s of this.screens.values()) screenRoots.add(s.root.id)

    // Collect top-most non-root nodes that intersect the box
    const hits: SceneNode[] = []
    for (const node of candidates) {
      if (screenRoots.has(node.id)) continue
      if (this._intersects(worldRect, node.worldRect)) hits.push(node)
    }

    // Filter out nodes whose parent is also in the hit set
    const hitSet = new Set(hits)
    return hits.filter((node) => {
      let cur = node.parent
      while (cur) {
        if (hitSet.has(cur)) return false
        cur = cur.parent
      }
      return true
    })
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  public exportProject(): SerializedProject {
    const screens: SerializedScreenNode[] = []
    for (const screen of this.screens.values()) screens.push(toSerializableScreen(screen))
    return { version: this.version, screens }
  }

  public async importProject(project: SerializedProject): Promise<void> {
    this.dispose()
    for (const s of project.screens) {
      const screen = this.addScreen(s.id, s.name, s.x, s.y, s.width, s.height)
      this.applyStyle(screen.root, s.root.style)
      for (const childData of s.root.children) {
        const child = this._reconstructNode(childData)
        this.appendChild(screen.root, child)
      }
    }
    this.computeLayouts()
  }

  public dispose(): void {
    for (const screen of this.screens.values()) this._freeNodeTree(screen.root)
    this.screens.clear()
    this.nodes.clear()
    this.spatialIndex.clear()
    this.textMeasureCache.clear()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _genId(prefix: string): string {
    return `${prefix}_${this.nextId++}`
  }

  /** Walk up to the screen root and mark it dirty. */
  private _markLayoutDirty(node: SceneNode): void {
    let cur: SceneNode = node
    while (cur.parent) cur = cur.parent
    for (const screen of this.screens.values()) {
      if (screen.root === cur) {
        screen.dirty = true
        this._anyDirty = true
        return
      }
    }
  }

  /** Detach child from its current parent (no destroy). */
  private _detach(child: SceneNode): void {
    const parent = child.parent!
    const idx = parent.children.indexOf(child)
    ;(parent.children as SceneNode[]).splice(idx, 1)
    parent.yogaNode.removeChild(child.yogaNode)
    child.parent = null
    this._markLayoutDirty(parent)
  }

  /** Recursively free yoga nodes and remove from maps/index. */
  private _freeNodeTree(node: SceneNode): void {
    for (const child of node.children) this._freeNodeTree(child)
    this.spatialIndex.remove(node)
    this.nodes.delete(node.id)
    // Evict image from cache when removing image nodes
    if (node.type === 'image' && node.src) {
      this.imageCache.evict(node.src)
    }
    node.yogaNode.free()
  }

  /** After a screen moves, shift all world rects without re-running Yoga. */
  private _shiftWorldRects(node: SceneNode, dx: number, dy: number): void {
    const old = { ...node.worldRect }
    node.worldRect.x += dx
    node.worldRect.y += dy
    this.spatialIndex.update(node, old)
    for (const child of node.children) this._shiftWorldRects(child, dx, dy)
  }

  /** Read computed Yoga layout into node.rect / node.worldRect recursively. */
  private _readLayout(node: SceneNode, absX: number, absY: number): void {
    const layout = node.yogaNode.getComputedLayout()
    node.rect.x = layout.left
    node.rect.y = layout.top
    node.rect.w = layout.width
    node.rect.h = layout.height
    node.worldRect.x = absX + layout.left
    node.worldRect.y = absY + layout.top
    node.worldRect.w = layout.width
    node.worldRect.h = layout.height
    const childAbsX = node.worldRect.x - node.scroll.x
    const childAbsY = node.worldRect.y - node.scroll.y
    for (const child of node.children) this._readLayout(child, childAbsX, childAbsY)
  }

  private _walkNode(node: SceneNode, visitor: WalkVisitor): void {
    visitor(node, node.worldRect)
    for (const child of node.children) this._walkNode(child, visitor)
  }

  private _containsPoint(rect: LayoutRect, x: number, y: number): boolean {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  }

  private _intersects(a: LayoutRect, b: LayoutRect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  private _depth(node: SceneNode): number {
    let d = 0
    let cur = node.parent
    while (cur) {
      d++
      cur = cur.parent
    }
    return d
  }

  private _reconstructNode(data: SerializedSceneNode): SceneNode {
    const node = this.createNode(data.type, data.style, { text: data.text, src: data.src })
    node.scroll = data.scroll
    if (data.type === 'view') {
      for (const child of data.children) this.appendChild(node, this._reconstructNode(child))
    }
    return node
  }

  private _setupTextMeasure(node: SceneNode): void {
    node.yogaNode.setMeasureFunc((width, widthMode, _h, _hm) => {
      const text = node.text ?? ''
      const style = node.style as TextStyle
      const maxWidth =
        widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost
          ? width
          : CONFIG.TEXT_MEASURE_MAX_WIDTH
      const key = TextMeasureCache.makeKey(text, style, maxWidth)
      const cached = this.textMeasureCache.get(key)
      if (cached) return cached

      try {
        const para = this.fonts.makeParagraphSync(
          text,
          style.fontFamily ?? CONFIG.TEXT_DEFAULT_FONT_FAMILY,
          style as unknown as ParagraphOptions,
          maxWidth,
        )
        const result = { width: para.getMaxIntrinsicWidth(), height: para.getHeight() }
        para.delete()
        this.textMeasureCache.set(key, result)
        return result
      } catch {
        return { width: 0, height: 0 }
      }
    })
  }
}
