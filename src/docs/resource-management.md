# DrawContext & ImageCache

WASM objects (Paint, MaskFilter, PathEffect, Image) live on the Emscripten heap and must be manually managed. These two classes handle this automatically.

## DrawContext

Pools and caches CanvasKit WASM objects to eliminate per-frame allocation.

### The Problem

Without pooling, every frame allocates and deletes ~26 WASM objects:
- `new ck.Paint()` + `paint.delete()` for every background, shadow, border, outline
- `ck.MaskFilter.MakeBlur()` for every shadow
- `ck.PathEffect.MakeDash()` for every dashed/dotted border

At 60fps with a 200-node tree = **~312,000 alloc/dealloc per second**.

### The Solution

```ts
import { DrawContext } from '@/core/renderer/draw'

const ctx = new DrawContext(ck)
```

| Resource | Strategy | Lifecycle |
|----------|----------|-----------|
| **Paint** | Pool with index reset per frame | Allocated on demand, reused forever |
| **MaskFilter** (blur) | Cache keyed by rounded sigma | Created once per unique sigma |
| **PathEffect** (dash/dot) | Cache keyed by `style:width` | Created once per unique config |

### Usage

```ts
// At the start of each frame:
ctx.beginFrame()

// During rendering (called by renderView/renderText/renderImage internally):
const paint = ctx.paint()    // Returns a clean, reusable Paint
paint.setColor(...)          // Use it normally — no need to .delete()

// Blur MaskFilter (cached by sigma):
const blur = ctx.blurMask(4.0)   // Created once, reused forever

// Border PathEffect (cached by style+width):
const dash = ctx.borderEffect('dashed', 2)  // Created once, reused forever
```

### Passing to Renderers

All render functions accept an optional `ctx` parameter:

```ts
renderView(ck, canvas, style, rect, scroll, drawContent, ctx)
renderText(ck, canvas, style, rect, text, fonts, null, ctx)
renderImage(ck, canvas, style, rect, image, ctx)
```

When `ctx` is provided: **zero WASM allocation** after the first frame.
When `ctx` is omitted: creates temporary Paint objects (backward-compatible).

### Diagnostics

```ts
console.log(`Pool size: ${ctx.poolSize}`)  // e.g. "Pool size: 26"
```

### Cleanup

```ts
ctx.dispose()  // Deletes all pooled Paints, cached MaskFilters, cached PathEffects
```

---

## ImageCache

Reference-counted cache for CanvasKit `Image` objects.

### The Problem

`ck.MakeImageFromEncoded()` allocates GPU-backed textures. If you load the same image multiple times, you waste GPU memory. If you forget to `.delete()`, you leak.

### Usage

```ts
import { ImageCache } from '@/core/renderer/draw'

const cache = new ImageCache(ck)
```

### Loading Images

```ts
// From URL (fetches + decodes + caches, refCount = 1)
const img = await cache.load('https://example.com/photo.jpg')

// From raw bytes (sync, refCount = 1)
const img2 = cache.loadBytes('my-icon', pngUint8Array)
```

### Reference Counting

```ts
// Acquire — increments refCount, returns cached image
const img = cache.acquire('https://example.com/photo.jpg')  // refCount: 2

// Release — decrements refCount
cache.release('https://example.com/photo.jpg')  // refCount: 1

// When refCount hits 0, the CanvasKit Image is .delete()'d automatically
cache.release('https://example.com/photo.jpg')  // refCount: 0 → deleted
```

### Query

```ts
cache.has('https://...')    // boolean
cache.refCount('https://...')  // number
cache.size                  // total cached images
```

### Cleanup

```ts
cache.dispose()  // Deletes ALL cached images, regardless of refCount
```

---

## Lifecycle Summary

```ts
// Setup (once)
const drawCtx = new DrawContext(ck)
const imageCache = new ImageCache(ck)

// Per frame
drawCtx.beginFrame()

// Render (uses pooled resources automatically)
scene.walk((node, rect) => {
  renderView(ck, canvas, node.style, rect, undefined, undefined, drawCtx)
})

// Teardown (once)
drawCtx.dispose()
imageCache.dispose()
```

## Performance Impact

| Metric | Without DrawContext | With DrawContext |
|--------|-------------------|-----------------|
| Paint allocs/frame | ~26 | 0 (after frame 1) |
| MaskFilter allocs/frame | ~4 (leaked!) | 0 (cached) |
| PathEffect allocs/frame | ~2 | 0 (cached) |
| Total WASM ops at 60fps | ~1,920/sec | 0/sec |
