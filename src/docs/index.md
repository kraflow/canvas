# Kraflow Canvas

A CanvasKit (Skia WASM) rendering engine with a Yoga-powered layout system.

## Architecture Overview

```
src/core/
├── renderer/         # CanvasKit surface, animation loop, draw functions
│   ├── draw/         # View, Text, Image renderers + DrawContext + ImageCache
│   ├── renderer.ts   # Surface management, RAF loop
│   ├── load.ts       # CanvasKit WASM loader
│   └── types.ts      # LayoutRect, RendererOptions
├── scene/            # Scene graph with Yoga layout
│   ├── scene-graph.ts
│   ├── style-sync.ts
│   └── types.ts
├── fonts/            # Font loading, paragraph building, text segmentation
│   ├── font-system.ts
│   ├── font-manifest.ts
│   ├── paragraph-builder.ts
│   └── ...
└── styles/           # React Native–compatible style type definitions
    └── types/
        ├── flex.ts   # FlexStyle (layout props)
        ├── view.ts   # ViewStyle (visual props)
        ├── text.ts   # TextStyle
        └── image.ts  # ImageStyle
```

## Quick Start

```ts
import { loadCanvasKit, initializeCanvas, setAnimating, dispose } from '@/core/renderer'
import { createFontSystem } from '@/core/fonts'
import { renderView, renderText, renderImage, DrawContext, ImageCache } from '@/core/renderer/draw'
import { SceneGraph } from '@/core/scene'

// 1. Load CanvasKit WASM
const ck = await loadCanvasKit()

// 2. Create font system
const fonts = await createFontSystem(ck, manifest)

// 3. Create resource managers
const drawCtx = new DrawContext(ck)
const imageCache = new ImageCache(ck)

// 4. Build scene graph
const scene = await SceneGraph.create()
const screen = scene.addScreen('main', 0, 0, 400, 600)

// 5. Add nodes
const card = scene.createNode('view', { backgroundColor: [0.1, 0.1, 0.1, 1], padding: 20 })
scene.appendChild(screen.root, card)

// 6. Compute layout
scene.computeAllLayouts()

// 7. Initialize canvas and render
await initializeCanvas({
  canvas: document.querySelector('canvas')!,
  onDraw: (canvas, ck) => {
    drawCtx.beginFrame()
    scene.walk((node, rect) => {
      renderView(ck, canvas, node.style, rect, undefined, undefined, drawCtx)
    })
  },
})

setAnimating(true)

// 8. Cleanup
dispose()
drawCtx.dispose()
imageCache.dispose()
scene.dispose()
fonts.dispose()
```

---

Next: See individual module docs:

- [Renderer](./renderer.md)
- [Scene Graph](./scene-graph.md)
- [Font System](./fonts.md)
- [Styles](./styles.md)
- [DrawContext & ImageCache](./resource-management.md)
