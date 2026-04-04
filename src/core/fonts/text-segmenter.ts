// Splits mixed-script text into runs so each gets the right font family.
// Each segment feeds a separate pushStyle() in ParagraphBuilder.

export interface TextSegment {
  text: string
  family: string
  dir: 'ltr' | 'rtl'
}

// Covers Hebrew, Arabic, Syriac, Thaana, N'Ko, and related RTL scripts
const RTL_REGEX = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/

/**
 * Detects the font family for a given character.
 *
 * Given a character, a font manifest, and a fallback font family, returns
 * the font family that the character should be rendered in.
 *
 * The function works by iterating over each font family in the manifest
 * and checking if the character is within any of the font family's
 * Unicode ranges. If the character is within a range, the function
 * returns the font family. If the character is not within any of the
 * ranges, the function returns the fallback font family.
 *
 * @param {string} char - The character to detect the font family for.
 * @param {Record<string, { unicodeRanges?: string[] }>} manifest - The font manifest.
 * @param {string} fallback - The fallback font family to use if the character is not within any of the ranges.
 * @returns {string} The font family that the character should be rendered in.
 */
function detectFamily(
  char: string,
  manifest: Record<string, { unicodeRanges?: string[] }>,
  fallback: string,
): string {
  const cp = char.codePointAt(0) ?? 0
  for (const [family, def] of Object.entries(manifest)) {
    if (!def.unicodeRanges) continue
    for (const range of def.unicodeRanges) {
      const [s, e] = range
        .replace('U+', '')
        .split('-')
        .map((h) => parseInt(h, 16))
      if (cp >= s! && cp <= (e! ?? s)) return family
    }
  }
  return fallback
}

/**
 * Splits a string into segments of text that should be rendered in a
 * particular font family and direction.
 *
 * This function takes a string of text and a font manifest, and returns an
 * array of TextSegment objects. Each TextSegment object contains the text
 * to be rendered, the font family that the text should be rendered in, and
 * the direction of the text (either 'ltr' or 'rtl').
 *
 * The function works by iterating over each character of the input string,
 * detecting the font family and direction of the character, and grouping
 * characters together into segments of text that should be rendered in the
 * same font family and direction.
 *
 * @param {string} text - The input string to be segmented.
 * @param {Record<string, { unicodeRanges?: string[] }>} manifestFamilies - The font manifest.
 * @param {string} primaryFamily - The primary font family to use when the
 * font family of a character is not found in the manifest.
 * @returns {TextSegment[]} An array of TextSegment objects, each representing a
 * segment of text that should be rendered in a particular font family and
 * direction.
 */
export function segmentText(
  text: string,
  manifestFamilies: Record<string, { unicodeRanges?: string[] }>,
  primaryFamily: string,
): TextSegment[] {
  if (!text.length) return []

  const segments: TextSegment[] = []
  let current: TextSegment | null = null

  for (const char of text) {
    const family = detectFamily(char, manifestFamilies, primaryFamily)
    const dir = RTL_REGEX.test(char) ? 'rtl' : 'ltr'

    if (current && current.family === family && current.dir === dir) {
      current.text += char
    } else {
      if (current) segments.push(current)
      current = { text: char, family, dir }
    }
  }

  if (current) segments.push(current)
  return segments
}
