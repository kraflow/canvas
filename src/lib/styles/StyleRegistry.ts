import type { Styles } from './types'

export class StyleRegistry {
  private readonly styles = new Map<string, Styles>()

  registerStyle(id: string, style: Styles, patch = false) {
    if (patch) {
      this.styles.set(id, {
        ...this.styles.get(id),
        ...style,
      })
      return
    }

    this.styles.set(id, style)
  }

  getStyle(name: string) {
    const style = this.styles.get(name)
    if (!style) {
      throw new Error(`Style "${name}" not found`)
    }
    return style
  }

  hasStyle(name: string) {
    return this.styles.has(name)
  }

  getStyles() {
    return this.styles
  }

  deleteStyle(name: string) {
    this.styles.delete(name)
  }

  clear() {
    this.styles.clear()
  }
}
