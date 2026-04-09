/// <reference types="vite/client" />

declare const __DEV__: boolean
declare const __VERSION__: string

declare module 'canvaskit-wasm/bin/canvaskit.wasm?url' {
  const url: string
  export default url
}

// CDN module for yoga-layout in production builds
declare module 'https://cdn.jsdelivr.net/npm/yoga-layout@3.2.1/+esm' {
  export * from 'yoga-layout/load'
}

// CDN module for canvaskit-wasm in production builds
declare module 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/+esm' {
  import type { CanvasKit } from 'canvaskit-wasm'
  export default function CanvasKitInit(options: {
    locateFile: (file: string) => string
  }): Promise<CanvasKit>
}
