<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, computed } from 'vue'
import { CanvasRenderer } from '@/core/renderer/renderer'
import { Viewport } from '@/core/viewport/Viewport'
import { SceneGraph } from '@/core/scene/scene-graph'
import { InteractionManager } from '@/core/interaction/InteractionManager'
import { createFontSystem } from '@/core/fonts'
import {
  DEFAULT_SCREEN_WIDTH,
  DEFAULT_SCREEN_HEIGHT,
  COLORS,
  DEFAULT_NODE_SPACING,
  DEFAULT_NODE_PADDING,
  DEFAULT_NODE_RADIUS,
} from './constants'
import { defaultFontManifest } from './font-manifest'
import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { SceneNode, SerializedProject } from '@/core/scene/types'
import type { InteractionEvent } from '@/core/interaction/types'

// History state
interface HistoryState {
  project: SerializedProject
}

// Core
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scene = shallowRef<SceneGraph | null>(null)
const interaction = shallowRef<InteractionManager | null>(null)
const renderer = shallowRef<CanvasRenderer | null>(null)
const viewport = new Viewport({ x: 0, y: 0, zoom: 1 })

// UI State
const zoomLevel = ref(100)
const cursorCoords = ref({ x: 0, y: 0 })
const history = ref<HistoryState[]>([])
const redoStack = ref<HistoryState[]>([])

// Placement State
const isPlacingScreen = ref(false)
const ghostScreenPos = ref({ x: 0, y: 0 })
const ghostOverlap = ref(false)

// Interaction Mode State (bridged to InteractionManager)
const interactionMode = ref<'edit' | 'move' | 'play'>('edit')
const selectedNodeIds = ref<Set<string>>(new Set())
const hoveredNodeId = ref<string | null>(null)

// Actions
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
  const w = DEFAULT_SCREEN_WIDTH
  const h = DEFAULT_SCREEN_HEIGHT
  if (checkOverlap(x, y, w, h)) {
    console.warn('Overlap detected')
    return
  }

  saveToHistory()
  scene.value.addScreen(Math.random().toString(36).substr(2, 9), x, y, w, h)
  isPlacingScreen.value = false
  renderer.value?.requestFrame()
}

const addNode = (type: 'view' | 'text' | 'image') => {
  if (!scene.value) return

  // 1. Determine parent
  let parent: SceneNode | null = null
  const selectedIds = interaction.value?.getState().selectedNodes || new Set()

  if (selectedIds.size === 1) {
    const id = Array.from(selectedIds)[0]
    const target = scene.value.getNodeById(id)
    if (target) {
      // If it's a view or root, it's a valid parent
      parent = target
    } else {
      const screen = scene.value.getScreen(id)
      if (screen) parent = screen.root as SceneNode
    }
  }

  // 2. Default to first screen if no parent found
  if (!parent) {
    const screens = Array.from(scene.value.allScreens)
    const firstScreen = screens[0]
    if (!firstScreen) {
      startPlacingScreen()
      return
    }
    parent = firstScreen.root
  }

  saveToHistory()
  const newNode = scene.value.createNode(type, {
    backgroundColor: type === 'view' ? COLORS.VIEW.bg : undefined,
    width: parent.rect.w - DEFAULT_NODE_SPACING * 2,
    height: 50,
    margin: DEFAULT_NODE_SPACING,
    padding: DEFAULT_NODE_PADDING,
    borderRadius: DEFAULT_NODE_RADIUS,
    borderWidth: 1.5,
    borderColor:
      type === 'view'
        ? COLORS.VIEW.border
        : type === 'text'
          ? COLORS.TEXT.border
          : COLORS.IMAGE.border,
  } as any)

  if (type === 'text') {
    scene.value.setText(newNode, 'New Text Layer')
    scene.value.applyStyle(newNode, { color: COLORS.TEXT.color, fontSize: 16 } as any)
  }

  scene.value.appendChild(parent, newNode)
  renderer.value?.requestFrame()
}

const undo = () => {
  if (history.value.length > 0 && scene.value) {
    const project = scene.value.exportProject()
    redoStack.value.push({ project })
    const prev = history.value.pop()!
    scene.value.importProject(prev.project)
    renderer.value?.requestFrame()
  }
}

const redo = () => {
  if (redoStack.value.length > 0 && scene.value) {
    const project = scene.value.exportProject()
    history.value.push({ project })
    const next = redoStack.value.pop()!
    scene.value.importProject(next.project)
    renderer.value?.requestFrame()
  }
}

const saveToHistory = () => {
  if (scene.value) {
    history.value.push({ project: scene.value.exportProject() })
    redoStack.value = []
  }
}

