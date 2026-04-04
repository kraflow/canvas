import { describe, it, expect, vi } from 'vitest'
import { SceneGraph } from './scene-graph'
import type { FontSystem } from '../fonts'
import type { CanvasKit } from 'canvaskit-wasm'

vi.mock('yoga-layout/load', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    loadYoga: async () => ({
      Node: {
        create: () => ({
          setFlexDirection: vi.fn(),
          setFlexWrap: vi.fn(),
          setJustifyContent: vi.fn(),
          setAlignItems: vi.fn(),
          setAlignContent: vi.fn(),
          setAlignSelf: vi.fn(),
          setFlex: vi.fn(),
          setFlexGrow: vi.fn(),
          setFlexShrink: vi.fn(),
          setFlexBasis: vi.fn(),
          setFlexBasisPercent: vi.fn(),
          setMargin: vi.fn(),
          setMarginPercent: vi.fn(),
          setPadding: vi.fn(),
          setPaddingPercent: vi.fn(),
          setBorder: vi.fn(),
          setPositionType: vi.fn(),
          setPosition: vi.fn(),
          setPositionPercent: vi.fn(),
          setWidth: vi.fn(),
          setWidthPercent: vi.fn(),
          setHeight: vi.fn(),
          setHeightPercent: vi.fn(),
          setMinWidth: vi.fn(),
          setMinWidthPercent: vi.fn(),
          setMaxWidth: vi.fn(),
          setMaxWidthPercent: vi.fn(),
          setMinHeight: vi.fn(),
          setMinHeightPercent: vi.fn(),
          setMaxHeight: vi.fn(),
          setMaxHeightPercent: vi.fn(),
          setAspectRatio: vi.fn(),
          setOverflow: vi.fn(),
          setDisplay: vi.fn(),
          setDirection: vi.fn(),
          setGap: vi.fn(),
          setIsolation: vi.fn(),
          setBoxSizing: vi.fn(),
          insertChild: vi.fn(),
          removeChild: vi.fn(),
          getChildCount: () => 0,
          getChild: vi.fn(),
          calculateLayout: vi.fn(),
          getComputedLayout: () => ({ left: 0, top: 0, width: 100, height: 100 }),
          freeRecursive: vi.fn(),
          markDirty: vi.fn(),
          setMeasureFunc: vi.fn(),
        }),
      },
    }),
  }
})

describe('SceneGraph Serialization', () => {
  it('should export and import a project correctly', async () => {
    // 1. Setup mock SceneGraph
    const ck = {} as unknown as CanvasKit
    const fonts = { makeParagraphSync: vi.fn() } as unknown as FontSystem
    const graph = await SceneGraph.create(ck, fonts)

    // 2. Create a test tree
    const screen = graph.addScreen('main', 10, 20, 800, 600)
    // Use a numeric color or assume the mock handles it
    const viewNode = graph.createNode('view', { backgroundColor: [1, 0, 0, 1] })
    const textNode = graph.createNode('text', { fontSize: 16 })
    graph.setText(textNode, 'Hello')

    graph.appendChild(screen.root, viewNode)
    graph.appendChild(viewNode, textNode)

    // 3. Export to JSON-ready object
    const serialized = graph.exportProject()

    expect(serialized.screens).toHaveLength(1)
    expect(serialized.screens[0]?.id).toBe('main')
    expect(serialized.screens[0]?.root.children).toHaveLength(1)
    expect(serialized.screens[0]?.root.children[0]?.type).toBe('view')

    // 4. Import back into the same graph (clears previous state)
    await graph.importProject(serialized)

    // 5. Verify structure was rebuilt
    const allScreens = Array.from(graph.allScreens)
    expect(allScreens).toHaveLength(1)
    expect(allScreens[0]?.id).toBe('main')

    const root = allScreens[0]?.root
    expect(root?.children).toHaveLength(1)
    expect(root?.children[0]?.type).toBe('view')
    expect(root?.children[0]?.children[0]?.type).toBe('text')
    expect(root?.children[0]?.children[0]?.text).toBe('Hello')
  })
})
