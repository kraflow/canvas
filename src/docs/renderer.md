# Renderer

The renderer manages the CanvasKit WebGL surface, the animation loop, and coordinate systems (Viewports).

## CanvasRenderer Class

The `CanvasRenderer` is the primary entry point for managing the rendering lifecycle.

```ts
import { CanvasRenderer } from '@/core/renderer'
```

### Constructor

```ts
const renderer = new CanvasRenderer({
  canvas: HTMLCanvasElement,
  onDraw: (canvas: Canvas, ck: CanvasKit) => void,
  viewport?: Viewport,
})
```

| Option     | Type                            | Description                                          |
| ---------- | ------------------------------- | ---------------------------------------------------- |
| `canvas`   | `HTMLCanvasElement`             | The DOM element to render into                       |
| `onDraw`   | `(canvas: Canvas, ck: ck) => void` | Your main draw loop callback                         |
| `viewport` | `Viewport`                      | _(optional)_ Initial viewport state                  |

### Methods

#### `async initialize(): Promise<void>`
Loads the CanvasKit WASM module and builds the initial WebGL surface.

#### `requestFrame(): void`
Requests a single frame to be drawn. Use this for reactive updates when not in a continuous animation loop.

#### `setAnimating(animating: boolean): void`
Starts or stops a continuous `requestAnimationFrame` loop (e.g., for games or smooth transitions).

#### `resize(width: number, height: number): void`
Resizes the internal surface to match new CSS dimensions. Handles HiDPI (`devicePixelRatio`) automatically.

#### `dispose(): void`
Tears down the WebGL surface and stops all animation loops.

---

## Viewport

The `Viewport` manages panning and zooming. It converts between screen space (pixels) and world space.

```ts
import { Viewport } from '@/core/viewport/Viewport'

const viewport = new Viewport({ x: 0, y: 0, zoom: 1 })
```

### Properties

- `x`, `y`: World-space coordinates of the viewport origin.
- `zoom`: Scale factor (1 = 100%).

### Methods

#### `screenToWorld(x, y, rect): { x, y }`
Converts a screen-space coordinate (e.g., from a MouseEvent) to world-space.

#### `worldToScreen(x, y, rect): { x, y }`
Converts a world-space coordinate to screen-space.

#### `translate(dx, dy): void`
Pans the viewport by a delta.

#### `zoomAtPoint(delta, screenX, screenY, rect): void`
Zooms toward or away from a specific screen-space point (anchor zoom).

---

## Draw Functions

Draw functions render individual UI elements. They are **stateless** — they take a CanvasKit canvas, a style object, and a layout rect, and paint the element.

```ts
import { renderView, renderText, renderImage } from '@/core/renderer/draw'
```

### `renderView(ck, canvas, style, rect, scroll?, drawContent?, ctx?)`

Renders a View element with all visual properties (shadows, borders, transforms).

**Draw order:**
1. Transforms (2D Matrix)
2. Opacity + Filters (Blur, Brightness, etc.)
3. Outset box shadows
4. Background fill
5. Borders
6. Inset box shadows
7. Overflow clipping
8. Child content (via `drawContent`)
9. Outline

### `renderText(ck, canvas, text, style, rect, ctx?)`

Renders a Text element. Uses the `FontSystem` to build and cache paragraphs.

### `renderImage(ck, canvas, image, style, rect, ctx?)`

Renders an Image element. Supports `objectFit` modes: `cover`, `contain`, `fill`, `center`, `scale-down`, `repeat`.