// Drawing logic
const onDraw = (canvas: Canvas, ck: CanvasKit) => {
  if (!canvasRef.value || !scene.value) return

  scene.value.render(canvas, ck, viewport, {
    showGrid: true,
    interactionState: interaction.value?.getState(),
    placementGhost: isPlacingScreen.value
      ? {
          x: ghostScreenPos.value.x,
          y: ghostScreenPos.value.y,
          w: DEFAULT_SCREEN_WIDTH,
          h: DEFAULT_SCREEN_HEIGHT,
          overlap: ghostOverlap.value,
        }
      : undefined,
  })
}

onMounted(async () => {
  if (!canvasRef.value) return

  // 1. Initialize Renderer
  renderer.value = new CanvasRenderer({
    canvas: canvasRef.value,
    viewport: viewport,
    onDraw: onDraw,
  })
  await renderer.value.initialize()
  const ck = renderer.value.ck

  // 2. Initialize Core Engine
  const fonts = await createFontSystem(ck!, defaultFontManifest)
  scene.value = await SceneGraph.create(ck!, fonts)
  interaction.value = new InteractionManager(canvasRef.value, scene.value, viewport)

  // 3. Setup Interaction Listeners
  interaction.value.on((e: InteractionEvent) => {
    const state = interaction.value!.getState()
    interactionMode.value = state.mode
    selectedNodeIds.value = state.selectedNodes
    hoveredNodeId.value = state.hoveredNode?.id || null

    if (e.type === 'modeChange') {
      interactionMode.value = state.mode
    }

    if (e.type === 'modeChange' || e.type.includes('Move') || e.type.includes('Start') || e.type.includes('End') || e.type === 'hover' || e.type === 'scroll') {
      renderer.value?.requestFrame()
    }

    if (e.type === 'modeChange' || e.type === 'scroll') {
      zoomLevel.value = Math.round(viewport.zoom * 100)
    }

    if (e.worldX !== 0 || e.worldY !== 0) {
      cursorCoords.value = { x: Math.round(e.worldX), y: Math.round(e.worldY) }
      
      if (isPlacingScreen.value) {
        ghostScreenPos.value = {
          x: Math.round(e.worldX - DEFAULT_SCREEN_WIDTH / 2),
          y: Math.round(e.worldY - DEFAULT_SCREEN_HEIGHT / 2),
        }
        ghostOverlap.value = checkOverlap(
          ghostScreenPos.value.x,
          ghostScreenPos.value.y,
          DEFAULT_SCREEN_WIDTH,
          DEFAULT_SCREEN_HEIGHT,
        )
      }
    }
  })

  // 4. Placement Handler
  canvasRef.value.addEventListener('mousedown', (e) => {
    if (isPlacingScreen.value && e.button === 0) {
      if (!ghostOverlap.value) {
        addScreenAt(ghostScreenPos.value.x, ghostScreenPos.value.y)
      }
    }
  })

  // 5. Initial Frame
  renderer.value.requestFrame()
})

onUnmounted(() => {
  renderer.value?.dispose()
  interaction.value?.dispose()
  scene.value?.dispose()
})

// Tool bridge
watch(interactionMode, (mode) => {
  if (interaction.value && interaction.value.getState().mode !== mode) {
    interaction.value.setMode(mode)
  }
})

