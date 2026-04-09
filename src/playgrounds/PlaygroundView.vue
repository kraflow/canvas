<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, computed, triggerRef } from 'vue'
import {
  CanvasRenderer,
  Viewport,
  SceneGraph,
  InteractionManager,
  createFontSystem,
  configure,
  type FontSystem,
  type SceneNode,
  type InteractionEvent,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
  renderView,
  renderText,
  renderImage,
  renderInfiniteGrid,
  DrawContext,
  ImageCache,
  drawHoverHighlight,
  drawSelectionHighlight,
  drawMarqueeSelection,
  drawPlacementGhost,
  drawScreenTitle,
} from '@/index'

import { defaultFontManifest } from './font-manifest'
import type { Canvas, CanvasKit } from 'canvaskit-wasm'

// Playground-specific theme colors (not part of core library)
const PLAYGROUND_VIEW_BG = new Float32Array([0.388, 0.4, 0.945, 0.1]) // rgba(99, 102, 241, 0.1)
const PLAYGROUND_VIEW_BORDER = new Float32Array([0.388, 0.4, 0.945, 0.8]) // rgba(99, 102, 241, 0.8)
const PLAYGROUND_TEXT_COLOR = new Float32Array([0.2, 0.2, 0.2, 1]) // rgba(51, 51, 51, 1) - dark gray
const PLAYGROUND_SCREEN_BG = new Float32Array([1, 1, 1, 1]) // rgba(255, 255, 255, 1)
const PLAYGROUND_TEXT_BORDER = new Float32Array([0.925, 0.282, 0.6, 0.8]) // rgba(236, 72, 153, 0.8)
const PLAYGROUND_IMAGE_BORDER = new Float32Array([0.176, 0.831, 0.749, 0.8]) // rgba(45, 212, 191, 0.8)

const SCREEN_WIDTH = 375
const SCREEN_HEIGHT = 812

// Core
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scene = shallowRef<SceneGraph | null>(null)
const interaction = shallowRef<InteractionManager | null>(null)
const renderer = shallowRef<CanvasRenderer | null>(null)
const imageCache = shallowRef<ImageCache | null>(null)
const viewport = new Viewport({ x: 0, y: 0, zoom: 1 })
const fonts = shallowRef<FontSystem>()

// UI State
const zoomLevel = ref(100)
const cursorCoords = ref({ x: 0, y: 0 })
const showGrid = ref(true)

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
  const w = SCREEN_WIDTH
  const h = SCREEN_HEIGHT
  if (checkOverlap(x, y, w, h)) {
    console.warn('Overlap detected')
    return
  }

  const name = `Screen ${Array.from(scene.value.allScreens).length + 1}`
  scene.value.addScreen(Math.random().toString(36).substr(2, 9), name, x, y, w, h, {
    backgroundColor: PLAYGROUND_SCREEN_BG,
    padding: 20,
  })
  isPlacingScreen.value = false
  triggerRef(scene)
  renderer.value?.requestFrame()
}

