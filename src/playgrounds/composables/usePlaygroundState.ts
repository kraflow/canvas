import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { SceneNode, SceneGraph, InteractionManager, InteractionEvent } from '@/index'

export interface FlatNode extends SceneNode {
  depth: number
}

export function usePlaygroundState(
  scene: ReturnType<typeof ref<SceneGraph | null>>,
  interaction: ReturnType<typeof ref<InteractionManager | null>>,
  isPlacingScreen: ReturnType<typeof ref<boolean>>,
  requestFrame: () => void,
) {
  const zoomLevel = ref(100)
  const cursorCoords = ref({ x: 0, y: 0 })
  const showGrid = ref(true)
  const interactionMode = ref<'edit' | 'move' | 'play'>('edit')
  const selectedNodeIds = ref<Set<string>>(new Set())
  const hoveredNodeId = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  // Watch interaction mode and sync to interaction manager
  watch(interactionMode, (mode) => {
    if (interaction.value && interaction.value.getState().mode !== mode) {
      interaction.value.setMode(mode)
    }
  })

  // Sync selection from interaction manager
  onMounted(() => {
    const unwatch = watch(
      () => interaction.value,
      (val) => {
        if (val) {
          unsubscribe = val.on((e: InteractionEvent) => {
            // Sync selection on click and box selection events
            if (e.type === 'click' || e.type === 'boxSelectEnd') {
              selectedNodeIds.value = new Set(val.getState().selectedNodes)
            }
          })
          unwatch()
        }
      },
      { immediate: true },
    )
  })

  onUnmounted(() => {
    unsubscribe?.()
  })

  // Stats and computed
  const screenCount = computed(() => {
    if (!scene.value) return 0
    return Array.from(scene.value.allScreens).length
  })

  const nodeCount = computed(() => {
    if (!scene.value) return 0
    let count = 0
    scene.value.walk(() => {
      count++
    })
    return count
  })

  const canvasCursor = computed(() => {
    const state = interaction.value?.getState()
    if (interactionMode.value === 'move' || state?.isPanning) {
      return state?.isPanning ? 'grabbing' : 'grab'
    }
    if (isPlacingScreen.value) return 'crosshair'
    return 'default'
  })

  const selectedItem = computed(() => {
    if (selectedNodeIds.value.size !== 1) return null
    const id = Array.from(selectedNodeIds.value)[0]!
    const node = scene.value?.getNode(id)
    if (node) return { type: 'node', data: node }
    const screen = scene.value?.getScreen(id)
    if (screen) return { type: 'screen', data: screen }
    return null
  })

  // Simple recursive layer rendering helper
  const getAllNodesFlat = (nodes: SceneNode[], depth = 0): FlatNode[] => {
    let result: FlatNode[] = []
    for (const node of nodes) {
      result.push({ ...node, depth })
      if (node.type === 'view') {
        result = [...result, ...getAllNodesFlat(node.children as SceneNode[], depth + 1)]
      }
    }
    return result
  }

  const selectNode = (id: string) => {
    if (!interaction.value) return
    interaction.value.setSelection(new Set([id]))
    const state = interaction.value.getState()
    selectedNodeIds.value = state.selectedNodes
    requestFrame()
  }

  return {
    zoomLevel,
    cursorCoords,
    showGrid,
    interactionMode,
    selectedNodeIds,
    hoveredNodeId,
    screenCount,
    nodeCount,
    canvasCursor,
    selectedItem,
    getAllNodesFlat,
    selectNode,
  }
}
