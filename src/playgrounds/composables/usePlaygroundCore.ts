import { ref, shallowRef, onMounted, onUnmounted, triggerRef } from 'vue'
import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import {
  CanvasRenderer,
  Viewport,
  SceneGraph,
  InteractionManager,
  createFontSystem,
  type FontSystem,
  type DrawContext,
  ImageCache,
} from '@/index'
import { defaultFontManifest } from '../font-manifest'

// Playground-specific theme colors (not part of core library)
export const PLAYGROUND_VIEW_BG = new Float32Array([0.388, 0.4, 0.945, 0.1]) // rgba(99, 102, 241, 0.1)
export const PLAYGROUND_VIEW_BORDER = new Float32Array([0.388, 0.4, 0.945, 0.8]) // rgba(99, 102, 241, 0.8)
export const PLAYGROUND_TEXT_COLOR = new Float32Array([0.2, 0.2, 0.2, 1]) // rgba(51, 51, 51, 1) - dark gray
export const PLAYGROUND_SCREEN_BG = new Float32Array([1, 1, 1, 1]) // rgba(255, 255, 255, 1)
export const PLAYGROUND_TEXT_BORDER = new Float32Array([0.925, 0.282, 0.6, 0.8]) // rgba(236, 72, 153, 0.8)
export const PLAYGROUND_IMAGE_BORDER = new Float32Array([0.176, 0.831, 0.749, 0.8]) // rgba(45, 212, 191, 0.8)

export const SCREEN_WIDTH = 375
export const SCREEN_HEIGHT = 812

export interface CoreRefs {
  canvasRef: ReturnType<typeof ref<HTMLCanvasElement | null>>
  scene: ReturnType<typeof shallowRef<SceneGraph | null>>
  interaction: ReturnType<typeof shallowRef<InteractionManager | null>>
  renderer: ReturnType<typeof shallowRef<CanvasRenderer | null>>
  imageCache: ReturnType<typeof shallowRef<ImageCache | null>>
  viewport: Viewport
  fonts: ReturnType<typeof shallowRef<FontSystem | undefined>>
  ck: ReturnType<typeof shallowRef<CanvasKit | null>>
}

export function usePlaygroundCore(
  onDrawFn: (canvas: Canvas, ck: CanvasKit, ctx: DrawContext) => void,
) {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const scene = shallowRef<SceneGraph | null>(null)
  const interaction = shallowRef<InteractionManager | null>(null)
  const renderer = shallowRef<CanvasRenderer | null>(null)
  const imageCache = shallowRef<ImageCache | null>(null)
  const viewport = new Viewport({ x: 0, y: 0, zoom: 1 })
  const fonts = shallowRef<FontSystem>()
  const ck = shallowRef<CanvasKit | null>(null)

  onMounted(async () => {
    if (!canvasRef.value) return

    renderer.value = new CanvasRenderer({
      canvas: canvasRef.value,
      viewport: viewport,
      onDraw: onDrawFn,
    })

    await renderer.value.initialize()
    ck.value = renderer.value.ck!

    imageCache.value = new ImageCache(ck.value)
    fonts.value = await createFontSystem(ck.value, defaultFontManifest)
    scene.value = await SceneGraph.init('1.0.0', fonts.value, imageCache.value)
    interaction.value = new InteractionManager(canvasRef.value, scene.value, viewport)

    renderer.value.requestFrame()
  })

  onUnmounted(() => {
    renderer.value?.dispose()
    interaction.value?.dispose()
    scene.value?.dispose()
  })

  const triggerSceneUpdate = () => {
    triggerRef(scene)
  }

  const requestFrame = () => {
    renderer.value?.requestFrame()
  }

  return {
    canvasRef,
    scene,
    interaction,
    renderer,
    imageCache,
    viewport,
    fonts,
    ck,
    triggerSceneUpdate,
    requestFrame,
  }
}
