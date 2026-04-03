import type { CanvasKit, FontMgr } from 'canvaskit-wasm'
import { createFontStore, fontKey } from './font-store'
import { createFontLoader } from './font-loader'
import { createTypefaceRegistry } from './typeface-registry'
import { buildFontMgr } from './font-mgr-factory'
import { createPictureCache } from './picture-cache'
import { resolveFallbacks } from './fallback-chain'
import { segmentText } from './text-segmenter'
import { buildParagraph, type ParagraphOptions } from './paragraph-builder'
import { getEagerEntries, getVariant, type FontManifest } from './font-manifest'

export interface FontSystem {
  // Load a specific font variant
  load(family: string, weight?: number): Promise<void>
  // Ensure all fonts needed for a text string are loaded, then return updated FontMgr
  prepareForText(text: string, primaryFamily: string, weight?: number): Promise<FontMgr>
  // High-level: segment text + build paragraph in one call
  makeParagraph(
    text: string,
    primaryFamily: string,
    opts: ParagraphOptions,
    maxWidth: number,
  ): Promise<import('canvaskit-wasm').Paragraph>
  // Rebuild FontMgr after new fonts loaded (call after lazy loads)
  rebuildFontMgr(): FontMgr
  // Access sub-modules for advanced use
  store: ReturnType<typeof createFontStore>
  loader: ReturnType<typeof createFontLoader>
  registry: ReturnType<typeof createTypefaceRegistry>
  pictures: ReturnType<typeof createPictureCache>
  // Teardown
  dispose(): void
}

export async function createFontSystem(ck: CanvasKit, manifest: FontManifest): Promise<FontSystem> {
  const store = createFontStore()
  const loader = createFontLoader(store)
  const registry = createTypefaceRegistry(ck, store)
  const pictures = createPictureCache()

  // 1. Load all eager fonts before returning
  const eagerEntries = getEagerEntries(manifest)
  await Promise.all(
    eagerEntries.map(({ family, weight, url }) =>
      loader.load(fontKey(family, Number(weight)), url),
    ),
  )

  // Register eager typefaces
  for (const { family, weight } of eagerEntries) {
    registry.register(fontKey(family, Number(weight)))
  }

  // 2. Build initial FontMgr
  let fontMgr = buildFontMgr(ck, store, store.allKeys())
  let isDisposed = false

  // ── internal helpers ──

  function rebuildFontMgr(): FontMgr {
    if (isDisposed) return fontMgr
    const newMgr = buildFontMgr(ck, store, store.allKeys())
    if (fontMgr) fontMgr.delete()
    fontMgr = newMgr
    return fontMgr
  }

  async function load(family: string, weight = 400, skipRebuild = false): Promise<void> {
    const key = fontKey(family, weight)
    if (store.has(key)) return

    const variant = getVariant(manifest, family, weight)
    if (!variant) {
      console.warn(`[font-system] No variant found for ${family}:${weight}`)
      return
    }

    try {
      await loader.load(key, variant.url)
      registry.register(key)
    } catch (e) {
      console.warn(`[font-system] Failed to load ${family}:${weight}`, e)
      return
    }

    if (!skipRebuild) {
      rebuildFontMgr()
    }
  }

  async function prepareForText(
    text: string,
    primaryFamily: string,
    weight = 400,
  ): Promise<FontMgr> {
    const { missing } = resolveFallbacks(
      text,
      manifest,
      (family) => store.has(fontKey(family, weight)),
      primaryFamily,
    )

    if (missing.length > 0) {
      await Promise.all(missing.map((f) => load(f, weight, true)))
      rebuildFontMgr()
    }

    return fontMgr
  }

  async function makeParagraph(
    text: string,
    primaryFamily: string,
    opts: ParagraphOptions,
    maxWidth: number,
  ) {
    if (isDisposed) throw new Error('FontSystem is disposed')
    const weight = opts.fontWeight ?? opts.fontStyle?.weight ?? 400
    await prepareForText(text, primaryFamily, weight)
    if (isDisposed) throw new Error('FontSystem is disposed')
    const segments = segmentText(text, manifest.families, primaryFamily)
    return buildParagraph(ck, fontMgr, segments, opts, maxWidth)
  }

  function dispose() {
    if (isDisposed) return
    isDisposed = true
    if (fontMgr) fontMgr.delete()
    registry.dispose()
    pictures.dispose()
  }

  return {
    load,
    prepareForText,
    makeParagraph,
    rebuildFontMgr,
    store,
    loader,
    registry,
    pictures,
    dispose,
  }
}
