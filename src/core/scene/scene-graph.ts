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
import { SpatialIndex } from './SpatialIndex'
import {
  DrawContext,
} from '@/core/renderer/draw'



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

export class SceneGraph {
  private readonly yoga: Yoga
  private readonly ck: CanvasKit
  public readonly fonts: FontSystem
  private readonly textMeasureCache = new TextMeasureCache()
  private readonly imageCache: ImageCache
  private readonly screens = new Map<string, ScreenNode>()
  private readonly nodes = new Map<string, SceneNode>()
  public readonly spatialIndex = new SpatialIndex()
  public readonly drawContext: DrawContext
  private _revision = 0
  private nextId = 1

  public get revision(): number {
    return this._revision
  }

  private constructor(yoga: Yoga, ck: CanvasKit, fonts: FontSystem) {
    this.yoga = yoga
    this.ck = ck
    this.fonts = fonts
    this.imageCache = new ImageCache(ck)
    this.drawContext = new DrawContext(ck)
  }

  public static async create(ck: CanvasKit, fonts: FontSystem): Promise<SceneGraph> {
    const yoga = await loadYoga()
    return new SceneGraph(yoga, ck, fonts)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Screen management
  // ─────────────────────────────────────────────────────────────────────────

  public addScreen(id: string, name: string, x: number, y: number, width: number, height: number): ScreenNode {
    if (this.screens.has(id)) {
      throw new Error(`[SceneGraph] Screen "${id}" already exists`)
    }

    const yogaRoot = this.yoga.Node.create()
    yogaRoot.setWidth(width)
    yogaRoot.setHeight(height)

    const root: SceneNode = {
      id: this.genId('root'),
      type: 'view',
      style: { backgroundColor: new Float32Array([1, 1, 1, 1]) }, // Default white background
      children: [],
      parent: null,
      yogaNode: yogaRoot,
      rect: { x: 0, y: 0, w: width, h: height },
      worldRect: { x, y, w: width, h: height },
      scroll: { x: 0, y: 0 },
    }

    const screen: ScreenNode = {
      id,
      name,
      x,
      y,
      width,
      height,
      root,
      dirty: true,
    }

    this.screens.set(id, screen)
    this.nodes.set(root.id, root)
    this.spatialIndex.insert(root)
    this._revision++
    return screen
  }

  public removeScreen(id: string): void {
    const screen = this.screens.get(id)
    if (!screen) return
    this.spatialIndex.remove(screen.root)
    this.removeNodeFromMapRecursive(screen.root)
    screen.root.yogaNode.freeRecursive()
    this.screens.delete(id)
    this._revision++
  }

  private removeNodeFromMapRecursive(node: SceneNode): void {
    this.nodes.delete(node.id)
    for (const child of node.children) {
      this.removeNodeFromMapRecursive(child)
    }
  }

  public moveScreen(id: string, x: number, y: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    const dx = x - screen.x
    const dy = y - screen.y
    screen.x = x
    screen.y = y
    screen.dirty = true
    this.updateWorldRectsRecursive(screen.root, dx, dy)
    this._revision++
  }

  private updateWorldRectsRecursive(node: SceneNode, dx: number, dy: number): void {
    node.worldRect.x += dx
    node.worldRect.y += dy
    this.spatialIndex.update(node)
    for (const child of node.children) {
      this.updateWorldRectsRecursive(child, dx, dy)
    }
  }

  public resizeScreen(id: string, width: number, height: number): void {
    const screen = this.screens.get(id)
    if (!screen) return
    screen.width = width
    screen.height = height
    screen.root.yogaNode.setWidth(width)
    screen.root.yogaNode.setHeight(height)
    screen.dirty = true
    this.spatialIndex.update(screen.root)
    this._revision++
  }

  public getScreen(id: string): ScreenNode | undefined {
    return this.screens.get(id)
  }

  public getNodeById(id: string): SceneNode | undefined {
    return this.nodes.get(id)
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
      worldRect: { x: 0, y: 0, w: 0, h: 0 },
      scroll: { x: 0, y: 0 },
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
    this.nodes.set(node.id, node)
    this.spatialIndex.insert(node)
    this._revision++
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
    this._revision++
  }

  public insertChild(parent: SceneNode, child: SceneNode, index: number): void {
    if (child.parent) {
      this.removeChild(child.parent, child)
    }
    child.parent = parent
    parent.children.splice(index, 0, child)
    parent.yogaNode.insertChild(child.yogaNode, index)
    this.markDirtyUp(parent, true)
    this._revision++
  }

  public removeChild(parent: SceneNode, child: SceneNode): void {
    const idx = parent.children.indexOf(child)
    if (idx === -1) return
    parent.children.splice(idx, 1)
    parent.yogaNode.removeChild(child.yogaNode)
    child.parent = null
    this.markDirtyUp(parent, true)
    this._revision++
  }

  public destroyNode(node: SceneNode): void {
    if (node.parent) {
      throw new Error('[SceneGraph] Node must be detached before destroying')
    }
    this.spatialIndex.remove(node)
    this.removeNodeFromMapRecursive(node)
    node.yogaNode.freeRecursive()
    this._revision++
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
    this.spatialIndex.update(node)
    this._revision++
  }

  public setText(node: SceneNode, text: string): void {
    if (node.type !== 'text') return
    if (node.text === text) return

    node.text = text
    node.yogaNode.markDirty()
    this.markDirtyUp(node, true)
    this.spatialIndex.update(node)
    this._revision++
  }

  public updateNode(
    id: string,
    updates: {
      name?: string
      x?: number
      y?: number
      style?: StyleProp<ViewStyle | TextStyle | ImageStyle>
      text?: string
      src?: string
      scroll?: { x: number; y: number }
    },
  ): void {
    const screen = this.screens.get(id)
    if (screen) {
      if (updates.name !== undefined) screen.name = updates.name
      if (updates.x !== undefined || updates.y !== undefined) {
        this.moveScreen(id, updates.x ?? screen.x, updates.y ?? screen.y)
      }
      if (updates.style) {
        this.applyStyle(screen.root, updates.style)
      }
      return
    }

    const node = this.nodes.get(id)
    if (!node) return

    if (updates.style) {
      this.applyStyle(node, updates.style)
    }
    if (updates.text !== undefined) {
      this.setText(node, updates.text)
    }
    if (updates.src !== undefined) {
      node.src = updates.src
    }
    if (updates.scroll !== undefined) {
      node.scroll = updates.scroll
    }

    this._revision++
  }

  public reparent(nodeId: string, newParentId: string, index?: number): void {
    const node = this.nodes.get(nodeId)
    const newParent = this.nodes.get(newParentId)
    if (!node || !newParent) return
    if (node.id === newParent.id) return

    // Prevent circular parenting
    let curr: SceneNode | null = newParent
    while (curr) {
      if (curr.id === node.id) return
      curr = curr.parent
    }

    if (node.parent) {
      this.removeChild(node.parent, node)
    }

    if (index !== undefined) {
      this.insertChild(newParent, node, index)
    } else {
      this.appendChild(newParent, node)
    }
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
        this.readLayout(screen.root, screen.x, screen.y)
        screen.dirty = false
      }
    }

