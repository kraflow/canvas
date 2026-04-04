import type { Yoga } from 'yoga-layout/load'
import { loadYoga, Direction, MeasureMode } from 'yoga-layout/load'
import type { CanvasKit } from 'canvaskit-wasm'
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
import { ImageCache } from '@/core/renderer/draw/image-cache'
import { toSerializableScreen } from './serialization'
import type { StyleProp } from '@/core/styles'

/** Properties that, when changed, require a Yoga layout recomputation. */
const LAYOUT_PROPS = new Set([
  'display',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'alignSelf',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'aspectRatio',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginEnd',
  'marginStart',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'paddingEnd',
  'paddingStart',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderEndWidth',
  'borderStartWidth',
  'gap',
  'rowGap',
  'columnGap',
  'position',
  'overflow',
  'direction',
  'zIndex',
  'boxSizing',
])

/**
 * A scene graph manages a collection of Screens, each containing a tree of
 * SceneNodes. Each node has an attached Yoga layout node for flex computation.
 */
export class SceneGraph {
  private readonly yoga: Yoga
  private readonly ck: CanvasKit
  private readonly fonts: FontSystem
  private readonly textMeasureCache = new TextMeasureCache()
  private readonly imageCache: ImageCache
  private readonly screens = new Map<string, ScreenNode>()
  private nextId = 1

  private constructor(yoga: Yoga, ck: CanvasKit, fonts: FontSystem) {
    this.yoga = yoga
    this.ck = ck
    this.fonts = fonts
    this.imageCache = new ImageCache(ck)
  }