onUnmounted(() => {
  renderer.value?.dispose()
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
</script>

<template>
  <div class="canvas-playground">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="project-info">
        <div class="project-icon">K</div>
        <span class="project-name">Kraflow Project</span>
      </div>

      <div class="main-tools">
        <div class="tool-group interaction-modes">
          <button
            @click="interactionMode = 'edit'"
            :class="{ active: interactionMode === 'edit' }"
            title="Edit Mode (V)"
          >
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M7 2l12 11.01L13 14.77 16 21l-2 1-3-6.23L7 22V2z" />
            </svg>
          </button>
          <button
            @click="interactionMode = 'move'"
            :class="{ active: interactionMode === 'move' }"
            title="Move Tool (H)"
          >
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M18 11h-5V6h5v5zm-6 0H7V6h5v5zm6 6h-5v-5h5v5zm-6 0H7v-5h5v5zM5 21V3h14v18H5z"
                fill="none"
              />
              <path
                d="M20.5 5V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V11h1v10h18V11h1V5h-1zM9 4.5a1.5 1.5 0 0 1 3 0V5H9V4.5zM4 4.5a1.5 1.5 0 0 1 3 0V5H4V4.5zm11 15.5H5V11h10v9zm1-10V5h3v6h-3zm3 9h-2v-8h2v8z"
              />
            </svg>
          </button>
          <button
            @click="interactionMode = 'play'"
            :class="{ active: interactionMode === 'play' }"
            title="Play Mode (P)"
          >
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
        <div class="divider"></div>
        <div class="tool-group history-tools">
          <button @click="undo" :disabled="history.length === 0" title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
              />
            </svg>
          </button>
          <button @click="redo" :disabled="redoStack.length === 0" title="Redo (Ctrl+Y)">
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.91 16c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"
              />
            </svg>
          </button>
        </div>
        <div class="divider"></div>
        <button
          class="primary-btn"
          @click="startPlacingScreen"
          :class="{ active: isPlacingScreen }"
        >
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          {{ isPlacingScreen ? 'Click to place...' : 'Add Screen' }}
        </button>
      </div>

      <div class="user-actions">
        <button v-if="isPlacingScreen" class="cancel-btn" @click="cancelPlacement">Cancel</button>
        <button class="share-btn">Share</button>
        <div class="avatar"></div>
      </div>
    </header>

    <!-- Workspace -->
    <main class="workspace">
      <aside class="side-toolbar">
        <div class="node-tools">
          <button @click="addNode('view')" title="Add View">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M3 3h18v18H3V3z" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            <span class="label">View</span>
          </button>
          <button @click="addNode('text')" title="Add Text">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
            </svg>
            <span class="label">Text</span>
          </button>
          <button @click="addNode('image')" title="Add Image">
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              />
            </svg>
            <span class="label">Image</span>
          </button>
        </div>
      </aside>

      <section class="canvas-viewport" :style="{ cursor: canvasCursor }">
        <canvas ref="canvasRef" class="main-canvas"></canvas>
        <div class="canvas-grid-overlay" v-if="screenCount === 0 && !isPlacingScreen">
          <div class="empty-state">
            <h3>Start your creation</h3>
            <p>Add a screen or a node to begin designing</p>
            <button class="pixel-btn" @click="startPlacingScreen">Create First Screen</button>
          </div>
        </div>
        <div v-if="isPlacingScreen" class="placement-hint" :class="{ error: ghostOverlap }">
          {{ ghostOverlap ? 'Cannot overlap screens' : 'Click to place screen' }}
        </div>
      </section>

      <aside class="properties-panel">
        <div class="panel-header">Properties</div>
        <div class="panel-content">
          <div class="empty-hint">Select an element to edit properties</div>
        </div>
      </aside>
    </main>

    <!-- Status Bar -->
    <footer class="status-bar">
      <div class="coords">X: {{ cursorCoords.x }} Y: {{ cursorCoords.y }}</div>
      <div class="zoom-tools">
        <button
          @click="
            viewport.setZoom(viewport.zoom * 0.9);
            zoomLevel = Math.round(viewport.zoom * 100);
            renderer?.requestFrame();
          "
        >
          -
        </button>
        <span class="zoom-level">{{ zoomLevel }}%</span>
        <button
          @click="
            viewport.setZoom(viewport.zoom * 1.1);
            zoomLevel = Math.round(viewport.zoom * 100);
            renderer?.requestFrame();
          "
        >
          +
        </button>
      </div>
      <div class="layer-info">
        {{ screenCount }} Screens ·
        {{ nodeCount }} Layers
      </div>
    </footer>
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

.top-bar {
  height: 56px;
  background: rgba(18, 18, 20, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.project-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
}
.project-name {
  font-weight: 500;
  font-size: 0.95rem;
  color: #fff;
}

.main-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tool-group {
  display: flex;
  gap: 4px;
}
.history-tools button {
  background: transparent;
  border: none;
  padding: 8px;
  color: #a1a1aa;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}
.history-tools button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
.history-tools button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.interaction-modes button.active {
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.primary-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-btn.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #6366f1;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.cancel-btn {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.share-btn {
  background: #6366f1;
  border: none;
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #2dd4bf;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.workspace {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}
.side-toolbar {
  width: 56px;
  background: rgba(18, 18, 20, 0.6);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  z-index: 90;
}
.node-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.node-tools button {
  background: transparent;
  border: none;
  width: 40px;
  height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-size: 10px;
}
.node-tools button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.canvas-viewport {
  flex: 1;
  position: relative;
  background-color: #0c0c0e;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: crosshair;
}
.main-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.canvas-grid-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.empty-state {
  text-align: center;
  color: #71717a;
  background: rgba(12, 12, 14, 0.8);
  padding: 40px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}
.empty-state h3 {
  color: #fff;
  margin-bottom: 8px;
}
.pixel-btn {
  pointer-events: auto;
  margin-top: 16px;
  background: transparent;
  border: 1px solid #6366f1;
  color: #6366f1;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.placement-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(99, 102, 241, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  animation: fadeIn 0.3s ease;
}
.placement-hint.error {
  background: rgba(239, 68, 68, 0.9);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
}

.properties-panel {
  width: 240px;
  background: rgba(18, 18, 20, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  z-index: 90;
}
.panel-header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 600;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.empty-hint {
  padding: 32px 16px;
  text-align: center;
  color: #52525b;
  font-size: 13px;
  font-style: italic;
}

.status-bar {
  height: 32px;
  background: #111113;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 11px;
  color: #71717a;
  z-index: 100;
}
.zoom-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.zoom-tools button {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  padding: 2px 8px;
}
.zoom-tools button:hover {
  color: #fff;
}
.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
