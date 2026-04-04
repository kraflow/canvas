<template>
  <div class="canvas-container">
    <!-- Toolbar -->
    <div class="toolbar">
      <button
        :class="['tool-btn', activeMode === 'edit' ? 'active' : '']"
        @click="setMode('edit')"
        title="Edit Mode (V)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 3 3.057 14.947c.142.699.94 1.002 1.492.56L13.5 15.5l3.5 6.5 2.5-1.5-3.5-6.5 4.586-1.586c.618-.213.684-1.047.113-1.353L5 3z"/></svg>
        <span>Edit</span>
      </button>
      <button
        :class="['tool-btn', activeMode === 'move' ? 'active' : '']"
        @click="setMode('move')"
        title="Move Mode (H)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/><path d="M6 15V13a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/></svg>
        <span>Move</span>
      </button>
    </div>

    <canvas ref="canvasRef" :class="{ 'cursor-hand': activeMode === 'move' }"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { Canvas, CanvasKit, Image as CKImage } from 'canvaskit-wasm'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CanvasRenderer, loadCanvasKit } from '@/core/renderer'
import { createFontSystem, type FontSystem } from '@/core/fonts'
import { renderView, renderText, renderImage, ImageCache, DrawContext } from '@/core/renderer/draw'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import { SceneGraph, type SceneNode } from '@/core/scene'
import { InteractionManager } from '@/core/interaction/InteractionManager'
import { Viewport } from '@/core/viewport/Viewport'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasRenderer | null = null
const interactionManager = ref<InteractionManager | null>(null)
const viewport = new Viewport()
const activeMode = ref<'edit' | 'move'>('edit')

const setMode = (mode: 'edit' | 'move') => {
  activeMode.value = mode
  interactionManager.value?.setMode(mode)
}

let ck: CanvasKit | null = null
let fonts: FontSystem | null = null
let imageCache: ImageCache | null = null
let drawCtx: DrawContext | null = null
let scene: SceneGraph | null = null
let demoImage: CKImage | null = null

// =============================================================================
// Styles
// =============================================================================

// ── Screen 1: Card Layout ───────────────────────────────────────────────────

const screen1RootStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.09, 0.09, 0.11, 1]),
  borderRadius: 20,
  borderWidth: 1,
  borderColor: Float32Array.from([1, 1, 1, 0.06]),
  padding: 24,
  flexDirection: 'column',
  gap: 16,
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 12,
      blurRadius: 40,
      color: Float32Array.from([0, 0, 0, 0.6]),
    },
  ],
}

const headerStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.16, 0.2, 0.32, 1]),
  borderRadius: 14,
  padding: 20,
  flexDirection: 'column',
  gap: 6,
}

const titleTextStyle: TextStyle = {
  color: Float32Array.from([1, 1, 1, 1]),
  fontSize: 22,
  fontWeight: 700,
  fontFamily: 'Inter',
  height: 28,
}

const subtitleTextStyle: TextStyle = {
  color: Float32Array.from([0.6, 0.6, 0.65, 1]),
  fontSize: 13,
  fontFamily: 'Inter',
  fontWeight: 400,
  height: 18,
}

const imageContainerStyle: ImageStyle = {
  borderRadius: 12,
  overflow: 'hidden',
  height: 160,
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 4,
      blurRadius: 16,
      color: Float32Array.from([0, 0, 0, 0.5]),
    },
  ],
}

const bodyTextStyle: TextStyle = {
  color: Float32Array.from([0.75, 0.75, 0.78, 1]),
  fontSize: 14,
  fontFamily: 'Inter',
  fontWeight: 400,
  lineHeight: 22,
  height: 66,
}

const footerStyle: ViewStyle = {
  flexDirection: 'row',
  gap: 10,
  justifyContent: 'flex-start',
  alignItems: 'center',
}

const badgeStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.42, 0.27, 0.96, 0.15]),
  borderRadius: 8,
  borderWidth: 1,
  borderColor: Float32Array.from([0.42, 0.27, 0.96, 0.3]),
  padding: 6,
  paddingLeft: 12,
  paddingRight: 12,
}

const badgeTextStyle: TextStyle = {
  color: Float32Array.from([0.55, 0.42, 1, 1]),
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 600,
  height: 16,
}

// ── Screen 2: Flex Row Layout ───────────────────────────────────────────────

