<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'

const playgrounds = {
  default: defineAsyncComponent(() => import('./playgrounds/PlaygroundView.vue')),
}

type PType = keyof typeof playgrounds
const activeTab = ref<PType>('default')

const activeComponent = computed(() => playgrounds[activeTab.value])
</script>

<template>
  <div class="app-container">
    <!-- Navigation Architecture -->
    <nav class="navbar">
      <div class="logo">
        <span class="logo-icon"></span>
        <span class="logo-text">Kraflow Playground</span>
      </div>
      <div class="tabs">
        <button
          v-for="(_, name) in playgrounds"
          :key="name"
          :class="['tab-btn', activeTab === name ? 'active' : '']"
          @click="activeTab = name"
        >
          {{ name[0]!.toUpperCase() + name.slice(1) || 'Tab' }}
        </button>
      </div>
    </nav>

    <!-- Dynamic Canvas Wrapper -->
    <main class="playground-wrapper">
      <suspense>
        <template #fallback>
          <div style="display: flex; align-items: center; justify-content: center; height: 100%">
            <span style="color: #a1a1aa; font-size: 1.2rem">Loading...</span>
          </div>
        </template>
        <component :is="activeComponent" />
      </suspense>
    </main>
  </div>
</template>

<style>
/* Global Box Sizing */
*,
*::before,
*::after {
  box-sizing: border-box;
}
body,
html {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #0c0c0e;
  color: #fff;
  font-family:
    'Inter',
    -apple-system,
    sans-serif;
  overflow: hidden;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: rgba(18, 18, 20, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    box-shadow: 0 0 16px rgba(79, 172, 254, 0.4);
  }
  25% {
    background: linear-gradient(135deg, #6c6dfe 0%, #a146fe 100%);
    box-shadow: 0 0 16px rgba(172, 102, 254, 0.4);
  }
  50% {
    background: linear-gradient(135deg, #e500fe 0%, #fe4fa1 100%);
    box-shadow: 0 0 16px rgba(229, 0, 254, 0.4);
  }
  75% {
    background: linear-gradient(135deg, #a146fe 0%, #6c6dfe 100%);
    box-shadow: 0 0 16px rgba(172, 102, 254, 0.4);
  }
  100% {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    box-shadow: 0 0 16px rgba(79, 172, 254, 0.4);
  }
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  background: linear-gradient(to right, #fff, #a1a1aa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  background: transparent;
  border: none;
  color: #a1a1aa;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.playground-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  margin-top: 64px;
  background: #0c0c0e;
}
</style>
