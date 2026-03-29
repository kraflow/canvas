import type { CanvasKit, Surface, Paint, Canvas, FontMgr } from 'canvaskit-wasm'
import { loadCanvasKit } from '../load'

export class Renderer {
  private ck: CanvasKit | null = null
  private surface: Surface | null = null
  private paint: Paint | null = null
  private fontMgr: FontMgr | null = null
  private initialized = false

  constructor(private readonly canvasEl: HTMLCanvasElement) {}

  async init(width: number, height: number) {
    if (this.initialized) return

    this.ck = await loadCanvasKit()
    this.setCanvasSize(width, height)
    this.createSurface()

    const fontData = await fetch(
      'https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
    ).then((r) => r.arrayBuffer())

    this.fontMgr = this.ck.FontMgr.FromData(fontData)!

    this.paint = new this.ck.Paint()
    this.paint.setColor(this.ck.Color4f(0, 0, 0, 1)) // ✅ Color4f for float alpha
    this.paint.setAntiAlias(true)

    this.initialized = true
  }

  // ---------- Public drawing API ----------

  draw(drawFn: (canvas: Canvas) => void) {
    if (!this.surface || !this.ck) return
    const dpr = window.devicePixelRatio || 1

    this.surface.drawOnce((canvas) => {
      canvas.clear(this.ck!.Color4f(1, 1, 1, 1))
      canvas.save()
      canvas.scale(dpr, dpr) // scale up, draw in logical coords
      drawFn(canvas)
      canvas.restore()
    })
  }

  /**
   * Draws text on the canvas using CanvasKit
   * @internal For Testing Purposes
   */
  drawText(
    canvas: Canvas,
    text: string,
    x: number,
    y: number,
    fontSize = 32,
    color = this.ck!.Color4f(0, 0, 0, 1),
  ) {
    if (!this.ck || !this.fontMgr) return

    const paraStyle = new this.ck.ParagraphStyle({
      textStyle: {
        color,
        fontFamilies: ['Roboto'],
        fontSize,
      },
    })

    const builder = this.ck.ParagraphBuilder.Make(paraStyle, this.fontMgr)
    builder.addText(text)
    const para = builder.build()
    para.layout(1000)
    canvas.drawParagraph(para, x, y)

    para.delete()
    builder.delete()
  }

  // ---------- Resize ----------

  resize(width: number, height: number) {
    if (!this.ck) return
    this.setCanvasSize(width, height)
    this.surface?.dispose()
    this.createSurface()
  }

  // ---------- Helpers ----------

  getCk() {
    return this.ck!
  }

  getPaint() {
    return this.paint!
  }

  getFontMgr() {
    return this.fontMgr!
  }

  // ---------- Internal ----------

  private setCanvasSize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    this.canvasEl.width = width * dpr // physical pixels
    this.canvasEl.height = height * dpr
    this.canvasEl.style.width = width + 'px' // CSS logical size
    this.canvasEl.style.height = height + 'px'
  }

  private createSurface() {
    this.surface =
      this.ck!.MakeWebGLCanvasSurface(this.canvasEl) ?? this.ck!.MakeSWCanvasSurface(this.canvasEl)

    if (!this.surface) throw new Error('Failed to create CanvasKit surface')
  }

  // ---------- Cleanup ----------

  destroy() {
    this.surface?.dispose()
    this.paint?.delete()
    this.fontMgr?.delete()
    this.surface = null
    this.paint = null
    this.fontMgr = null
    this.ck = null
    this.initialized = false
  }
}