const screen2RootStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.09, 0.09, 0.11, 1]),
  borderRadius: 20,
  borderWidth: 1,
  borderColor: Float32Array.from([1, 1, 1, 0.06]),
  padding: 24,
  flexDirection: 'column',
  gap: 16,
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 12,
      blurRadius: 40,
      color: Float32Array.from([0, 0, 0, 0.6]),
    },
  ],
}

const screen2TitleStyle: TextStyle = {
  color: Float32Array.from([1, 1, 1, 1]),
  fontSize: 18,
  fontWeight: 700,
  fontFamily: 'Inter',
  height: 24,
}

const flexRowStyle: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 12,
}

const flexBoxColors = [
  Float32Array.from([0.42, 0.27, 0.96, 0.2]),
  Float32Array.from([0.2, 0.78, 0.47, 0.2]),
  Float32Array.from([1, 0.5, 0.2, 0.2]),
  Float32Array.from([0.31, 0.67, 1, 0.2]),
  Float32Array.from([0.96, 0.27, 0.42, 0.2]),
  Float32Array.from([0.8, 0.8, 0.2, 0.2]),
]

const flexBoxBorders = [
  Float32Array.from([0.42, 0.27, 0.96, 0.4]),
  Float32Array.from([0.2, 0.78, 0.47, 0.4]),
  Float32Array.from([1, 0.5, 0.2, 0.4]),
  Float32Array.from([0.31, 0.67, 1, 0.4]),
  Float32Array.from([0.96, 0.27, 0.42, 0.4]),
  Float32Array.from([0.8, 0.8, 0.2, 0.4]),
]

const flexBoxTextColors = [
  Float32Array.from([0.6, 0.45, 1, 1]),
  Float32Array.from([0.3, 0.9, 0.55, 1]),
  Float32Array.from([1, 0.6, 0.35, 1]),
  Float32Array.from([0.45, 0.75, 1, 1]),
  Float32Array.from([1, 0.4, 0.55, 1]),
  Float32Array.from([0.9, 0.9, 0.35, 1]),
]

const infoRowStyle: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 12,
  backgroundColor: Float32Array.from([1, 1, 1, 0.03]),
  borderRadius: 10,
}

const infoLabelStyle: TextStyle = {
  color: Float32Array.from([0.5, 0.5, 0.53, 1]),
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 400,
  height: 16,
  width: 120,
}

const infoValueStyle: TextStyle = {
  color: Float32Array.from([0.78, 0.78, 0.8, 1]),
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 600,
  height: 16,
  width: 140,
}

// =============================================================================
// Build Scene
// =============================================================================

