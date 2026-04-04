import type { CanvasKit, FontMgr, Paragraph } from 'canvaskit-wasm'
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
  /**
   * Loads a font variant by family and weight. If the font is already loaded, this is a no-op.
   * After loading, the font is registered and available for use in paragraphs.
   * @param {string} family - The font family to load (e.g. "Roboto").
   * @param {number} [weight=400] - The font weight to load (e.g. 400 for normal, 700 for bold).
   * @returns {Promise<void>} - A promise that resolves when the font is loaded and registered.
   */
  load(family: string, weight?: number): Promise<void>

  /**
   * Prepares the FontMgr for rendering the given text with the specified primary family and weight.
   * This will check for missing fonts needed to render the text, load them if necessary, and rebuild the FontMgr.
   * @param {string} text - The text to prepare for.
   * @param {string} primaryFamily - The primary font family to use for the text.
   * @param {number} [weight=400] - The font weight to use for the primary family.
   * @returns {Promise<FontMgr>} - A promise that resolves to the prepared FontMgr instance.
   */
  prepareForText(text: string, primaryFamily: string, weight?: number): Promise<FontMgr>

  /**
   * Creates a Paragraph instance for the given text, primary family, options, and max width. This will ensure all necessary fonts are loaded before building the paragraph.
   * @param {string} text - The text to render in the paragraph.
   * @param {string} primaryFamily - The primary font family to use for the text.
   * @param {ParagraphOptions} opts - The options for the paragraph.
   * @param {number} maxWidth - The maximum width for the paragraph layout.
   * @returns {Promise<Paragraph>} - A promise that resolves to the created Paragraph instance.
   * @throws {Error} If the FontSystem is disposed before the paragraph can be created.
   */
  makeParagraph(
    text: string,
    primaryFamily: string,
    opts: ParagraphOptions,
    maxWidth: number,
  ): Promise<Paragraph>

  /**
   * Synchronously creates a Paragraph instance for the given text, primary family, options, and max width. This assumes all necessary fonts are already loaded and the FontMgr is prepared.
   * @param {string} text - The text to render in the paragraph.
   * @param {string} primaryFamily - The primary font family to use for the text.
   * @param {ParagraphOptions} opts - The options for the paragraph.
   * @param {number} maxWidth - The maximum width for the paragraph layout.
   * @returns {Paragraph} - The created Paragraph instance.
   * @throws {Error} If the FontSystem is disposed before the paragraph can be created, or if necessary fonts are not loaded.
   */
  makeParagraphSync(
    text: string,
    primaryFamily: string,
    opts: ParagraphOptions,
    maxWidth: number,
  ): Paragraph

  /**
   * Rebuilds the FontMgr instance with the currently loaded fonts. This should be called after loading new fonts to ensure they are available for paragraph creation. If the FontSystem is disposed, this will return the existing FontMgr without rebuilding.
   * @returns {FontMgr} - The current FontMgr instance, rebuilt if the system is not disposed.
   * @throws {Error} If the FontSystem is disposed and the FontMgr cannot be rebuilt.
   */
  rebuildFontMgr(): FontMgr
  // Access sub-modules for advanced use
  store: ReturnType<typeof createFontStore>
  loader: ReturnType<typeof createFontLoader>
  registry: ReturnType<typeof createTypefaceRegistry>
  pictures: ReturnType<typeof createPictureCache>

  /**
   * Disposes of the FontSystem, releasing all associated resources. After calling this method, the FontSystem should not be used and will throw errors if methods are called. This will delete the FontMgr, clear the typeface registry, and dispose of the picture cache.
   * @returns {void}
   */
  dispose(): void
}

/**
 * Creates a new FontSystem instance from the given CanvasKit and font manifest.
 * The FontSystem provides a set of methods for loading fonts, preparing for text rendering, and creating paragraphs.
 * The FontSystem is responsible for managing the font store, typeface registry, and picture cache.
 * @param {CanvasKit} ck - The CanvasKit instance.
 * @param {FontManifest} manifest - The font manifest object.
 * @returns {Promise<FontSystem>} - A promise that resolves to the created FontSystem instance.
 */
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
    const weight = opts.fontWeight ?? 400
    await prepareForText(text, primaryFamily, weight)
    return makeParagraphSync(text, primaryFamily, opts, maxWidth)
  }

  function makeParagraphSync(
    text: string,
    primaryFamily: string,
    opts: ParagraphOptions,
    maxWidth: number,
  ) {
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
    makeParagraphSync,
    rebuildFontMgr,
    store,
    loader,
    registry,
    pictures,
    dispose,
  }
}
