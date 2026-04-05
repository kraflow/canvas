import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { LayoutRect } from '../renderer/types'
import type { DrawContext } from '../renderer/draw/draw-context'
import type { InteractionState } from './types'
import type { Viewport } from '../viewport/Viewport'
import {
  drawHoverHighlight,
  drawSelectionHighlight,
  drawMarqueeSelection,
  drawPlacementGhost,
  drawScreenTitle,
} from '../renderer/draw/overlays'
import type { SceneGraph } from '../scene/scene-graph'

export interface InteractionOverlayOptions {
  placementGhost?: LayoutRect & { overlap?: boolean }
}

/**
 * InteractionOverlayManager handles the rendering of interactive elements
 * (selections, hover states, marquees, ghosts) that are not part of the
 * persistent scene graph.
 */
export class InteractionOverlayManager {
  private ck: CanvasKit
  private ctx: DrawContext
  private scene: SceneGraph

  constructor(ck: CanvasKit, ctx: DrawContext, scene: SceneGraph) {
    this.ck = ck
    this.ctx = ctx
    this.scene = scene
  }

  /**
   * Renders all active interaction overlays based on the current state.
   */
  public render(
    canvas: Canvas,
    viewport: Viewport,
    state: InteractionState,
    options?: InteractionOverlayOptions,
  ): void {
    const ck = this.ck
    const zoom = viewport.zoom

    // 1. Draw Hover Highlight
    if (state.hoveredNode) {
      const node = state.hoveredNode
      drawHoverHighlight(ck, canvas, node.worldRect, zoom, this.ctx)
    }

    // 2. Draw Selection Highlights
    for (const id of state.selectedNodes) {
      const node = this.scene.getNodeById(id)
      if (node) {
        drawSelectionHighlight(ck, canvas, node.worldRect, zoom, this.ctx)
      } else {
        // Check screens if not in nodes (Screens are special)
        const screen = this.scene.getScreen(id)
        if (screen) {
          drawSelectionHighlight(ck, canvas, screen.root.worldRect, zoom, this.ctx)
        }
      }
    }

    // 3. Draw Marquee Selection
    if (state.isBoxSelecting && state.selectionBox) {
      drawMarqueeSelection(ck, canvas, state.selectionBox, zoom, this.ctx)
    }

    // 4. Draw Placement Ghost
    if (options?.placementGhost) {
      drawPlacementGhost(
        ck,
        canvas,
        options.placementGhost,
        zoom,
        options.placementGhost.overlap ?? false,
        this.ctx,
      )
    }

    // 5. Draw Screen Titles
    for (const screen of this.scene.allScreens) {
      drawScreenTitle(ck, canvas, screen.name, screen.root.worldRect, zoom, this.scene.fonts)
    }
  }
}