function buildScene(sceneGraph: SceneGraph, img: CKImage | null): void {
  // ── Screen 1: Card Layout (positioned at 60, 40) ──────────────────────────
  const s1 = sceneGraph.addScreen('card', 60, 40, 420, 520)
  sceneGraph.applyStyle(s1.root, screen1RootStyle)

  // Header
  const header = sceneGraph.createNode('view', headerStyle)
  sceneGraph.appendChild(s1.root, header)

  const title = sceneGraph.createNode('text', titleTextStyle)
  title.text = 'Scene Graph'
  sceneGraph.appendChild(header, title)

  const subtitle = sceneGraph.createNode('text', subtitleTextStyle)
  subtitle.text = 'Yoga layout · DrawContext · Walk traversal'
  sceneGraph.appendChild(header, subtitle)

  // Image
  const imageNode = sceneGraph.createNode('image', imageContainerStyle)
  imageNode.image = img
  sceneGraph.appendChild(s1.root, imageNode)

  // Body text
  const body = sceneGraph.createNode('text', bodyTextStyle)
  body.text =
    'Each node is a plain object with an attached Yoga node. The walk() function traverses the tree and calls the renderer with absolute canvas coordinates.'
  sceneGraph.appendChild(s1.root, body)

  // Footer badges
  const footer = sceneGraph.createNode('view', footerStyle)
  sceneGraph.appendChild(s1.root, footer)

  for (const label of ['Yoga', 'DFS Walk', 'Screens']) {
    const badge = sceneGraph.createNode('view', badgeStyle)
    sceneGraph.appendChild(footer, badge)

    const badgeText = sceneGraph.createNode('text', badgeTextStyle)
    badgeText.text = label
    sceneGraph.appendChild(badge, badgeText)
  }

  // ── Screen 2: Flex Row (positioned at 520, 40) ────────────────────────────
  const s2 = sceneGraph.addScreen('flex', 520, 40, 360, 520)
  sceneGraph.applyStyle(s2.root, screen2RootStyle)

  // Title
  const flexTitle = sceneGraph.createNode('text', screen2TitleStyle)
  flexTitle.text = 'Flex Layout'
  sceneGraph.appendChild(s2.root, flexTitle)

  // Flex row with boxes
  const flexRow = sceneGraph.createNode('view', flexRowStyle)
  sceneGraph.appendChild(s2.root, flexRow)

  const boxLabels = ['View', 'Text', 'Image', 'Scroll', 'Border', 'Shadow']
  for (let i = 0; i < boxLabels.length; i++) {
    const boxStyle: ViewStyle = {
      backgroundColor: flexBoxColors[i],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: flexBoxBorders[i],
      width: 100,
      height: 72,
      justifyContent: 'center',
      alignItems: 'center',
    }
    const box = sceneGraph.createNode('view', boxStyle)
    sceneGraph.appendChild(flexRow, box)

    const boxText = sceneGraph.createNode('text', {
      color: flexBoxTextColors[i],
      fontSize: 13,
      fontFamily: 'Inter',
      fontWeight: 600,
      height: 16,
      width: 80,
      textAlign: 'center',
    } as TextStyle)
    boxText.text = boxLabels[i]!
    sceneGraph.appendChild(box, boxText)
  }

  // Info rows
  const infoItems = [
    ['Screens', '2 active'],
    ['Nodes', `${countNodes(s1.root) + countNodes(s2.root)} total`],
    ['Layout', 'Yoga 3.2'],
    ['Renderer', 'DrawContext pool'],
  ]

  for (const [label, value] of infoItems) {
    const row = sceneGraph.createNode('view', infoRowStyle)
    sceneGraph.appendChild(s2.root, row)

    const labelNode = sceneGraph.createNode('text', infoLabelStyle)
    labelNode.text = label!
    sceneGraph.appendChild(row, labelNode)

    const valueNode = sceneGraph.createNode('text', infoValueStyle)
    valueNode.text = value!
    sceneGraph.appendChild(row, valueNode)
  }

  // Compute all layouts
  sceneGraph.computeAllLayouts()
}

function countNodes(node: SceneNode): number {
  let count = 1
  for (const child of node.children) {
    count += countNodes(child)
  }
  return count
}

// =============================================================================
// Draw
// =============================================================================

function draw(canvas: Canvas, ckRef: CanvasKit) {
  if (!scene || !drawCtx) return

  drawCtx.beginFrame()
  const ctx = drawCtx

  canvas.clear(ckRef.Color(10, 10, 12, 255))

  canvas.save()
  const v = viewport
  canvas.translate(v.x, v.y)
  canvas.scale(v.zoom, v.zoom)

  scene.walk((node, rect) => {
    switch (node.type) {
      case 'view':
        renderView(ckRef, canvas, node.style as ViewStyle, rect, node.scroll, undefined, ctx)
        break
      case 'text':
        renderText(ckRef, canvas, node.style as TextStyle, rect, node.text ?? '', fonts, null, ctx)
        break
      case 'image':
        renderImage(ckRef, canvas, node.style as ImageStyle, rect, node.image ?? null, ctx)
        break
    }
  })

  canvas.restore()

  // ── Overlays (Selection & Marquee) ──────────────────────────────────────────
  const state = interactionManager.value?.getState()
  const p = new ckRef.Paint()

  // 1. Draw marquee selection box
  if (state?.isBoxSelecting && state.selectionBox) {
    const box = state.selectionBox
    canvas.save()
    canvas.translate(v.x, v.y)
    canvas.scale(v.zoom, v.zoom)

    // Fill (Lighter BG: 0.1 alpha)
    p.setColor(ckRef.Color(108, 109, 254, 0.1))
    p.setStyle(ckRef.PaintStyle.Fill)
    canvas.drawRect(ckRef.XYWHRect(box.x, box.y, box.w, box.h), p)

    // Stroke
    p.setColor(ckRef.Color(108, 109, 254, 255))
    p.setStyle(ckRef.PaintStyle.Stroke)
    p.setStrokeWidth(1 / v.zoom)
    canvas.drawRect(ckRef.XYWHRect(box.x, box.y, box.w, box.h), p)

    canvas.restore()
  }

  // 2. Draw hover highlight
  if (state?.hoveredNode && !state.selectedNodes.has(state.hoveredNode.id)) {
    canvas.save()
    canvas.translate(v.x, v.y)
    canvas.scale(v.zoom, v.zoom)

    p.setColor(ckRef.Color(108, 109, 254, 150)) // Lower opacity for hover
    p.setStyle(ckRef.PaintStyle.Stroke)
    p.setStrokeWidth(1.5 / v.zoom)

    scene.walk((node, rect) => {
      if (node.id === state.hoveredNode?.id) {
        canvas.drawRect(ckRef.XYWHRect(rect.x, rect.y, rect.w, rect.h), p)
      }
    })

    canvas.restore()
  }

  // 3. Draw selected node outlines
  if (state?.selectedNodes.size) {
    canvas.save()
    canvas.translate(v.x, v.y)
    canvas.scale(v.zoom, v.zoom)

    p.setColor(ckRef.Color(108, 109, 254, 255))
    p.setStyle(ckRef.PaintStyle.Stroke)
    p.setStrokeWidth(2 / v.zoom)

    scene.walk((node, rect) => {
      if (state.selectedNodes.has(node.id)) {
        canvas.drawRect(ckRef.XYWHRect(rect.x, rect.y, rect.w, rect.h), p)
      }
    })

    canvas.restore()
  }

  p.delete()
}

