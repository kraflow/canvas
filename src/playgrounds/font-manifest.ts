export interface FontManifest {
  families: Record<
    string,
    {
      weights: number[]
      variants: Record<
        string,
        {
          url: string
          priority: 'eager' | 'lazy'
        }
      >
      unicodeRanges: string[]
    }
  >
  fallbackChain: string[]
  eagerLoad: string[]
}

export const defaultFontManifest: FontManifest = {
  families: {
    Inter: {
      weights: [400, 600, 700],
      variants: {
        '400': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
          priority: 'eager',
        },
        '600': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf',
          priority: 'lazy',
        },
        '700': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
          priority: 'lazy',
        },
      },
      unicodeRanges: ['U+0000-00FF'],
    },
  },
  fallbackChain: ['Inter'],
  eagerLoad: ['Inter'],
}
