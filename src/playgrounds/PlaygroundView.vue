<script setup lang="ts">
import { watch } from 'vue'
import {
  usePlaygroundCore,
  usePlaygroundState,
  usePlaygroundPlacement,
  usePlaygroundActions,
  createDrawFunction,
  usePlaygroundInteraction,
  useKeyboardShortcuts,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from './composables'
import TopBar from './components/TopBar.vue'
import SideToolbar from './components/SideToolbar.vue'
import LayersPanel from './components/LayersPanel.vue'
import CanvasViewport from './components/CanvasViewport.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import StatusBar from './components/StatusBar.vue'
import { configure } from '@/core/constants'

// 1. Core setup (canvas, renderer, scene, interaction)
const {
  canvasRef,
  scene,
  interaction,
  renderer,
  imageCache,
  viewport,
  fonts,
  triggerSceneUpdate,
  requestFrame,
} = usePlaygroundCore((canvas, ck, ctx) => {
  // Drawing function created after deps are available
  drawFn(canvas, ck, ctx)
})

// 2. Placement state
const {
  isPlacingScreen,
  ghostScreenPos,
  ghostOverlap,
  startPlacingScreen,
  cancelPlacement,
  checkOverlap,
  addScreenAt,
} = usePlaygroundPlacement(scene, requestFrame, triggerSceneUpdate)

// 3. UI State
const {
  zoomLevel,
  cursorCoords,
  showGrid,
  interactionMode,
  selectedNodeIds,
  screenCount,
  nodeCount,
  canvasCursor,
  selectedItem,
  getAllNodesFlat,
  selectNode,
} = usePlaygroundState(scene, interaction, isPlacingScreen, requestFrame)

// 4. Drawing function with dependencies
const drawFn = createDrawFunction({
  scene,
  interaction,
  viewport,
  fonts,
  imageCache,
  showGrid,
  isPlacingScreen,
  ghostScreenPos,
  ghostOverlap,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
})

// 5. Actions
const { addNode, deleteSelected, updateStyle, updateContent } = usePlaygroundActions(
  scene,
  interaction,
  startPlacingScreen,
  requestFrame,
  triggerSceneUpdate,
)

// 6. Interaction setup
usePlaygroundInteraction(
  canvasRef,
  interaction,
  renderer,
  viewport,
  zoomLevel,
  cursorCoords,
  isPlacingScreen,
  ghostScreenPos,
  ghostOverlap,
  checkOverlap,
  addScreenAt,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  showGrid,
)

// 7. Keyboard shortcuts
useKeyboardShortcuts(showGrid)

// 8. Watch interaction mode and sync to interaction manager
watch(interactionMode, (mode) => {
  if (interaction.value && interaction.value.getState().mode !== mode) {
    interaction.value.setMode(mode)
  }
})

// 9. Zoom handlers
const handleZoomIn = () => {
  viewport.setZoom(viewport.zoom * 1.1)
  zoomLevel.value = Math.round(viewport.zoom * 100)
  renderer.value?.requestFrame()
}

const handleZoomOut = () => {
  viewport.setZoom(viewport.zoom * 0.9)
  zoomLevel.value = Math.round(viewport.zoom * 100)
  renderer.value?.requestFrame()
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
  configure({ GRID_SHOW: showGrid.value })
  renderer.value?.requestFrame()
}
</script>

<template>
  <div class="canvas-playground">
    <TopBar
      :interaction-mode="interactionMode"
      :is-placing-screen="isPlacingScreen"
      @set-mode="(mode) => (interactionMode = mode)"
      @start-placing-screen="startPlacingScreen"
      @cancel-placement="cancelPlacement"
    />

    <main class="workspace">
      <SideToolbar @add-node="addNode" />

      <LayersPanel
        :scene="scene"
        :selected-node-ids="selectedNodeIds"
        :get-all-nodes-flat="getAllNodesFlat"
        @select-node="selectNode"
      />

      <CanvasViewport
        :canvas-cursor="canvasCursor"
        :screen-count="screenCount"
        :is-placing-screen="isPlacingScreen"
        :ghost-overlap="ghostOverlap"
        :ghost-screen-pos="ghostScreenPos"
        v-model="canvasRef"
        @start-placing-screen="startPlacingScreen"
      />

      <PropertiesPanel
        :scene="scene"
        :selected-item="selectedItem"
        @update-style="updateStyle"
        @update-content="updateContent"
        @delete-selected="deleteSelected"
      />
    </main>

    <StatusBar
      :cursor-coords="cursorCoords"
      :show-grid="showGrid"
      :zoom-level="zoomLevel"
      :screen-count="screenCount"
      :node-count="nodeCount"
      :viewport="viewport"
      @toggle-grid="toggleGrid"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
    />
  </div>
</template>

<style scoped>
.canvas-playground {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #0c0c0e;
  color: #e1e1e4;
  overflow: hidden;
  user-select: none;
}

.workspace {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}
</style>