  /**
   * Creates a new SceneGraph. Loads the Yoga WASM module and requires CanvasKit + Fonts
   * for accurate text measurement.
   */
  public static async create(ck: CanvasKit, fonts: FontSystem): Promise<SceneGraph> {
    const yoga = await loadYoga()
    return new SceneGraph(yoga, ck, fonts)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Screen management
  // ─────────────────────────────────────────────────────────────────────────

  public addScreen(id: string, x: number, y: number, width: number, height: number): ScreenNode {
    if (this.screens.has(id)) {
      throw new Error(`[SceneGraph] Screen "${id}" already exists`)
    }

    const yogaRoot = this.yoga.Node.create()
    yogaRoot.setWidth(width)
    yogaRoot.setHeight(height)

    const root: SceneNode = {
      id: this.genId('root'),
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

  public removeScreen(id: string): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.root.yogaNode.freeRecursive()
    this.screens.delete(id)
  }

  public moveScreen(id: string, x: number, y: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.x = x
    screen.y = y
  }

  public resizeScreen(id: string, width: number, height: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.width = width
    screen.height = height
    screen.root.yogaNode.setWidth(width)
    screen.root.yogaNode.setHeight(height)
    screen.dirty = true
  }

  public getScreen(id: string): ScreenNode | undefined {
    return this.screens.get(id)
  }

  public getNodeById(id: string): SceneNode | undefined {
    for (const screen of this.screens.values()) {
      const node = this.findNodeRecursive(screen.root, id)
      if (node) return node
    }
    return undefined
  }

  private findNodeRecursive(node: SceneNode, id: string): SceneNode | undefined {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = this.findNodeRecursive(child, id)
      if (found) return found
    }
    return undefined
  }

  public get allScreens(): IterableIterator<ScreenNode> {
    return this.screens.values()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node management
  // ─────────────────────────────────────────────────────────────────────────

  public createNode(
    type: SceneNodeType,
    styleProp: StyleProp<ViewStyle | TextStyle | ImageStyle>,
    src?: string,
  ): SceneNode {
    const style = flattenStyle(styleProp)
    const yogaNode = this.yoga.Node.create()

    const node: SceneNode = {
      id: this.genId(type),
      type,
      style,
      src,
      children: [],
      parent: null,
      yogaNode,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    }

    if (type === 'text') {
      this.setupTextMeasurement(node)
    }

    if (type === 'image' && src) {
      this.imageCache.load(src).then((image) => {
        if (image) node.image = image
      })
    }

    syncStyleToYoga(this.yoga, yogaNode, style)
    return node
  }

  public appendChild(parent: SceneNode, child: SceneNode): void {
    if (child.parent) {
      this.removeChild(child.parent, child)
    }
    child.parent = parent
    parent.children.push(child)
    parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount())
    this.markDirtyUp(parent, true)
  }

  public insertChild(parent: SceneNode, child: SceneNode, index: number): void {
    if (child.parent) {
      this.removeChild(child.parent, child)
    }
    child.parent = parent
    parent.children.splice(index, 0, child)
    parent.yogaNode.insertChild(child.yogaNode, index)
    this.markDirtyUp(parent, true)
  }

  public removeChild(parent: SceneNode, child: SceneNode): void {
    const idx = parent.children.indexOf(child)
    if (idx === -1) return
    parent.children.splice(idx, 1)
    parent.yogaNode.removeChild(child.yogaNode)
    child.parent = null
    this.markDirtyUp(parent, true)
  }

  public destroyNode(node: SceneNode): void {
    if (node.parent) {
      throw new Error('[SceneGraph] Node must be detached before destroying')
    }
    node.yogaNode.freeRecursive()
  }

  public applyStyle(
    node: SceneNode,
    styleProp: StyleProp<ViewStyle | TextStyle | ImageStyle>,
  ): void {
    const oldStyle = node.style
    const style = flattenStyle(styleProp)
    node.style = style

    let needsLayout = false
    const styleObj = style as Record<string, unknown>
    const oldStyleObj = oldStyle as Record<string, unknown>

    for (const key in styleObj) {
      if (LAYOUT_PROPS.has(key) && styleObj[key] !== oldStyleObj[key]) {
        needsLayout = true
        break
      }
    }

    if (needsLayout) {
      syncStyleToYoga(this.yoga, node.yogaNode, style)
    }

    this.markDirtyUp(node, needsLayout)
  }

  public setText(node: SceneNode, text: string): void {
    if (node.type !== 'text') return
    if (node.text === text) return

    node.text = text
    node.yogaNode.markDirty()
    this.markDirtyUp(node, true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout & Traversal
  // ─────────────────────────────────────────────────────────────────────────

  private lastPruneTime = 0
  private readonly PRUNE_INTERVAL = 30000 // 30 seconds

  public computeAllLayouts(): void {
    const now = Date.now()
    if (now - this.lastPruneTime > this.PRUNE_INTERVAL) {
      this.textMeasureCache.pruneStale()
      this.lastPruneTime = now
    }

    for (const screen of this.screens.values()) {
      if (screen.dirty) {
        screen.root.yogaNode.calculateLayout(screen.width, screen.height, Direction.LTR)
        this.readLayout(screen.root)
        screen.dirty = false
      }
    }
  }

  public walk(visitor: WalkVisitor): void {
    for (const screen of this.screens.values()) {
      this.walkNode(screen.root, screen.x, screen.y, visitor)
    }
  }

  /**
   * Finds the topmost SceneNode at the given world (camera-space) coordinates.
   */
  public hitTest(worldX: number, worldY: number): SceneNode | null {
    // Walk screens in reverse order of addition
    const screens = Array.from(this.screens.values()).reverse()
    for (const screen of screens) {
      const hit = this.hitTestNode(screen.root, screen.x, screen.y, worldX, worldY)
      if (hit) return hit
    }
    return null
  }

  /**
   * Finds all SceneNodes whose absolute bounds are at least 80% covered by the selection box.
   * Returns the "top-most" (outer-most) nodes only.
   */
  public boxTest(worldRect: LayoutRect): SceneNode[] {
    const hits: SceneNode[] = []
    // Process screens in reverse to match visual stacking
    const screens = Array.from(this.screens.values()).reverse()
    for (const screen of screens) {
      this.boxTestNode(screen.root, screen.x, screen.y, worldRect, hits)
    }
    return hits
  }

  private boxTestNode(
    node: SceneNode,
    parentAbsX: number,
    parentAbsY: number,
    worldRect: LayoutRect,
    results: SceneNode[],
  ) {
    const absRect = {
      x: parentAbsX + node.rect.x,
      y: parentAbsY + node.rect.y,
      w: node.rect.w,
      h: node.rect.h,
    }

    // 1. Check intersection ratio (80% threshold)
    const ratio = this.getIntersectionRatio(worldRect, absRect)
    const threshold = 0.8

    // We typically don't marquee-select the screen itself, just its children.
    if (!node.id.startsWith('root') && ratio >= threshold) {
      results.push(node)
      // Top-most hit found! Do not traverse deeper into children.
      return
    }

    // 2. If parent not selected, check its children
    let childOffX = absRect.x
    let childOffY = absRect.y
    if (node.scroll) {
      childOffX -= node.scroll.x
      childOffY -= node.scroll.y
    }

    for (const child of node.children) {
      this.boxTestNode(child, childOffX, childOffY, worldRect, results)
    }
  }

  private getIntersectionRatio(r1: LayoutRect, r2: LayoutRect): number {
    const xOverlap = Math.max(0, Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x))
    const yOverlap = Math.max(0, Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y))
    const overlapArea = xOverlap * yOverlap
    const r2Area = r2.w * r2.h
    if (r2Area <= 0) return 0
    return overlapArea / r2Area
  }

  /**
   * Serializes the entire SceneGraph (all screens and nodes) to a plain object.
   * This object can be safely converted to a JSON string for file storage.
   */
  public exportProject(): SerializedProject {
    const screens: SerializedScreenNode[] = []
    for (const screen of this.screens.values()) {
      screens.push(toSerializableScreen(screen))
    }

    return {
      version: '1.0.0',
      screens,
    }
  }

  /**
   * Clears the current state and reconstructs the scene graph from a serialized project.
   */
  public async importProject(project: SerializedProject): Promise<void> {
    this.dispose()

    for (const s of project.screens) {
      const screen = this.addScreen(s.id, s.x, s.y, s.width, s.height)
      // Apply root style and children
      this.applyStyle(screen.root, s.root.style)
      for (const childData of s.root.children) {
        const child = await this.reconstructNode(childData)
        this.appendChild(screen.root, child)
      }
    }

    this.computeAllLayouts()
  }

  private async reconstructNode(data: SerializedSceneNode): Promise<SceneNode> {
    const node = this.createNode(data.type, data.style, data.src)
    node.text = data.text
    node.scroll = data.scroll

    // Recursively add children
    for (const childData of data.children) {
      const child = await this.reconstructNode(childData)
      this.appendChild(node, child)
    }

    return node
  }

  public dispose(): void {
    for (const screen of this.screens.values()) {
      screen.root.yogaNode.freeRecursive()
    }
    this.screens.clear()
    this.textMeasureCache.clear()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private genId(prefix: string): string {
    return `${prefix}_${this.nextId++}`
  }

  private markDirtyUp(node: SceneNode, _layoutDirty: boolean): void {
    let current: SceneNode | null = node
    while (current?.parent) {
      current = current.parent
    }
    for (const screen of this.screens.values()) {
      if (screen.root === current) {
        screen.dirty = true
        return
      }
    }
  }

  private readLayout(node: SceneNode): void {
    const layout = node.yogaNode.getComputedLayout()
    node.rect.x = layout.left
    node.rect.y = layout.top
    node.rect.w = layout.width
    node.rect.h = layout.height

    for (const child of node.children) {
      this.readLayout(child)
    }
  }

  private walkNode(
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

    let childOffX = absRect.x
    let childOffY = absRect.y
    if (node.scroll) {
      childOffX -= node.scroll.x
      childOffY -= node.scroll.y
    }

    for (const child of node.children) {
      this.walkNode(child, childOffX, childOffY, visitor)
    }
  }

  private hitTestNode(
    node: SceneNode,
    parentAbsX: number,
    parentAbsY: number,
    worldX: number,
    worldY: number,
  ): SceneNode | null {
    const absX = parentAbsX + node.rect.x
    const absY = parentAbsY + node.rect.y
    const absW = node.rect.w
    const absH = node.rect.h

    // 1. Check children first (top-down in Z-order)
    let childOffX = absX
    let childOffY = absY
    if (node.scroll) {
      childOffX -= node.scroll.x
      childOffY -= node.scroll.y
    }

    const children = Array.from(node.children).reverse()
    for (const child of children) {
      const hit = this.hitTestNode(child, childOffX, childOffY, worldX, worldY)
      if (hit) return hit
    }

    // 2. Check if point is inside this node's bounds
    if (worldX >= absX && worldX <= absX + absW && worldY >= absY && worldY <= absY + absH) {
      // Check pointer-events style if we want to support it
      const style = node.style as Record<string, unknown>
      if (style.pointerEvents === 'none') return null
      return node
    }

    return null
  }

  private setupTextMeasurement(node: SceneNode): void {
    node.yogaNode.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      const text = node.text || ''
      const style = node.style as TextStyle
      const fontFamily = style.fontFamily || 'Inter'

      // Constraint width
      const maxWidth =
        widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost ? width : 1e9

      // 1. Check cache first
      const cacheKey = this.textMeasureCache.makeKey(text, style, maxWidth)
      const cached = this.textMeasureCache.get(cacheKey)
      if (cached) return cached

      // 2. Compute measurement (expensive)
      try {
        const paragraph = this.fonts.makeParagraphSync(
          text,
          fontFamily,
          style as unknown as ParagraphOptions,
          maxWidth,
        )
        const result = {
          width: paragraph.getMaxIntrinsicWidth(),
          height: paragraph.getHeight(),
        }
        paragraph.delete()

        // 3. Store in cache
        this.textMeasureCache.set(cacheKey, result)
        return result
      } catch (e) {
        console.warn('[SceneGraph] Text measurement failed', e)
        return { width: 0, height: 0 }
      }
    })
  }
}
