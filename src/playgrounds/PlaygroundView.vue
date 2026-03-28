<template>
  <div class="wrapper">Hi <span class="shine"> @kraflow </span></div>
</template>

<script setup lang="ts">
defineProps<{
  name?: string
  duration?: number
}>()
</script>

<style scoped>
.wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 50px;
}

/* 🔥 Gradient + Glow Text */
.shine {
  margin-left: 12px;
  font-weight: bold;

  /* Gradient */
  background: linear-gradient(270deg, #4facfe, #6c6dfe, #e500fe, #fe4fa1, #4facfe);
  background-size: 600% 600%;

  /* Apply gradient to text */
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;

  /* Glow */
  text-shadow:
    0 0 8px rgba(79, 172, 254, 0.6),
    0 0 16px rgba(172, 102, 254, 0.5),
    0 0 24px rgba(229, 0, 254, 0.4);

  /* Animation */
  animation:
    shine var(--duration, 4s) ease infinite,
    glowShift var(--duration, 4s) ease infinite;
}

/* 🌈 Gradient movement */
@keyframes shine {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 🔥 Glow color shift */
@keyframes glowShift {
  0% {
    text-shadow:
      0 0 8px rgba(79, 172, 254, 0.6),
      0 0 16px rgba(79, 172, 254, 0.5);
  }
  50% {
    text-shadow:
      0 0 12px rgba(229, 0, 254, 0.7),
      0 0 24px rgba(254, 79, 161, 0.6);
  }
  100% {
    text-shadow:
      0 0 8px rgba(79, 172, 254, 0.6),
      0 0 16px rgba(79, 172, 254, 0.5);
  }
}
</style>