const addNode = (type: 'view' | 'text' | 'image') => {
  if (!scene.value) return

  let textContent = 'New Text Layer'
  let imageUrl =
    'https://picsum.photos/seed/' + Math.random().toString(36).substring(7) + '/400/300'

  if (type === 'text') {
    const input = prompt('Enter text content:', 'New Text Layer')
    if (input !== null) textContent = input
  } else if (type === 'image') {
    const input = prompt(
      'Enter image URL:',
      'https://picsum.photos/seed/' + Math.random().toString(36).substring(7) + '/400/300',
    )
    if (input !== null) imageUrl = input
  }

  // 1. Determine parent
  let parent: SceneNode | null = null
  const selectedIds = interaction.value?.getState().selectedNodes || new Set()

  if (selectedIds.size === 1) {
    const id = Array.from(selectedIds)[0]
    let target = scene.value.getNode(id!)
    const screen = scene.value.getScreen(id!)

    if (screen) {
      parent = screen.root as SceneNode
    } else if (target) {
      // If selected target is not a view, find nearest view parent
      while (target && target.type !== 'view') {
        target = target.parent as SceneNode
      }
      parent = target
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

  const isText = type === 'text'

  const baseStyle = {
    backgroundColor: type === 'view' ? PLAYGROUND_VIEW_BG : undefined,
    width: isText ? undefined : parent.rect.w - 20 * 2,
    height: isText ? undefined : 200,
    margin: 20,
    padding: isText ? 0 : 16,
    borderRadius: 8,
    borderWidth: type === 'view' ? 1.5 : 0,
    borderColor:
      type === 'view'
        ? PLAYGROUND_VIEW_BORDER
        : isText
          ? PLAYGROUND_TEXT_BORDER
          : PLAYGROUND_IMAGE_BORDER,
  }

  const newNode = isText
    ? scene.value.createNode(type, {
        ...baseStyle,
        color: PLAYGROUND_TEXT_COLOR,
        fontSize: 16,
      } as TextStyle)
    : scene.value.createNode(type, baseStyle as ViewStyle)

  if (type === 'text') {
    scene.value.setText(newNode, textContent)
  } else if (type === 'image') {
    scene.value.setSrc(newNode, imageUrl)
  }

  scene.value.appendChild(parent, newNode)
  triggerRef(scene)
  renderer.value?.requestFrame()
}

// Drawing logic
const onDraw = (canvas: Canvas, ck: CanvasKit, ctx: DrawContext) => {
  if (!canvasRef.value || !scene.value) return

  const interactionState = interaction.value?.getState()

  // 1. Layout & Setup
  scene.value.computeLayouts()

  // 2. Background Grid
  canvas.save()
  const bounds = canvas.getDeviceClipBounds()
  renderInfiniteGrid(ck, canvas, viewport, bounds[2] ?? 0, bounds[3] ?? 0, showGrid.value, ctx)
  canvas.restore()

  // 2. Render Tree
  scene.value.walk((node, absRect) => {
    if (node.type === 'view') {
      renderView(ck, canvas, node.style as ViewStyle, absRect, node.scroll, undefined, ctx)
    } else if (node.type === 'text') {
      renderText(
        ck,
        canvas,
        node.style as TextStyle,
        absRect,
        node.text || '',
        fonts.value,
        undefined,
        ctx,
      )
    } else if (node.type === 'image') {
      renderImage(
        ck,
        canvas,
        node.style as ImageStyle,
        absRect,
        imageCache.value!.get(node.src!),
        ctx,
      )
    }
  })

  // 3. Render Interaction Overlays
  if (interactionState) {
    // Draw hover highlight
    if (interactionState.hoveredNode) {
      drawHoverHighlight(ck, canvas, interactionState.hoveredNode.worldRect, viewport.zoom, ctx)
    }

    // Draw selection highlights
    for (const id of interactionState.selectedNodes) {
      const node = scene.value.getNode(id)
      if (node) {
        drawSelectionHighlight(ck, canvas, node.worldRect, viewport.zoom, ctx)
      } else {
        // Check screens if not in nodes (Screens are special)
        const screen = scene.value.getScreen(id)
        if (screen) {
          drawSelectionHighlight(ck, canvas, screen.root.worldRect, viewport.zoom, ctx)
        }
      }
    }

    // Draw marquee selection
    if (interactionState.isBoxSelecting && interactionState.selectionBox) {
      drawMarqueeSelection(ck, canvas, interactionState.selectionBox, viewport.zoom, ctx)
    }

    // Draw placement ghost
    if (isPlacingScreen.value) {
      drawPlacementGhost(
        ck,
        canvas,
        {
          x: ghostScreenPos.value.x,
          y: ghostScreenPos.value.y,
          w: SCREEN_WIDTH,
          h: SCREEN_HEIGHT,
        },
        viewport.zoom,
        ghostOverlap.value,
        ctx,
      )
    }

    // Draw screen titles
    for (const screen of scene.value.allScreens) {
      drawScreenTitle(ck, canvas, screen.name, screen.root.worldRect, viewport.zoom, fonts.value!)
    }
  }
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

  imageCache.value = new ImageCache(ck!)

  // 2. Initialize Core Engine
  fonts.value = await createFontSystem(ck!, defaultFontManifest)
  scene.value = await SceneGraph.init('1.0.0', fonts.value, imageCache.value)

  interaction.value = new InteractionManager(canvasRef.value, scene.value, viewport)

  // 3. Configure Premium Overlays
  configure({
    GRID_SHOW: showGrid.value,
    OVERLAY_SELECTION_COLOR: [99, 102, 241, 1], // Indigo 500
    OVERLAY_SELECTION_STROKE_WIDTH: 2,
    OVERLAY_MARQUEE_FILL_COLOR: [99, 102, 241, 0.1],
    OVERLAY_MARQUEE_STROKE_COLOR: [99, 102, 241, 0.5],
    OVERLAY_GHOST_VALID_FILL: [34, 197, 94, 0.1], // Emerald 500
    OVERLAY_GHOST_VALID_STROKE: [34, 197, 94, 0.5],
    OVERLAY_GHOST_ERROR_FILL: [239, 68, 68, 0.1], // Rose 500
    OVERLAY_GHOST_ERROR_STROKE: [239, 68, 68, 0.5],
  })

  // 4. Setup Interaction Listeners
  interaction.value.on((e: InteractionEvent) => {
    const state = interaction.value!.getState()
    interactionMode.value = state.mode
    selectedNodeIds.value = state.selectedNodes
    hoveredNodeId.value = state.hoveredNode?.id || null

    if (e.type === 'modeChange') {
      interactionMode.value = state.mode
    }

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

  // 6. Keyboard Shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "'") {
      e.preventDefault()
      showGrid.value = !showGrid.value
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
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

watch(showGrid, (show) => {
  configure({ GRID_SHOW: show })
  renderer.value?.requestFrame()
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

const deleteSelected = () => {
  if (!selectedItem.value || !scene.value) return
  const { type, data } = selectedItem.value
  if (type === 'node') {
    scene.value.destroyNode(data as SceneNode)
  } else {
    scene.value.removeScreen(data.id)
  }
  selectedNodeIds.value.clear()
  interaction.value?.setSelection(new Set())
  triggerRef(scene)
  renderer.value?.requestFrame()
}

const updateStyle = (key: string, value: string | number | undefined) => {
  if (!selectedItem.value || selectedItem.value.type !== 'node') return
  const node = selectedItem.value.data as SceneNode
  scene.value?.applyStyle(node, { [key]: value })
  triggerRef(scene)
  renderer.value?.requestFrame()
}

const updateContent = (value: string) => {
  if (!selectedItem.value || selectedItem.value.type !== 'node') return
  const node = selectedItem.value.data as SceneNode
  if (node.type === 'text') {
    scene.value?.setText(node, value)
  } else if (node.type === 'image') {
    scene.value?.setSrc(node, value)
  }
  triggerRef(scene)
  renderer.value?.requestFrame()
}

const selectNode = (id: string) => {
  if (!interaction.value) return
  interaction.value.setSelection(new Set([id]))
  const state = interaction.value.getState()
  selectedNodeIds.value = state.selectedNodes
  renderer.value?.requestFrame()
}

// Simple recursive layer rendering
interface FlatNode extends SceneNode {
  depth: number
}

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
          <button title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
              />
            </svg>
          </button>
          <button title="Redo (Ctrl+Y)">
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

      <aside class="layers-panel">
        <div class="panel-header">Layers</div>
        <div class="panel-content">
          <div v-for="screen in scene?.allScreens" :key="screen.id" class="screen-group">
            <div
              class="layer-item screen"
              :class="{ selected: selectedNodeIds.has(screen.id) }"
              @click="selectNode(screen.id)"
            >
              <svg viewBox="0 0 24 24" class="icon">
                <path
                  d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"
                />
              </svg>
              <span class="name">{{ screen.name }}</span>
            </div>
            <div class="layer-list">
              <div
                v-for="node in getAllNodesFlat(screen.root.children as SceneNode[])"
                :key="node.id"
                class="layer-item node"
                :class="{ selected: selectedNodeIds.has(node.id) }"
                :style="{ paddingLeft: node.depth * 16 + 12 + 'px' }"
                @click="selectNode(node.id)"
              >
                <svg v-if="node.type === 'view'" viewBox="0 0 24 24" class="icon">
                  <path d="M3 3h18v18H3V3zm16 16V5H5v14h14z" />
                </svg>
                <svg v-else-if="node.type === 'text'" viewBox="0 0 24 24" class="icon">
                  <path d="M5 4v3h5.5v12h3V7H19V4H5z" />
                </svg>
                <svg v-else-if="node.type === 'image'" viewBox="0 0 24 24" class="icon">
                  <path
                    d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                  />
                </svg>
                <span class="name">{{ node.type }}</span>
              </div>
            </div>
          </div>
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
          <div v-if="selectedItem" class="props-editor">
            <div class="selection-badge">
              <span class="type-capsule">{{ (selectedItem.data as any).type || 'Screen' }}</span>
              <span class="id-text">{{ selectedItem.data.id }}</span>
            </div>

            <!-- Screen Specific -->
            <div v-if="selectedItem.type === 'screen'" class="prop-group">
              <label>Name</label>
              <input
                :value="(selectedItem.data as any).name"
                @input="(e: any) => ((selectedItem!.data as any).name = e.target.value)"
              />
              <div class="prop-row">
                <div class="prop-col">
                  <label>X</label>
                  <input
                    type="number"
                    :value="Math.round((selectedItem.data as any).x)"
                    @change="
                      (e: any) =>
                        scene?.moveScreen(
                          selectedItem!.data.id,
                          Number(e.target.value),
                          (selectedItem!.data as any).y,
                        )
                    "
                  />
                </div>
                <div class="prop-col">
                  <label>Y</label>
                  <input
                    type="number"
                    :value="Math.round((selectedItem.data as any).y)"
                    @change="
                      (e: any) =>
                        scene?.moveScreen(
                          selectedItem!.data.id,
                          (selectedItem!.data as any).x,
                          Number(e.target.value),
                        )
                    "
                  />
                </div>
              </div>
            </div>

            <!-- Node Common Layout -->
            <div v-if="selectedItem.type === 'node'" class="prop-group">
              <div class="group-title">Layout</div>
              <div class="prop-row">
                <div class="prop-col">
                  <label>Width</label>
                  <input
                    type="number"
                    :value="Math.round((selectedItem.data as any).style.width)"
                    @change="(e: any) => updateStyle('width', Number(e.target.value))"
                  />
                </div>
                <div class="prop-col">
                  <label>Height</label>
                  <input
                    type="number"
                    :value="Math.round((selectedItem.data as any).style.height)"
                    @change="(e: any) => updateStyle('height', Number(e.target.value))"
                  />
                </div>
              </div>
              <div class="prop-row">
                <div class="prop-col">
                  <label>Radius</label>
                  <input
                    type="number"
                    :value="(selectedItem.data as any).style.borderRadius"
                    @change="(e: any) => updateStyle('borderRadius', Number(e.target.value))"
                  />
                </div>
              </div>
            </div>

            <!-- Node Styling -->
            <div v-if="selectedItem.type === 'node'" class="prop-group">
              <div class="group-title">Styling</div>
              <label>Border Width</label>
              <input
                type="number"
                :value="(selectedItem.data as any).style.borderWidth"
                @change="(e: any) => updateStyle('borderWidth', Number(e.target.value))"
              />
            </div>

            <!-- Node Content -->
            <div
              v-if="selectedItem.type === 'node' && (selectedItem.data as any).type === 'text'"
              class="prop-group"
            >
              <div class="group-title">Text</div>
              <label>Content</label>
              <textarea
                :value="(selectedItem.data as any).text"
                @input="(e: any) => updateContent(e.target.value)"
              ></textarea>
              <label>Font Size</label>
              <input
                type="number"
                :value="(selectedItem.data as any).style.fontSize"
                @change="(e: any) => updateStyle('fontSize', Number(e.target.value))"
              />
            </div>

            <div
              v-if="selectedItem.type === 'node' && (selectedItem.data as any).type === 'image'"
              class="prop-group"
            >
              <div class="group-title">Image</div>
              <label>Source URL</label>
              <textarea
                :value="(selectedItem.data as any).src"
                @change="(e: any) => updateContent(e.target.value)"
              ></textarea>
            </div>

            <div class="actions-footer">
              <button class="delete-btn" @click="deleteSelected">
                <svg viewBox="0 0 24 24" class="icon">
                  <path
                    d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                  />
                </svg>
                Delete Selection
              </button>
            </div>
          </div>
          <div v-else class="empty-hint">
            <svg viewBox="0 0 24 24" class="icon large">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
              />
            </svg>
            Select an element to edit properties
          </div>
        </div>
      </aside>
    </main>

    <!-- Status Bar -->
    <footer class="status-bar">
      <div class="status-left">
        <div class="coords">X: {{ cursorCoords.x }} Y: {{ cursorCoords.y }}</div>
        <div class="separator"></div>
        <button
          class="grid-toggle"
          @click="((showGrid = !showGrid), renderer?.requestFrame())"
          :class="{ active: showGrid }"
        >
          Grid: {{ showGrid ? 'On' : 'Off' }}
        </button>
      </div>
      <div class="zoom-tools">
        <button
          @click="
            (viewport.setZoom(viewport.zoom * 0.9),
            (zoomLevel = Math.round(viewport.zoom * 100)),
            renderer?.requestFrame())
          "
        >
          -
        </button>
        <span class="zoom-level">{{ zoomLevel }}%</span>
        <button
          @click="
            (viewport.setZoom(viewport.zoom * 1.1),
            (zoomLevel = Math.round(viewport.zoom * 100)),
            renderer?.requestFrame())
          "
        >
          +
        </button>
      </div>
      <div class="layer-info">{{ screenCount }} Screens · {{ nodeCount }} Layers</div>
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
  width: 280px;
  background: rgba(18, 18, 20, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  z-index: 90;
}
.panel-header {
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.empty-hint {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #52525b;
  text-align: center;
  gap: 12px;
  font-size: 13px;
}
.icon.large {
  width: 32px;
  height: 32px;
  opacity: 0.3;
}

.props-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.selection-badge {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.type-capsule {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #6366f1;
}
.id-text {
  font-size: 11px;
  color: #71717a;
  font-family: monospace;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group-title {
  font-size: 11px;
  font-weight: 600;
  color: #a1a1aa;
  margin-bottom: 4px;
}

label {
  font-size: 10px;
  color: #71717a;
  text-transform: uppercase;
  font-weight: 600;
}

input,
textarea {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 6px 8px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s;
}
input:focus,
textarea:focus {
  outline: none;
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.05);
}

.prop-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.prop-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

textarea {
  resize: vertical;
  min-height: 60px;
}

.actions-footer {
  margin-top: 10px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.delete-btn {
  width: 100%;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}
.delete-btn .icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
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
.status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.separator {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
}
.grid-toggle {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
}
.grid-toggle:hover {
  color: #fff;
}
.grid-toggle.active {
  color: #6366f1;
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
