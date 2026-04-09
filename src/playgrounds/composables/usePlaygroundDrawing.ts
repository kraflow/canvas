import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { Ref } from 'vue'
import {
  renderView,
  renderText,
  renderImage,
  renderInfiniteGrid,
  drawHoverHighlight,
  drawSelectionHighlight,
  drawMarqueeSelection,
  drawPlacementGhost,
  drawScreenTitle,
  type SceneGraph,
  type FontSystem,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
  type DrawContext,
  type Viewport,
  type ImageCache,
  InteractionManager,
} from '@/index'

export interface DrawingDeps {
  scene: Ref<SceneGraph | null>
  interaction: Ref<InteractionManager | null>
  viewport: Viewport
  fonts: Ref<FontSystem | undefined>
  imageCache: Ref<ImageCache | null>
  showGrid: Ref<boolean>
  isPlacingScreen: Ref<boolean>
  ghostScreenPos: Ref<{ x: number; y: number }>
  ghostOverlap: Ref<boolean>
  SCREEN_WIDTH: number
  SCREEN_HEIGHT: number
}

export function createDrawFunction(deps: DrawingDeps) {
  return (canvas: Canvas, ck: CanvasKit, ctx: DrawContext) => {
    if (!deps.scene.value) return

    const interactionState = deps.interaction.value?.getState()

    // 1. Layout & Setup
    deps.scene.value.computeLayouts()

    // 2. Background Grid
    canvas.save()
    const bounds = canvas.getDeviceClipBounds()
    renderInfiniteGrid(
      ck,
      canvas,
      deps.viewport,
      bounds[2] ?? 0,
      bounds[3] ?? 0,
      deps.showGrid.value,
      ctx,
    )
    canvas.restore()

    // 2. Render Tree
    deps.scene.value.walk((node, absRect) => {
      if (node.type === 'view') {
        renderView(ck, canvas, node.style as ViewStyle, absRect, node.scroll, undefined, ctx)
      } else if (node.type === 'text') {
        renderText(
          ck,
          canvas,
          node.style as TextStyle,
          absRect,
          node.text || '',
          deps.fonts.value,
          undefined,
          ctx,
        )
      } else if (node.type === 'image') {
        renderImage(
          ck,
          canvas,
          node.style as ImageStyle,
          absRect,
          deps.imageCache.value!.get(node.src!),
          ctx,
        )
      }
    })

    // 3. Render Interaction Overlays
    if (interactionState) {
      // Draw hover highlight
      if (interactionState.hoveredNode) {
        drawHoverHighlight(ck, canvas, interactionState.hoveredNode.worldRect, deps.viewport.zoom, ctx)
      }

      // Draw selection highlights
      for (const id of interactionState.selectedNodes) {
        const node = deps.scene.value.getNode(id)
        if (node) {
          drawSelectionHighlight(ck, canvas, node.worldRect, deps.viewport.zoom, ctx)
        } else {
          // Check screens if not in nodes (Screens are special)
          const screen = deps.scene.value.getScreen(id)
          if (screen) {
            drawSelectionHighlight(ck, canvas, screen.root.worldRect, deps.viewport.zoom, ctx)
          }
        }
      }

      // Draw marquee selection
      if (interactionState.isBoxSelecting && interactionState.selectionBox) {
        drawMarqueeSelection(ck, canvas, interactionState.selectionBox, deps.viewport.zoom, ctx)
      }

      // Draw placement ghost
      if (deps.isPlacingScreen.value) {
        drawPlacementGhost(
          ck,
          canvas,
          {
            x: deps.ghostScreenPos.value.x,
            y: deps.ghostScreenPos.value.y,
            w: deps.SCREEN_WIDTH,
            h: deps.SCREEN_HEIGHT,
          },
          deps.viewport.zoom,
          deps.ghostOverlap.value,
          ctx,
        )
      }

      // Draw screen titles
      for (const screen of deps.scene.value.allScreens) {
        drawScreenTitle(ck, canvas, screen.name, screen.root.worldRect, deps.viewport.zoom, deps.fonts.value!)
      }
    }
  }
}
