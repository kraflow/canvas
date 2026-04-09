import { ref } from 'vue'
import type { SceneGraph } from '@/index'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './usePlaygroundCore'

export function usePlaygroundPlacement(
  scene: ReturnType<typeof ref<SceneGraph | null>>,
  requestFrame: () => void,
  triggerSceneUpdate: () => void,
) {
  const isPlacingScreen = ref(false)
  const ghostScreenPos = ref({ x: 0, y: 0 })
  const ghostOverlap = ref(false)

  const startPlacingScreen = () => {
    isPlacingScreen.value = true
  }

  const cancelPlacement = () => {
    isPlacingScreen.value = false
  }

  const checkOverlap = (x: number, y: number, w: number, h: number) => {
    if (!scene.value) return false
    for (const s of scene.value.allScreens) {
      if (x < s.x + s.width && x + w > s.x && y < s.y + s.height && y + h > s.y) return true
    }
    return false
  }

  const addScreenAt = (x: number, y: number) => {
    if (!scene.value) return
    const w = SCREEN_WIDTH
    const h = SCREEN_HEIGHT
    if (checkOverlap(x, y, w, h)) {
      console.warn('Overlap detected')
      return
    }

    const name = `Screen ${Array.from(scene.value.allScreens).length + 1}`
    scene.value.addScreen(Math.random().toString(36).substr(2, 9), name, x, y, w, h, {
      backgroundColor: new Float32Array([1, 1, 1, 1]),
      padding: 20,
    })
    isPlacingScreen.value = false
    triggerSceneUpdate()
    requestFrame()
  }

  return {
    isPlacingScreen,
    ghostScreenPos,
    ghostOverlap,
    startPlacingScreen,
    cancelPlacement,
    checkOverlap,
    addScreenAt,
  }
}