    // Rebuild spatial index
    this.spatialIndex.rebuild(this.nodes.values())
  }

  public walk(visitor: WalkVisitor): void {
    for (const screen of this.screens.values()) {
      this.walkNode(screen.root, screen.x, screen.y, visitor)
    }
  }


  public hitTest(worldX: number, worldY: number): SceneNode | null {
    const candidates = this.spatialIndex.getCandidatesAtPoint(worldX, worldY)
    if (candidates.length === 0) return null

    let bestHit: SceneNode | null = null
    let maxDepth = -1

    for (const node of candidates) {
      if (this.containsPoint(node.worldRect, worldX, worldY)) {
        if ((node.style as Record<string, unknown>).pointerEvents === 'none') continue

        const depth = this.getNodeDepth(node)
        if (depth > maxDepth) {
          maxDepth = depth
          bestHit = node
        }
      }
    }

    return bestHit
  }

  public boxTest(worldRect: LayoutRect): SceneNode[] {
    const candidates = this.spatialIndex.getCandidatesInRect(worldRect)
    const hits: SceneNode[] = []
    const threshold = 0.0 // Any intersection selects

    for (const node of candidates) {
      const ratio = this.getIntersectionRatio(worldRect, node.worldRect)
      if (ratio >= threshold) {
        hits.push(node)
      }
    }

    // Filter out:
    // 1. Children if their parent is also selected
    // 2. ROOT nodes (Screens themselves) - Figma-like box selection only picks nodes inside screens
    const topMostHits: SceneNode[] = []
    
    // First, identify which of the hits are "selectable" (non-screen roots)
    const selectableHits = hits.filter(node => 
      !Array.from(this.screens.values()).some((s) => s.root.id === node.id)
    )

    for (const node of selectableHits) {
      let parentSelected = false
      let curr = node.parent
      while (curr) {
        if (selectableHits.includes(curr)) {
          parentSelected = true
          break
        }
        curr = curr.parent
      }
      if (!parentSelected) {
        topMostHits.push(node)
      }
    }

    return topMostHits
  }

  public exportProject(): SerializedProject {
    const screens: SerializedScreenNode[] = []
    for (const screen of this.screens.values()) {
      screens.push(toSerializableScreen(screen))
    }
    return { version: '1.0.0', screens }
  }

  public async importProject(project: SerializedProject): Promise<void> {
    this.dispose()
    for (const s of project.screens) {
      const screen = this.addScreen(s.id, s.name, s.x, s.y, s.width, s.height)
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
    this.nodes.clear()
    this.spatialIndex.clear()
    this.textMeasureCache.clear()
    this.drawContext.dispose()
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


  private readLayout(node: SceneNode, parentAbsX: number, parentAbsY: number): void {
    const layout = node.yogaNode.getComputedLayout()
    node.rect.x = layout.left
    node.rect.y = layout.top
    node.rect.w = layout.width
    node.rect.h = layout.height

    node.worldRect.x = parentAbsX + node.rect.x
    node.worldRect.y = parentAbsY + node.rect.y
    node.worldRect.w = node.rect.w
    node.worldRect.h = node.rect.h

    let childAbsX = node.worldRect.x
    let childAbsY = node.worldRect.y
    if (node.scroll) {
      childAbsX -= node.scroll.x
      childAbsY -= node.scroll.y
    }
    for (const child of node.children) {
      this.readLayout(child, childAbsX, childAbsY)
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

  private containsPoint(rect: LayoutRect, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  private getNodeDepth(node: SceneNode): number {
    let depth = 0
    let curr = node.parent
    while (curr) {
      depth++
      curr = curr.parent
    }
    return depth
  }

  private getIntersectionRatio(r1: LayoutRect, r2: LayoutRect): number {
    const xOverlap = Math.max(0, Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x))
    const yOverlap = Math.max(0, Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y))
    const overlapArea = xOverlap * yOverlap
    const r2Area = r2.w * r2.h
    if (r2Area <= 0) return 0
    return overlapArea / r2Area
  }

  private setupTextMeasurement(node: SceneNode): void {
    node.yogaNode.setMeasureFunc((width, widthMode, _height, _heightMode) => {
      const text = node.text || ''
      const style = node.style as TextStyle
      const fontFamily = style.fontFamily || 'Inter'
      const maxWidth =
        widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost ? width : 1e9

      const cacheKey = this.textMeasureCache.makeKey(text, style, maxWidth)
      const cached = this.textMeasureCache.get(cacheKey)
      if (cached) return cached

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
        this.textMeasureCache.set(cacheKey, result)
        return result
      } catch (e) {
        console.warn('[SceneGraph] Text measurement failed', e)
        return { width: 0, height: 0 }
      }
    })
  }
}
