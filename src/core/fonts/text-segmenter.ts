// Splits mixed-script text into runs so each gets the right font family.
// Each segment feeds a separate pushStyle() in ParagraphBuilder.

export interface TextSegment {
  text: string
  family: string
  dir: 'ltr' | 'rtl'
}

const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/

// Very lightweight script detector — extend as needed
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
