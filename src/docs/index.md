# Kraflow Canvas

A CanvasKit (Skia WASM) rendering engine with a Yoga-powered layout system.

## Architecture Overview

```
src/core/
├── renderer/         # CanvasKit surface, animation loop, draw functions
│   ├── draw/         # View, Text, Image renderers + DrawContext + ImageCache
│   ├── renderer.ts   # CanvasRenderer class (Surface, RAF, Viewport)
│   ├── load.ts       # CanvasKit WASM loader
│   └── types.ts      # LayoutRect, RendererOptions
├── interaction/      # Interaction manager and mode logic
│   ├── InteractionManager.ts # Edit, Move, Play modes (with drag optimization)
│   └── types.ts      # InteractionState, Events
├── scene/            # Scene graph with Yoga layout and Spatial Index
│   ├── scene-graph.ts
│   ├── yoga-loader.ts # Conditional CDN loading for Yoga WASM
│   ├── SpatialIndex.ts
│   ├── style-sync.ts
│   ├── text-measure-cache.ts
│   └── types.ts
├── fonts/            # Font loading, paragraph building, text segmentation
│   ├── font-system.ts
│   ├── font-loader.ts
│   ├── font-mgr-factory.ts
│   ├── paragraph-builder.ts
│   └── ...
├── viewport/         # Viewport (Panning, Zooming)
│   └── Viewport.ts
├── styles/           # React Native–compatible style definitions
│   └── types/
│       ├── flex.ts   # FlexStyle (layout props)
│       ├── view.ts   # ViewStyle (visual props)
│       ├── text.ts   # TextStyle
│       └── image.ts  # ImageStyle
└── utils/            # Utility functions
    └── dev-error.ts  # Development error handling
```

## Quick Start

```ts
import { CanvasRenderer } from '@/core/renderer'
import { createFontSystem } from '@/core/fonts'
import { renderView, renderText, renderImage, DrawContext } from '@/core/renderer/draw'
import { SceneGraph } from '@/core/scene'
import { InteractionManager } from '@/core/interaction'
import { Viewport } from '@/core/viewport/Viewport'

// 1. Initialize Renderer and Load CanvasKit
const viewport = new Viewport({ x: 0, y: 0, zoom: 1 })
const renderer = new CanvasRenderer({
  canvas: document.querySelector('canvas')!,
  viewport: viewport,
  onDraw: (canvas, ck) => {
    // 6. Draw scene (inside the loop)
    scene.walk((node, rect) => {
      if (node.type === 'view') renderView(ck, canvas, node.style, rect)
      // else renderText, renderImage...
    })
  },
})
await renderer.initialize()
const ck = renderer.ck!

// 2. Create font system
const fonts = createFontSystem(ck, manifest)

// 3. Build scene graph
const scene = await SceneGraph.create(ck, fonts)
const screen = scene.addScreen('main', 0, 0, 400, 600)

// 4. Initialize Interaction
const interaction = new InteractionManager(renderer.canvas!, scene, viewport)

// 5. Add nodes and compute layout
const card = scene.createNode('view', { backgroundColor: 'rgba(255, 0, 0, 0.1)', padding: 20 })
scene.appendChild(screen.root, card)
scene.computeAllLayouts()

// Initial frame
renderer.requestFrame()

// Cleanup
renderer.dispose()
interaction.dispose()
scene.dispose()
fonts.dispose()
```

---

Next: See individual module docs:

- [Renderer](./renderer.md)
- [Scene Graph](./scene-graph.md)
- [Interaction](./interaction.md)
- [Font System](./fonts.md)
- [Styles](./styles.md)
- [DrawContext & ImageCache](./resource-management.md)

## Configuration

The library uses a centralized configuration system in `constants.ts`:

```ts
import { CONFIG, configure, resetConfig } from '@/core/constants'

// Access current values
console.log(CONFIG.TEXT_DEFAULT_FONT_SIZE) // 14
console.log(CONFIG.VIEWPORT_MIN_ZOOM) // 0.01

// Update configuration at runtime
configure({
  TEXT_DEFAULT_FONT_SIZE: 16,
  GRID_SHOW: false,
})

// Reset to defaults
resetConfig()
```

Key configuration categories:

- **Colors**: Canvas background, overlay colors (hover, selection, marquee)
- **Viewport**: Min/max zoom, default zoom, wheel sensitivity
- **Grid**: Colors, thresholds, stroke widths
- **Text**: Default font, sizes, cache limits
- **Rendering**: Blur precision, border dash/dot multipliers

Environment detection:

```ts
import { IS_DEV } from '@/core/constants'

if (IS_DEV) {
  // Development-only code
}
```
