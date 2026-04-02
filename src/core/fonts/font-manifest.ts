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

export function createFontManifest(raw: FontManifest): FontManifest {
  return raw
}

export function getVariant(
  manifest: FontManifest,
  family: string,
  weight = 400,
): FontVariant | undefined {
  return manifest.families[family]?.variants[String(weight)]
}

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

function codePointInRange(cp: number, range: string): boolean {
  // e.g. "U+3040-309F"
  const [start, end] = range
    .replace('U+', '')
    .split('-')
    .map((h) => parseInt(h, 16))
  return cp >= start! && cp <= (end! ?? start)
}
