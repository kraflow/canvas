<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { Canvas, CanvasKit, Image as CKImage } from 'canvaskit-wasm'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CanvasRenderer, loadCanvasKit } from '@/core/renderer'
import { createFontSystem, type FontSystem } from '@/core/fonts'
import { renderView, renderText, renderImage, ImageCache, DrawContext } from '@/core/renderer/draw'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'
import type { LayoutRect } from '@/core/renderer/types'
import { useViewport } from './useViewport'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasRenderer | null = null
const { camera } = useViewport(canvasRef, {
  onResize: (w, h) => renderer?.resize(w, h),
})

let ck: CanvasKit | null = null
let fonts: FontSystem | null = null
let imageCache: ImageCache | null = null
let drawCtx: DrawContext | null = null
let demoImage: CKImage | null = null

// =============================================================================
// Styles
// =============================================================================

const cardStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.11, 0.11, 0.14, 1]),
  borderRadius: 20,
  borderWidth: 1,
  borderColor: Float32Array.from([1, 1, 1, 0.08]),
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 8,
      blurRadius: 32,
      spreadDistance: -4,
      color: Float32Array.from([0, 0, 0, 0.6]),
    },
    {
      offsetX: 0,
      offsetY: 2,
      blurRadius: 8,
      color: Float32Array.from([0.31, 0.67, 1, 0.12]),
    },
  ],
}

const headerViewStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.18, 0.22, 0.35, 1]),
  borderRadius: 16,
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 24,
      color: Float32Array.from([0.31, 0.43, 1, 0.15]),
      inset: true,
    },
  ],
}

const accentViewStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.42, 0.27, 0.96, 0.15]),
  borderRadius: 12,
  borderWidth: 1,
  borderColor: Float32Array.from([0.42, 0.27, 0.96, 0.3]),
}

const imageCardStyle: ImageStyle = {
  borderRadius: 14,
  overflow: 'hidden',
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 4,
      blurRadius: 16,
      color: Float32Array.from([0, 0, 0, 0.5]),
    },
  ],
}

const tintedImageStyle: ImageStyle = {
  borderRadius: 14,
  overflow: 'hidden',
  tintColor: Float32Array.from([0.42, 0.27, 0.96, 0.7]),
}

const titleStyle: TextStyle = {
  color: Float32Array.from([1, 1, 1, 1]),
  fontSize: 28,
  fontWeight: 700,
  fontFamily: 'Inter',
}

const subtitleStyle: TextStyle = {
  color: Float32Array.from([0.63, 0.63, 0.67, 1]),
  fontSize: 15,
  fontFamily: 'Inter',
  fontWeight: 400,
}

const labelStyle: TextStyle = {
  color: Float32Array.from([0.42, 0.67, 1, 1]),
  fontSize: 13,
  fontFamily: 'Inter',
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
}

const bodyStyle: TextStyle = {
  color: Float32Array.from([0.78, 0.78, 0.8, 1]),
  fontSize: 14,
  fontFamily: 'Inter',
  fontWeight: 400,
  lineHeight: 22,
}

const badgeStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.2, 0.78, 0.47, 0.15]),
  borderRadius: 8,
  borderWidth: 1,
  borderColor: Float32Array.from([0.2, 0.78, 0.47, 0.3]),
}

const badgeTextStyle: TextStyle = {
  color: Float32Array.from([0.2, 0.85, 0.47, 1]),
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 600,
}

const outlineViewStyle: ViewStyle = {
  borderRadius: 16,
  borderWidth: 2,
  borderColor: Float32Array.from([1, 1, 1, 0.06]),
  borderStyle: 'dashed',
  outlineWidth: 2,
  outlineColor: Float32Array.from([0.42, 0.27, 0.96, 0.4]),
  outlineOffset: 4,
  outlineStyle: 'solid',
}

const scrollViewStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.08, 0.08, 0.1, 1]),
  borderRadius: 12,
  overflow: 'scroll',
  borderWidth: 1,
  borderColor: Float32Array.from([1, 1, 1, 0.06]),
}

const scrollContentStyle: ViewStyle = {
  backgroundColor: Float32Array.from([0.42, 0.27, 0.96, 0.1]),
  borderRadius: 8,
}

// =============================================================================
// Draw
// =============================================================================

function draw(canvas: Canvas, ckRef: CanvasKit) {
  const time = performance.now() * 0.001

  // Reset paint pool for this frame
  drawCtx!.beginFrame()
  const ctx = drawCtx!

  canvas.clear(ckRef.Color(12, 12, 14, 255))

  canvas.save()
  canvas.translate(camera.value.x, camera.value.y)
  canvas.scale(camera.value.zoom, camera.value.zoom)

  // ── Main Card ──────────────────────────────────────────────────────────────
  const cardRect: LayoutRect = { x: 60, y: 40, w: 520, h: 640 }
  renderView(ckRef, canvas, cardStyle, cardRect, undefined, undefined, ctx)

  // ── Header accent bar ─────────────────────────────────────────────────────
  const headerRect: LayoutRect = { x: 80, y: 60, w: 480, h: 72 }
  renderView(ckRef, canvas, headerViewStyle, headerRect, undefined, undefined, ctx)

  // ── Label ─────────────────────────────────────────────────────────────────
  renderText(
    ckRef,
    canvas,
    labelStyle,
    { x: 100, y: 72, w: 200, h: 20 },
    'Kraflow Canvas',
    fonts,
    null,
    ctx,
  )

  // ── Title ─────────────────────────────────────────────────────────────────
  renderText(
    ckRef,
    canvas,
    titleStyle,
    { x: 100, y: 94, w: 440, h: 36 },
    'View · Text · Image',
    fonts,
    null,
    ctx,
  )

  // ── Subtitle ──────────────────────────────────────────────────────────────
  renderText(
    ckRef,
    canvas,
    subtitleStyle,
    { x: 80, y: 152, w: 480, h: 20 },
    'Unified draw pipeline — no duplicate work',
    fonts,
    null,
    ctx,
  )

  // ── Image section ─────────────────────────────────────────────────────────
  // Cover image
  const imgRect: LayoutRect = { x: 80, y: 190, w: 220, h: 150 }
  renderImage(ckRef, canvas, imageCardStyle, imgRect, demoImage, ctx)

  // Tinted image
  const tintRect: LayoutRect = { x: 320, y: 190, w: 240, h: 150 }
  renderImage(ckRef, canvas, tintedImageStyle, tintRect, demoImage, ctx)

  // Image labels
  renderText(
    ckRef,
    canvas,
    { ...bodyStyle, fontSize: 12, color: Float32Array.from([0.5, 0.5, 0.53, 1]) },
    { x: 80, y: 348, w: 220, h: 16 },
    'objectFit: cover',
    fonts,
    null,
    ctx,
  )
  renderText(
    ckRef,
    canvas,
    { ...bodyStyle, fontSize: 12, color: Float32Array.from([0.5, 0.5, 0.53, 1]) },
    { x: 320, y: 348, w: 240, h: 16 },
    'tintColor applied',
    fonts,
    null,
    ctx,
  )

  // ── Accent info box ───────────────────────────────────────────────────────
  const accentRect: LayoutRect = { x: 80, y: 380, w: 480, h: 72 }
  renderView(ckRef, canvas, accentViewStyle, accentRect, undefined, undefined, ctx)

  renderText(
    ckRef,
    canvas,
    bodyStyle,
    { x: 96, y: 392, w: 448, h: 44 },
    'DrawContext pools Paint objects across frames — zero WASM alloc/dealloc after stabilization. MaskFilters and PathEffects are cached and reused.',
    fonts,
    null,
    ctx,
  )

  // ── Badges row ────────────────────────────────────────────────────────────
  const badges = ['View', 'Text', 'Image', 'DrawContext']
  let badgeX = 80
  for (const label of badges) {
    const bw = label.length * 8 + 24
    const bRect: LayoutRect = { x: badgeX, y: 470, w: bw, h: 28 }
    renderView(ckRef, canvas, badgeStyle, bRect, undefined, undefined, ctx)
    renderText(
      ckRef,
      canvas,
      badgeTextStyle,
      { x: badgeX + 12, y: 476, w: bw - 24, h: 16 },
      label,
      fonts,
      null,
      ctx,
    )
    badgeX += bw + 10
  }

  // ── Outline demo ──────────────────────────────────────────────────────────
  const outlineRect: LayoutRect = { x: 80, y: 516, w: 220, h: 80 }
  renderView(ckRef, canvas, outlineViewStyle, outlineRect, undefined, undefined, ctx)

  renderText(
    ckRef,
    canvas,
    { ...bodyStyle, fontSize: 12, textAlign: 'center' },
    { x: 80, y: 544, w: 220, h: 28 },
    'Dashed border + outline',
    fonts,
    null,
    ctx,
  )

  // ── Scroll demo (only View can scroll) ────────────────────────────────────
  const scrollY = Math.sin(time * 0.6) * 30 + 30
  const scrollRect: LayoutRect = { x: 320, y: 516, w: 240, h: 80 }
  renderView(ckRef, canvas, scrollViewStyle, scrollRect, { x: 0, y: scrollY }, undefined, ctx)

  // Content taller than the scroll view
  renderView(
    ckRef,
    canvas,
    scrollContentStyle,
    { x: 330, y: 526, w: 220, h: 40 },
    undefined,
    undefined,
    ctx,
  )
  renderView(
    ckRef,
    canvas,
    { ...scrollContentStyle, backgroundColor: Float32Array.from([0.2, 0.78, 0.47, 0.1]) },
    { x: 330, y: 576, w: 220, h: 40 },
    undefined,
    undefined,
    ctx,
  )
  renderView(
    ckRef,
    canvas,
    { ...scrollContentStyle, backgroundColor: Float32Array.from([1, 0.5, 0.2, 0.1]) },
    { x: 330, y: 626, w: 220, h: 40 },
    undefined,
    undefined,
    ctx,
  )

  renderText(
    ckRef,
    canvas,
    { ...bodyStyle, fontSize: 12, textAlign: 'center' },
    { x: 320, y: 604, w: 240, h: 16 },
    'Scroll (View only)',
    fonts,
    null,
    ctx,
  )

  // ── ImageCache info ───────────────────────────────────────────────────────
  const cacheInfo = imageCache
    ? `ImageCache: ${imageCache.size} image(s) · DrawContext: ${drawCtx?.poolSize ?? 0} paints pooled`
    : 'ImageCache: not initialized'
  renderText(
    ckRef,
    canvas,
    { ...bodyStyle, fontSize: 11, color: Float32Array.from([0.4, 0.4, 0.43, 1]) },
    { x: 80, y: 652, w: 480, h: 16 },
    cacheInfo,
    fonts,
    null,
    ctx,
  )

  canvas.restore()
}

// =============================================================================
// Mount
// =============================================================================

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

    // ── DrawContext (paint pool + caches) ────────────────────────────────────
    drawCtx = new DrawContext(ck)

    // ── Image cache + demo image ────────────────────────────────────────────
    imageCache = new ImageCache(ck)
    demoImage = await imageCache.load(
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop',
    )

    // ── Initialize canvas ───────────────────────────────────────────────────
    renderer = new CanvasRenderer({
      canvas: canvasRef.value,
      onDraw: draw,
    })

    await renderer.initialize()
    renderer.setAnimating(true)
  } catch (error) {
    console.error('[ViewTextImageDemo] Initialization failed:', error)
  }
})

// =============================================================================
// Cleanup
// =============================================================================

onBeforeUnmount(() => {
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
  background: #0c0c0e;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}
</style>
