<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Basic node and screen types for UI state
interface Node {
  id: string
  type: 'view' | 'text' | 'image'
  name: string
}

interface Screen {
  id: string
  name: string
  nodes: Node[]
}

interface HistoryState {
  screens: Screen[]
}

const screens = ref<Screen[]>([])
const history = ref<HistoryState[]>([])
const redoStack = ref<HistoryState[]>([])

// Actions
const addScreen = () => {
  const newScreen: Screen = {
    id: Math.random().toString(36).substr(2, 9),
    name: `Screen ${screens.value.length + 1}`,
    nodes: [],
  }
  saveToHistory()
  screens.value.push(newScreen)
}

const addNode = (type: 'view' | 'text' | 'image', screenId?: string) => {
  if (screens.value.length === 0) {
    addScreen()
  }
  const targetScreen = screenId ? screens.value.find((s) => s.id === screenId) : screens.value[0]
  if (targetScreen) {
    const newNode: Node = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${targetScreen.nodes.length + 1}`,
    }
    saveToHistory()
    targetScreen.nodes.push(newNode)
  }
}

const undo = () => {
  if (history.value.length > 0) {
    const currentState: HistoryState = JSON.parse(JSON.stringify({ screens: screens.value }))
    redoStack.value.push(currentState)
    const previousState = history.value.pop()!
    screens.value = previousState.screens
  }
}

const redo = () => {
  if (redoStack.value.length > 0) {
    const currentState: HistoryState = JSON.parse(JSON.stringify({ screens: screens.value }))
    history.value.push(currentState)
    const nextState = redoStack.value.pop()!
    screens.value = nextState.screens
  }
}

const saveToHistory = () => {
  history.value.push(JSON.parse(JSON.stringify({ screens: screens.value })))
  redoStack.value = [] // Clear redo stack on new action
}

onMounted(() => {
  // Initialize with one screen
  // addScreen()
})
</script>

<template>
  <div class="canvas-playground">
    <!-- Top Bar: Project Meta & Actions -->
    <header class="top-bar">
      <div class="project-info">
        <div class="project-icon">K</div>
        <span class="project-name">Kraflow Project</span>
      </div>

      <div class="main-tools">
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

        <button class="primary-btn" @click="addScreen">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add Screen
        </button>
      </div>

      <div class="user-actions">
        <button class="share-btn">Share</button>
        <div class="avatar"></div>
      </div>
    </header>

    <!-- Content Workspace -->
    <main class="workspace">
      <!-- Left Toolbar: Node Creation -->
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

      <!-- Main Canvas Viewport -->
      <section class="canvas-viewport">
        <div class="canvas-grid" v-if="screens.length === 0">
          <div class="empty-state">
            <h3>Start your creation</h3>
            <p>Add a screen or a node to begin designing</p>
            <button class="pixel-btn" @click="addScreen">Create First Screen</button>
          </div>
        </div>

        <div class="screens-container" v-else>
          <div v-for="screen in screens" :key="screen.id" class="screen-item">
            <div class="screen-header">
              <span class="screen-name">{{ screen.name }}</span>
            </div>
            <div class="screen-content">
              <div v-for="node in screen.nodes" :key="node.id" class="node-item" :class="node.type">
                {{ node.name }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Sidebar: Properties (TBD) -->
      <aside class="properties-panel">
        <div class="panel-header">Properties</div>
        <div class="panel-content">
          <div class="empty-hint">Select an element to edit properties</div>
        </div>
      </aside>
    </main>

    <!-- Bottom Status Bar -->
    <footer class="status-bar">
      <div class="coords">X: 0 Y: 0</div>
      <div class="zoom-tools">
        <button>-</button>
        <span class="zoom-level">100%</span>
        <button>+</button>
      </div>
      <div class="layer-info">
        {{ screens.length }} Screens ·
        {{ screens.reduce((acc, s) => acc + s.nodes.length, 0) }} Layers
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

/* --- Top Bar --- */
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

.primary-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 16px;
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

/* --- Workspace Layout --- */
.workspace {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

/* Left Toolbar */
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

.node-tools .label {
  margin-top: 4px;
}

/* Canvas Viewport */
.canvas-viewport {
  flex: 1;
  position: relative;
  background-color: #0c0c0e;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0);
  background-size: 24px 24px;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100px;
}

.empty-state {
  text-align: center;
  color: #71717a;
}

.empty-state h3 {
  color: #fff;
  margin-bottom: 8px;
}

.pixel-btn {
  margin-top: 16px;
  background: transparent;
  border: 1px solid #6366f1;
  color: #6366f1;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.pixel-btn:hover {
  background: #6366f1;
  color: white;
}

.screens-container {
  display: flex;
  gap: 40px;
  padding: 40px;
}

.screen-item {
  width: 300px;
  height: 500px;
  background: #18181b;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.screen-header {
  height: 32px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.screen-name {
  font-size: 12px;
  color: #71717a;
}

.screen-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 14px;
  border-left: 3px solid #6366f1;
}

.node-item.text {
  border-left-color: #ec4899;
}
.node-item.image {
  border-left-color: #2dd4bf;
}

/* Right Properties Panel */
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

/* --- Status Bar --- */
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
}

/* Shared Icons */
.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
