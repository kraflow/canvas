# Renderer

The renderer manages the CanvasKit WebGL surface, the animation loop, and provides the `onDraw` callback where you paint your UI.

## Initialization

```ts
import { loadCanvasKit, initializeCanvas, setAnimating, resize, dispose } from '@/core/renderer'
```

### `loadCanvasKit(): Promise<CanvasKit>`

Loads the CanvasKit WASM module. The result is cached — subsequent calls return the same instance.

```ts
const ck = await loadCanvasKit()
```

- In development: loads from bundled WASM file
- In production: loads from CDN (`unpkg.com/canvaskit-wasm`)

### `initializeCanvas(options): Promise<void>`

Creates the WebGL surface on an HTML canvas element.

```ts
await initializeCanvas({
  canvas: document.querySelector('canvas')!,
  onDraw: (canvas, ck) => {
    // Your draw code here — called every frame
  },
})
```

| Option | Type | Description |
|--------|------|-------------|
| `canvas` | `HTMLCanvasElement` | The canvas element to render into |
| `fonts` | `FontSystem` | _(optional)_ Font system instance |
| `onDraw` | `(canvas, ck) => void` | Called each frame with the Skia Canvas and CanvasKit |

The surface is created with:
- WebGL 2 + SRGB color space
- HiDPI scaling (`devicePixelRatio`)
- 8-bit stencil buffer

### `setAnimating(animating: boolean)`

Starts or stops the `requestAnimationFrame` loop.

```ts
setAnimating(true)   // Start rendering
setAnimating(false)  // Pause rendering
```

### `resize(width: number, height: number)`

Resizes the surface. Call this when the container size changes.

```ts
resize(container.clientWidth, container.clientHeight)
```

### `dispose()`

Tears down the surface and stops animation. Call on unmount.

---

## Draw Functions

Draw functions render individual UI elements. They are **stateless** — they take a CanvasKit canvas, a style object, and a layout rect, and paint the element.

```ts
import { renderView, renderText, renderImage } from '@/core/renderer/draw'
```

### `renderView(ck, canvas, style, rect, scroll?, drawContent?, ctx?)`

Renders a View element with all visual properties.

```ts
renderView(ck, canvas, {
  backgroundColor: Float32Array.from([0.1, 0.1, 0.15, 1]),
  borderRadius: 16,
  borderWidth: 1,
  borderColor: Float32Array.from([1, 1, 1, 0.1]),
  boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: Float32Array.from([0, 0, 0, 0.4]) }],
  padding: 20,
}, { x: 50, y: 50, w: 300, h: 200 })
```

**Draw order:**
1. Transforms (translate, rotate, scale, skew, matrix)
2. Opacity + filter layer (blur, brightness, contrast, grayscale, etc.)
3. Outset box shadows
4. Background fill
5. Borders (per-side color/width, solid/dashed/dotted)
6. Inset box shadows
7. Overflow clipping + scroll offset
8. Child content (via `drawContent` callback)
9. Outline

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `ck` | `CanvasKit` | CanvasKit instance |
| `canvas` | `Canvas` | Skia canvas to draw on |
| `style` | `ViewStyle` | Visual + layout style |
| `rect` | `LayoutRect` | Position and size `{ x, y, w, h }` |
| `scroll` | `ScrollPosition?` | Scroll offset `{ x, y }` |
| `drawContent` | `() => void` | Callback to draw children inside the view's clip/transform scope |
| `ctx` | `DrawContext?` | Resource pool for zero-alloc rendering |

**Composition pattern** — child renderers (Text, Image) use the `drawContent` callback to draw inside the view's transform/clip scope:

```ts
renderView(ck, canvas, style, rect, undefined, () => {
  // This runs inside the view's save/restore scope
  // Transforms, opacity, clipping are already applied
  canvas.drawParagraph(para, x, y)
}, ctx)
```

### `renderText(ck, canvas, style, rect, text, fontSystem?, paragraph?, ctx?)`

Renders a Text element. Delegates all ViewStyle rendering to `renderView` internally.

```ts
renderText(ck, canvas, {
  color: Float32Array.from([1, 1, 1, 1]),
  fontSize: 18,
  fontFamily: 'Inter',
  fontWeight: 600,
  textAlign: 'center',
  lineHeight: 26,
}, { x: 50, y: 50, w: 300, h: 40 }, 'Hello World', fonts, null, ctx)
```

**Supported text properties:**
- Font: `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `fontVariant`
- Spacing: `letterSpacing`, `lineHeight`
- Alignment: `textAlign`, `textAlignVertical`, `verticalAlign`
- Decoration: `textDecorationLine`, `textDecorationStyle`, `textDecorationColor`
- Shadow: `textShadowColor`, `textShadowOffset`, `textShadowRadius`
- Transform: `textTransform` (uppercase, lowercase, capitalize)

### `renderTextAsync(ck, canvas, style, rect, text, fontSystem, ctx?)`

Same as `renderText`, but loads fonts on demand. Use when fonts might not be loaded yet.

### `renderImage(ck, canvas, style, rect, image, ctx?)`

Renders an Image element. Delegates all ViewStyle rendering to `renderView` internally.

```ts
const img = await imageCache.load('https://example.com/photo.jpg')
renderImage(ck, canvas, {
  borderRadius: 12,
  overflow: 'hidden',
  objectFit: 'cover',
}, { x: 50, y: 50, w: 300, h: 200 }, img, ctx)
```

**Supported fit modes:**

| Mode | Description |
|------|-------------|
| `cover` | Scale to cover the rect (may crop) — **default** |
| `contain` | Scale to fit entirely within the rect |
| `fill` | Stretch to fill exactly |
| `center` | No scaling, centered |
| `scale-down` | Like `contain`, but never scales up |
| `repeat` | Tile the image across the rect |

**Additional properties:**
- `tintColor` — replaces all non-transparent pixels with this color
- `objectFit` / `resizeMode` — see table above
