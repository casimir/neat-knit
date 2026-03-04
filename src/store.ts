import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

export const CELL_SIZES = [8, 12, 16, 20, 24, 32]
const DEFAULT_PALETTE = ['#1a1a1a', '#f5f0e8', '#c0392b', '#2471a3', '#1e8449', '#e67e22', '#8e44ad', '#f1c40f']

// ── RLE helpers ──────────────────────────────────────────────────────────────

function encodeRLE(arr: number[]): string {
  if (!arr.length) return ''
  const runs: string[] = []
  let cur = arr[0], count = 1
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === cur) { count++ }
    else { runs.push(count + ':' + (cur === -1 ? 'e' : cur)); cur = arr[i]; count = 1 }
  }
  runs.push(count + ':' + (cur === -1 ? 'e' : cur))
  return runs.join(';')
}

function decodeRLE(str: string, len: number): number[] {
  if (!str) return new Array(len).fill(-1)
  const arr: number[] = []
  for (const part of str.split(';')) {
    const [c, v] = part.split(':')
    const count = parseInt(c)
    const val = v === 'e' ? -1 : parseInt(v)
    for (let i = 0; i < count; i++) arr.push(val)
  }
  return arr
}

// ── Hash storage ─────────────────────────────────────────────────────────────

const hashStorage: StateStorage = {
  getItem: (key): string => {
    const searchParams = new URLSearchParams(location.hash.slice(1))
    const storedValue = searchParams.get(key) ?? ''
    if (!storedValue) return storedValue
    try {
      const parsed = JSON.parse(storedValue)
      if (parsed?.state?.gridRle != null) {
        parsed.state.grid = decodeRLE(parsed.state.gridRle, parsed.state.cols * parsed.state.rows)
        delete parsed.state.gridRle
      }
      return JSON.stringify(parsed)
    } catch {
      return storedValue
    }
  },
  setItem: (key, newValue): void => {
    const searchParams = new URLSearchParams(location.hash.slice(1))
    try {
      const parsed = JSON.parse(newValue)
      if (parsed?.state?.grid) {
        parsed.state.gridRle = encodeRLE(parsed.state.grid)
        delete parsed.state.grid
      }
      searchParams.set(key, JSON.stringify(parsed))
    } catch {
      searchParams.set(key, newValue)
    }
    location.hash = searchParams.toString()
  },
  removeItem: (key): void => {
    const searchParams = new URLSearchParams(location.hash.slice(1))
    searchParams.delete(key)
    location.hash = searchParams.toString()
  },
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface JacquardState {
  cols: number
  rows: number
  cellSizeIdx: number
  palette: string[]
  activeSwatch: number  // -1 = eraser
  grid: number[]        // flat, -1 = empty
  setActiveSwatch: (i: number) => void
  setPaletteColor: (i: number, color: string) => void
  zoom: (dir: 1 | -1) => void
  resizeGrid: (c: number, r: number) => void
  setGrid: (grid: number[]) => void
  clearGrid: () => void
}

export const useJacquardStore = create<JacquardState>()(
  persist(
    (set, get) => ({
      cols: 30,
      rows: 30,
      cellSizeIdx: 2,
      palette: [...DEFAULT_PALETTE],
      activeSwatch: 0,
      grid: new Array(30 * 30).fill(-1),

      setActiveSwatch: (i) => set({ activeSwatch: i }),

      setPaletteColor: (i, color) => {
        const palette = [...get().palette]
        palette[i] = color
        set({ palette })
      },

      zoom: (dir) => set((s) => ({
        cellSizeIdx: Math.max(0, Math.min(CELL_SIZES.length - 1, s.cellSizeIdx + dir)),
      })),

      resizeGrid: (c, r) => set((s) => {
        const newGrid = new Array(c * r).fill(-1)
        for (let row = 0; row < Math.min(r, s.rows); row++) {
          for (let col = 0; col < Math.min(c, s.cols); col++) {
            newGrid[row * c + col] = s.grid[row * s.cols + col]
          }
        }
        return { cols: c, rows: r, grid: newGrid }
      }),

      setGrid: (grid) => set({ grid }),

      clearGrid: () => set((s) => ({ grid: new Array(s.cols * s.rows).fill(-1) })),
    }),
    {
      name: 'neat-knit',
      storage: createJSONStorage(() => hashStorage),
      partialize: (s) => ({
        cols: s.cols,
        rows: s.rows,
        cellSizeIdx: s.cellSizeIdx,
        palette: s.palette,
        activeSwatch: s.activeSwatch,
        grid: s.grid,
      }),
    }
  )
)
