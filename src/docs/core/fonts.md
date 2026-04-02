# font-system usage

A modular font manager for CanvasKit-WASM. Each concern is a pure function — import only what you need.

---

## quick start

```ts
import CanvasKitInit from 'canvaskit-wasm'
import { createFontSystem } from './font-system'
import { createFontManifest } from './font-manifest'

const ck = await CanvasKitInit({ locateFile: (f) => `/wasm/${f}` })

const manifest = createFontManifest({
  families: {
    Inter: {
      weights: [400, 700],
      variants: {
        '400': { url: '/fonts/inter-regular.woff2', priority: 'eager' },
        '700': { url: '/fonts/inter-bold.woff2', priority: 'lazy' },
      },
      unicodeRanges: ['U+0000-00FF'],
    },
    NotoSansJP: {
      weights: [400],
      variants: {
        '400': { url: '/fonts/noto-jp.woff2', priority: 'on-demand' },
      },
      unicodeRanges: ['U+3040-309F', 'U+30A0-30FF'],
    },
  },
  fallbackChain: ['Inter', 'NotoSansJP'],
  eagerLoad: ['Inter'], // loaded before createFontSystem() resolves
})

// boots, loads eager fonts, builds initial FontMgr
const fonts = await createFontSystem(ck, manifest)
```

---

## rendering text

### simple — one call does everything

```ts
const para = await fonts.makeParagraph(
  'Hello 日本語',
  'Inter', // primary family
  { fontSize: 16, color: [30, 30, 30, 255] },
  400, // max layout width in px
)

canvas.drawParagraph(para, x, y)
para.delete()
```

`makeParagraph` handles loading, script segmentation, and `ParagraphBuilder` internally. For mixed-script text it splits the string into runs and assigns the correct font family to each.

### manual — more control

```ts
import { segmentText } from './text-segmenter'
import { buildParagraph } from './paragraph-builder'

// 1. make sure fonts for this text are loaded
const mgr = await fonts.prepareForText('Hello 日本語', 'Inter')

// 2. split into per-script segments
const segments = segmentText('Hello 日本語', manifest.families, 'Inter')
// → [{ text: 'Hello ', family: 'Inter', dir: 'ltr' },
//    { text: '日本語',  family: 'NotoSansJP', dir: 'ltr' }]

// 3. build paragraph
const para = buildParagraph(
  ck,
  mgr,
  segments,
  {
    fontSize: 16,
    color: [30, 30, 30, 255],
    letterSpacing: 0.5,
    lineHeight: 1.4,
  },
  400,
)
```

---

## loading fonts

### on demand

```ts
// loads Inter 700 and rebuilds FontMgr automatically
await fonts.load('Inter', 700)
```

### checking load state

```ts
import { fontKey } from './font-store'

fonts.store.has(fontKey('Inter', 400)) // true after eager load
fonts.loader.isLoaded(fontKey('Inter', 700)) // false until explicitly loaded
```

---

## missing font fallback (SkPicture cache)

Cache the last valid render so text stays visible even when a font is unavailable — same pattern used by open-pencil.

```ts
import { recordToPicture } from './picture-cache'

// when font IS available — record and cache
const pic = recordToPicture(ck, nodeWidth, nodeHeight, (canvas) => {
  canvas.drawParagraph(para, 0, 0)
})
fonts.pictures.store(nodeId, pic)

// when font is MISSING — replay from cache
const cached = fonts.pictures.get(nodeId)
if (cached) {
  canvas.drawPicture(cached) // pixel-perfect, no font needed
} else {
  drawPlaceholderBox(canvas, nodeId) // first-time fallback
}
```

Invalidate when the node's text or style changes:

```ts
fonts.pictures.invalidate(nodeId)
```

---

## rebuilding FontMgr after lazy loads

`fonts.load()` and `fonts.prepareForText()` rebuild the `FontMgr` automatically. If you load buffers manually via `fonts.store`, call this after:

```ts
fonts.store.set(fontKey('MyFont', 400), buffer)
const newMgr = fonts.rebuildFontMgr()
```

> **Rule:** all fallback families must live in the same `FontMgr.FromData()` call. Never create separate managers per font — CanvasKit's glyph fallback only works within a single `FontMgr`.

---

## teardown

```ts
// call on unmount or CanvasKit context loss
fonts.dispose()

// on context loss — recreate the whole system
const fonts = await createFontSystem(newCk, manifest)
```

`dispose()` calls `.delete()` on all `SkTypeface` objects and clears the `SkPicture` cache. `FontStore` (raw `ArrayBuffer`s) is not cleared — buffers survive context loss and will be reused when you rebuild.

---

## module map

| file                   | exports                                                                        | purpose                        |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| `font-manifest.ts`     | `createFontManifest`, `getVariant`, `getEagerEntries`, `getFamilyForCodePoint` | static config                  |
| `font-store.ts`        | `createFontStore`, `fontKey`                                                   | `ArrayBuffer` cache            |
| `font-loader.ts`       | `createFontLoader`                                                             | fetch with dedup + concurrency |
| `typeface-registry.ts` | `createTypefaceRegistry`                                                       | `SkTypeface` cache (CK-bound)  |
| `font-mgr-factory.ts`  | `buildFontMgr`, `disposeFontMgr`                                               | `FontMgr.FromData` wrapper     |
| `fallback-chain.ts`    | `resolveFallbacks`                                                             | unicode → family resolution    |
| `text-segmenter.ts`    | `segmentText`                                                                  | per-script text splitting      |
| `paragraph-builder.ts` | `buildParagraph`                                                               | `ParagraphBuilder` wrapper     |
| `picture-cache.ts`     | `createPictureCache`, `recordToPicture`                                        | missing-font fallback          |
| `font-system.ts`       | `createFontSystem`                                                             | bootstrap — wires everything   |

---

## priorities

| value       | when loads                                                                        |
| ----------- | --------------------------------------------------------------------------------- |
| `eager`     | before `createFontSystem()` resolves — must be ready for first frame              |
| `lazy`      | call `fonts.load(family, weight)` explicitly                                      |
| `on-demand` | loaded automatically by `makeParagraph` / `prepareForText` when the text needs it |
