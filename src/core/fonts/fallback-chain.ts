import type { FontManifest } from './font-manifest'
import { getFamilyForCodePoint } from './font-manifest'

export interface FallbackResult {
  families: string[] // all families needed for this text
  missing: string[] // families not yet loaded
}

export function resolveFallbacks(
  text: string,
  manifest: FontManifest,
  isLoaded: (family: string) => boolean,
  primaryFamily: string,
): FallbackResult {
  const needed = new Set<string>([primaryFamily])

  for (const char of text) {
    const cp = char.codePointAt(0)
    if (cp === undefined) continue
    const family = getFamilyForCodePoint(manifest, cp)
    if (family) needed.add(family)
  }

  const families = manifest.fallbackChain.filter((f) => needed.has(f))

  // Always include primary even if not in fallbackChain
  if (!families.includes(primaryFamily)) families.unshift(primaryFamily)

  const missing = families.filter((f) => !isLoaded(f))

  return { families, missing }
}