// =============================================================================
// Mount
// =============================================================================

let cleanup: (() => void) | null = null

onMounted(async () => {
  try {
    if (!canvasRef.value) return

    ck = await loadCanvasKit()

    // ── Font system ─────────────────────────────────────────────────────────
    fonts = await createFontSystem(ck, {
      families: {
        Inter: {
          weights: [400, 600, 700],
          variants: {
            '400': {
              url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
              priority: 'eager',
            },
            '600': {
              url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf',
              priority: 'lazy',
            },
            '700': {
              url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
              priority: 'lazy',
            },
          },
          unicodeRanges: ['U+0000-00FF'],
        },
      },
      fallbackChain: ['Inter'],
      eagerLoad: ['Inter'],
    })

    // ── DrawContext ──────────────────────────────────────────────────────────
    drawCtx = new DrawContext(ck)

    // ── Image cache ─────────────────────────────────────────────────────────
    imageCache = new ImageCache(ck)
    demoImage = await imageCache.load(
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop',
    )

    // ── Scene graph ─────────────────────────────────────────────────────────
    scene = await SceneGraph.create(ck, fonts)
    buildScene(scene, demoImage)

    // ── Initialize canvas ───────────────────────────────────────────────────
    renderer = new CanvasRenderer({
      canvas: canvasRef.value,
      onDraw: draw,
    })

    await renderer.initialize()
    renderer.setAnimating(true)

    // ── Interaction manager ──────────────────────────────────────────────────
    interactionManager.value = new InteractionManager(canvasRef.value, scene, viewport)
    interactionManager.value.on((e) => {
      if (e.type === 'click' && e.node) {
        console.log('[SceneGraphDemo] Clicked node:', e.node.id, e.node.type)
      }
    })

    // ── Handle Resize ────────────────────────────────────────────────────────
    const handleResize = () => {
      if (canvasRef.value && canvasRef.value.parentElement) {
        const { clientWidth, clientHeight } = canvasRef.value.parentElement
        renderer?.resize(clientWidth, clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    // ── Keyboard shortcuts ──────────────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') setMode('edit')
      if (e.key.toLowerCase() === 'h') setMode('move')
    }
    window.addEventListener('keydown', handleKeyDown)

    cleanup = () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  } catch (error) {
    console.error('[SceneGraphDemo] Initialization failed:', error)
  }
})

// =============================================================================
// Cleanup
// =============================================================================

onBeforeUnmount(() => {
  cleanup?.()
  if (scene) {
    scene.dispose()
    scene = null
  }
  if (drawCtx) {
    drawCtx.dispose()
    drawCtx = null
  }
  if (imageCache) {
    imageCache.dispose()
    imageCache = null
  }
  demoImage = null
  renderer?.dispose()
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0a0a0c;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.cursor-hand {
  cursor: grab !important;
}

.cursor-hand:active {
  cursor: grabbing !important;
}

.toolbar {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: rgba(18, 18, 20, 0.8);
  backdrop-filter: blur(12px);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: #a1a1aa;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.tool-btn.active {
  background: #6c6dfe;
  color: #fff;
}

.tool-btn svg {
  opacity: 0.7;
}

.tool-btn.active svg {
  opacity: 1;
}
</style>
