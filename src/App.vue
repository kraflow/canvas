<script setup lang="ts">
import PlaygroundView from './playgrounds/PlaygroundView.vue'
</script>

<template>
  <div class="app-container">
    <main class="playground-wrapper">
      <PlaygroundView />
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
  background-color: #0c0c0e;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
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
    'Outfit',
    'Inter',
    -apple-system,
    sans-serif;
  overflow: hidden;
}

.playground-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  background: #0c0c0e;
}
</style>
