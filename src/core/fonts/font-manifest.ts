export type FontPriority = 'eager' | 'lazy' | 'on-demand'

export interface FontVariant {
  url: string
  priority: FontPriority
}

export interface FontFamily {
  weights: number[]
  variants: Record<string, FontVariant> // key = weight string e.g. "400"
  unicodeRanges?: string[]
}

export interface FontManifest {
  families: Record<string, FontFamily>
  fallbackChain: string[]
  eagerLoad: string[]
}

/**
 * Given a font manifest, family name, and weight, returns the corresponding
 * FontVariant or undefined if not found.
 *
 * @param {FontManifest} manifest - The font manifest object.
 * @param {string} family - The name of the font family.
 * @param {number} [weight=400] - The weight of the desired font variant.
 * @returns {FontVariant|undefined} The corresponding FontVariant or undefined.
 */
export function getVariant(
  manifest: FontManifest,
  family: string,
  weight = 400,
): FontVariant | undefined {
  return manifest.families[family]?.variants[String(weight)]
}

/**
 * Returns an array of objects containing the family name, weight string, and URL for all 'eager' font variants in the given font manifest.
 *
 * @param {FontManifest} manifest - The font manifest object.
 * @returns {Array<{ family: string; weight: string; url: string }>} - An array of objects containing the family name, weight string, and URL for all 'eager' font variants.
 */
export function getEagerEntries(
  manifest: FontManifest,
): Array<{ family: string; weight: string; url: string }> {
  const entries: Array<{ family: string; weight: string; url: string }> = []
  for (const family of manifest.eagerLoad) {
    const def = manifest.families[family]
    if (!def) continue
    for (const [weight, variant] of Object.entries(def.variants)) {
      if (variant.priority === 'eager') {
        entries.push({ family, weight, url: variant.url })
      }
    }
  }
  return entries
}

/**
 * Given a font manifest and a code point, returns the name of the font family
 * that contains the given code point, or undefined if not found.
 *
 * @param {FontManifest} manifest - The font manifest object.
 * @param {number} codePoint - The code point to search for.
 * @returns {string|undefined} The name of the font family containing the code point,
 * or undefined if not found.
 */
export function getFamilyForCodePoint(
  manifest: FontManifest,
  codePoint: number,
): string | undefined {
  for (const [family, def] of Object.entries(manifest.families)) {
    if (!def.unicodeRanges) continue
    for (const range of def.unicodeRanges) {
      if (codePointInRange(codePoint, range)) return family
    }
  }
  return undefined
}

/**
 * Checks if a given code point is within a specified Unicode range.
 *
 * The range should be specified in the format "U+XXXX-YYYY", where XXXX is the
 * starting code point and YYYY is the ending code point (inclusive).
 *
 * If the range does not specify an end code point (i.e. the range is "U+XXXX"),
 * then the function will return true if the code point is equal to the start code
 * point.
 *
 * @param {number} cp - The code point to check.
 * @param {string} range - The Unicode range to check against.
 * @returns {boolean} True if the code point is within the specified range, false otherwise.
 */
function codePointInRange(cp: number, range: string): boolean {
  // e.g. "U+3040-309F"
  const [start, end] = range
    .replace('U+', '')
    .split('-')
    .map((h) => parseInt(h, 16))
  return cp >= start! && cp <= (end! ?? start)
}
