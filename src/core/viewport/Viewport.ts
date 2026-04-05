export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export class Viewport {
  private state: ViewportState = {
    x: 0,
    y: 0,
    zoom: 1,
  }

  constructor(initialState?: Partial<ViewportState>) {
    if (initialState) {
      this.state = { ...this.state, ...initialState }
    }
  }

  public get x() {
    return this.state.x
  }
  public get y() {
    return this.state.y
  }
  public get zoom() {
    return this.state.zoom
  }

  public setPosition(x: number, y: number) {
    this.state.x = x
    this.state.y = y
  }

  public setZoom(zoom: number) {
    this.state.zoom = Math.max(0.01, Math.min(zoom, 50))
  }

  public translate(dx: number, dy: number) {
    this.state.x += dx
    this.state.y += dy
  }

  /**
   * Converts screen (pixel) coordinates to world (camera-space) coordinates.
   */
  public screenToWorld(clientX: number, clientY: number, canvasRect: DOMRect) {
    const x = clientX - canvasRect.left
    const y = clientY - canvasRect.top
    return {
      x: (x - this.state.x) / this.state.zoom,
      y: (y - this.state.y) / this.state.zoom,
    }
  }

  /**
   * Converts world (camera-space) coordinates back to screen coordinates.
   */
  public worldToScreen(worldX: number, worldY: number, canvasRect: DOMRect) {
    return {
      x: worldX * this.state.zoom + this.state.x + canvasRect.left,
      y: worldY * this.state.zoom + this.state.y + canvasRect.top,
    }
  }

  /**
   * Zooms centering on a specific screen point.
   */
  public zoomAtPoint(zoomDelta: number, clientX: number, clientY: number, canvasRect: DOMRect) {
    const beforeWorld = this.screenToWorld(clientX, clientY, canvasRect)
    const newZoom = this.state.zoom * zoomDelta
    this.setZoom(newZoom)
    const afterWorld = this.screenToWorld(clientX, clientY, canvasRect)

    this.state.x += (afterWorld.x - beforeWorld.x) * this.state.zoom
    this.state.y += (afterWorld.y - beforeWorld.y) * this.state.zoom
  }

  /**
   * Returns the visible world-space bounding box.
   */
  public getVisibleBounds(screenWidth: number, screenHeight: number) {
    const topLeft = this.screenToWorld(0, 0, { left: 0, top: 0 } as DOMRect)
    const bottomRight = this.screenToWorld(screenWidth, screenHeight, {
      left: 0,
      top: 0,
    } as DOMRect)
    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }
}
