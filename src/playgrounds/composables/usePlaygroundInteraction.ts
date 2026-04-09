import { onMounted, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { configure } from '@/index'
import type { InteractionManager, InteractionEvent } from '@/index'

export interface InteractionState {
  interactionMode: Ref<'edit' | 'move' | 'play'>
  selectedNodeIds: Ref<Set<string>>
  hoveredNodeId: Ref<string | null>
}

export function usePlaygroundInteraction(
  canvasRef: Ref<HTMLCanvasElement | null>,
  interaction: Ref<InteractionManager | null>,
  renderer: Ref<{ requestFrame: () => void } | null>,
  viewport: { zoom: number; setZoom: (zoom: number) => void },
  zoomLevel: Ref<number>,
  cursorCoords: Ref<{ x: number; y: number }>,
  isPlacingScreen: Ref<boolean>,
  ghostScreenPos: Ref<{ x: number; y: number }>,
  ghostOverlap: Ref<boolean>,
  checkOverlap: (x: number, y: number, w: number, h: number) => boolean,
  addScreenAt: (x: number, y: number) => void,
  SCREEN_WIDTH: number,
  SCREEN_HEIGHT: number,
  showGrid: Ref<boolean>,
) {
  let cleanupInteraction: (() => void) | null = null
  let cleanupPlacement: (() => void) | null = null

  const setupInteractionListeners = () => {
    if (!interaction.value || !canvasRef.value) return

    const handleEvent = (e: InteractionEvent) => {
      if (
        e.type === 'modeChange' ||
        e.type === 'move' ||
        e.type.includes('Move') ||
        e.type.includes('Start') ||
        e.type.includes('End') ||
        e.type === 'hover' ||
        e.type === 'scroll'
      ) {
        renderer.value?.requestFrame()
      }

      if (e.type === 'modeChange' || e.type === 'scroll') {
        zoomLevel.value = Math.round(viewport.zoom * 100)
      }

      if (e.worldX !== 0 || e.worldY !== 0) {
        cursorCoords.value = { x: Math.round(e.worldX), y: Math.round(e.worldY) }

        if (isPlacingScreen.value) {
          ghostScreenPos.value = {
            x: Math.round(e.worldX - SCREEN_WIDTH / 2),
            y: Math.round(e.worldY - SCREEN_HEIGHT / 2),
          }
          ghostOverlap.value = checkOverlap(
            ghostScreenPos.value.x,
            ghostScreenPos.value.y,
            SCREEN_WIDTH,
            SCREEN_HEIGHT,
          )
        }
      }
    }

    // Setup Interaction Listeners - on() returns unsubscribe function
    cleanupInteraction = interaction.value.on(handleEvent)

    // Placement Handler - separate from interaction manager
    const handleMouseDown = (e: MouseEvent) => {
      if (isPlacingScreen.value && e.button === 0) {
        if (!ghostOverlap.value) {
          addScreenAt(ghostScreenPos.value.x, ghostScreenPos.value.y)
        }
      }
    }
    canvasRef.value.addEventListener('mousedown', handleMouseDown)
    cleanupPlacement = () => {
      canvasRef.value?.removeEventListener('mousedown', handleMouseDown)
    }
  }

  onMounted(() => {
    // Watch for when interaction becomes available (async initialization)
    const unwatch = watch(
      () => interaction.value,
      (val) => {
        if (val && canvasRef.value) {
          setupInteractionListeners()
          unwatch()
        }
      },
      { immediate: true },
    )
  })

  onUnmounted(() => {
    cleanupInteraction?.()
    cleanupPlacement?.()
  })

  // Watch showGrid and update configuration
  watch(showGrid, (show) => {
    configure({ GRID_SHOW: show })
    renderer.value?.requestFrame()
  })
}
