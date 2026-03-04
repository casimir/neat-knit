import '@/App.css'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Share2 } from 'lucide-react'
import { useStore } from './store'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'

export default function App() {
  const store = useStore()
  const { cols, rows, cellSize, palette, activeSwatch } = store

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const localGrid = useRef<number[]>([...store.grid])
  const painting = useRef(false)
  const lastPainted = useRef(-1)
  const pinchRef = useRef<number | null>(null)

  // Fit grid to container on load
  useEffect(() => {
    requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || !rect.width || !rect.height) return
      const PAD = 32  // container p-4 = 16px each side
      const size = Math.floor(Math.min((rect.width - PAD) / cols, (rect.height - PAD) / rows))
      if (size > 0) store.setCellSize(size)
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const [colsInput, setColsInput] = useState(String(cols))
  const [rowsInput, setRowsInput] = useState(String(rows))

  // Keep localGrid in sync when store.grid changes externally (URL restore, clear, resize)
  useEffect(() => {
    localGrid.current = [...store.grid]
  }, [store.grid])

  // Sync input fields when store dims change
  useEffect(() => { setColsInput(String(cols)) }, [cols])
  useEffect(() => { setRowsInput(String(rows)) }, [rows])

  // ── Canvas rendering ───────────────────────────────────────────────────────

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = cols * cellSize
    canvas.height = rows * cellSize
    const ctx = canvas.getContext('2d')!

    // Fill cells
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const pi = localGrid.current[i]
      ctx.fillStyle = pi >= 0 ? palette[pi] : '#f5f0e8'
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    for (let c = 1; c < cols; c++) {
      if (c % 5 === 0) ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      else ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.beginPath()
      ctx.moveTo(c * cellSize + 0.5, 0)
      ctx.lineTo(c * cellSize + 0.5, rows * cellSize)
      ctx.stroke()
    }
    for (let r = 1; r < rows; r++) {
      if (r % 5 === 0) ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      else ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.beginPath()
      ctx.moveTo(0, r * cellSize + 0.5)
      ctx.lineTo(cols * cellSize, r * cellSize + 0.5)
      ctx.stroke()
    }
  }, [cols, rows, cellSize, palette])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  // ── Cell painting ──────────────────────────────────────────────────────────

  const paintCell = useCallback((idx: number) => {
    if (idx < 0 || idx >= localGrid.current.length) return
    if (idx === lastPainted.current) return
    lastPainted.current = idx
    const newVal = activeSwatch === -1 ? -1 : activeSwatch
    if (localGrid.current[idx] === newVal) return
    localGrid.current[idx] = newVal

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const r = Math.floor(idx / cols)
    const c = idx % cols
    ctx.fillStyle = newVal >= 0 ? palette[newVal] : '#f5f0e8'
    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)

    // Redraw grid lines over this cell
    const x = c * cellSize, y = r * cellSize
    if (c > 0) {
      ctx.strokeStyle = c % 5 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'
      ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + cellSize); ctx.stroke()
    }
    if (r > 0) {
      ctx.strokeStyle = r % 5 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'
      ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + cellSize, y + 0.5); ctx.stroke()
    }
    if (c < cols - 1) {
      ctx.strokeStyle = (c + 1) % 5 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'
      ctx.beginPath(); ctx.moveTo(x + cellSize + 0.5, y); ctx.lineTo(x + cellSize + 0.5, y + cellSize); ctx.stroke()
    }
    if (r < rows - 1) {
      ctx.strokeStyle = (r + 1) % 5 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'
      ctx.beginPath(); ctx.moveTo(x, y + cellSize + 0.5); ctx.lineTo(x + cellSize, y + cellSize + 0.5); ctx.stroke()
    }
  }, [activeSwatch, cols, cellSize, palette])

  function idxFromXY(x: number, y: number): number {
    const c = Math.floor(x / cellSize)
    const r = Math.floor(y / cellSize)
    if (c < 0 || c >= cols || r < 0 || r >= rows) return -1
    return r * cols + c
  }

  function commitStroke() {
    painting.current = false
    store.setGrid([...localGrid.current])
  }

  // ── Mouse events ───────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      e.preventDefault()
      painting.current = true
      lastPainted.current = -1
      const rect = canvas!.getBoundingClientRect()
      paintCell(idxFromXY(e.clientX - rect.left, e.clientY - rect.top))
    }
    function onMouseMove(e: MouseEvent) {
      if (!painting.current) return
      const rect = canvas!.getBoundingClientRect()
      paintCell(idxFromXY(e.clientX - rect.left, e.clientY - rect.top))
    }
    function onMouseUp() { if (painting.current) commitStroke() }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      painting.current = true
      lastPainted.current = -1
      const rect = canvas!.getBoundingClientRect()
      const t = e.touches[0]
      paintCell(idxFromXY(t.clientX - rect.left, t.clientY - rect.top))
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const t = e.touches[0]
      paintCell(idxFromXY(t.clientX - rect.left, t.clientY - rect.top))
    }
    function onTouchEnd() { if (painting.current) commitStroke() }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [paintCell])  // paintCell captures activeSwatch, cols, cellSize, palette

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const n = parseInt(e.key)
      if (!isNaN(n) && n >= 1 && n <= palette.length) { store.setActiveSwatch(n - 1); return }
      if (e.key === 'e' || e.key === '0') { store.setActiveSwatch(-1); return }
      if (e.key === '+' || e.key === '=') { store.zoom(1); return }
      if (e.key === '-' || e.key === '_') { store.zoom(-1); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [palette.length, store])

  // ── Actions ────────────────────────────────────────────────────────────────

  function applyDims() {
    const c = Math.max(2, Math.min(200, parseInt(colsInput) || 30))
    const r = Math.max(2, Math.min(200, parseInt(rowsInput) || 30))
    store.resizeGrid(c, r)
  }

  function clearGrid() {
    store.clearGrid()
    toast.success('Canvas cleared')
  }

  function copyUrl() {
    navigator.clipboard.writeText(location.href).then(
      () => toast.success('URL copied to clipboard'),
      () => toast.error('Could not copy — ' + location.href),
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--jq-bg)', color: 'var(--jq-text)' }}>
      {/* Mobile header */}
      <header
        className="flex sm:hidden items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ background: 'var(--jq-surface)', borderColor: 'var(--jq-border)' }}
      >
        <h1 className="flex items-center gap-2 text-xl shrink-0 leading-none" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.02em' }}>
          <img src="icon.svg" alt="" width={24} height={24} className="block" />
          Neat Knit
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="w-8 h-8" onClick={clearGrid} title="Clear canvas"><RotateCcw size={15} /></Button>
          <Button variant="outline" size="icon" className="w-8 h-8" onClick={copyUrl} title="Copy share link"><Share2 size={15} /></Button>
        </div>
      </header>

      {/* Desktop header */}
      <header
        className="hidden sm:flex items-center gap-3 px-4 py-2 border-b flex-wrap"
        style={{ background: 'var(--jq-surface)', borderColor: 'var(--jq-border)' }}
      >
        <h1 className="flex items-center gap-2 shrink-0 text-xl leading-none" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.02em' }}>
          <img src="icon.svg" alt="" width={24} height={24} className="block" />
          Neat Knit
        </h1>

        {/* Palette */}
        <div className="flex gap-1 items-center">
          {palette.map((color, i) => (
            <div
              key={i}
              title={color}
              onClick={() => store.setActiveSwatch(i)}
              className="relative cursor-pointer transition-transform hover:scale-110 shrink-0"
              style={{
                width: 28, height: 28,
                borderRadius: 3,
                background: color,
                border: `2px solid ${activeSwatch === i ? 'var(--jq-text)' : 'transparent'}`,
                transform: activeSwatch === i ? 'scale(1.15)' : undefined,
              }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => store.setPaletteColor(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </div>
          ))}
          {/* Eraser */}
          <div
            title="Eraser"
            onClick={() => store.setActiveSwatch(-1)}
            className="flex items-center justify-center cursor-pointer shrink-0 text-sm"
            style={{
              width: 28, height: 28,
              borderRadius: 3,
              background: 'var(--jq-bg)',
              border: `2px ${activeSwatch === -1 ? 'solid var(--jq-text)' : 'dashed var(--jq-border)'}`,
              transform: activeSwatch === -1 ? 'scale(1.15)' : undefined,
            }}
          >
            ✕
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" style={{ background: 'var(--jq-border)' }} />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => store.zoom(-1)}>−</Button>
          <span className="text-xs w-8 text-center" style={{ color: 'var(--jq-muted)' }}>{cellSize}</span>
          <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => store.zoom(1)}>+</Button>
        </div>

        <Separator orientation="vertical" className="h-6" style={{ background: 'var(--jq-border)' }} />

        {/* Dimensions */}
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--jq-muted)' }}>
          <Input
            type="number" min={2} max={200}
            value={colsInput}
            onChange={(e) => setColsInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyDims()}
            className="w-14 h-7 text-center text-xs px-1"
            style={{ background: 'var(--jq-bg)', borderColor: 'var(--jq-border)', color: 'var(--jq-text)' }}
          />
          <span>×</span>
          <Input
            type="number" min={2} max={200}
            value={rowsInput}
            onChange={(e) => setRowsInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyDims()}
            className="w-14 h-7 text-center text-xs px-1"
            style={{ background: 'var(--jq-bg)', borderColor: 'var(--jq-border)', color: 'var(--jq-text)' }}
          />
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={applyDims}>↵</Button>
        </div>

        <Separator orientation="vertical" className="h-6" style={{ background: 'var(--jq-border)' }} />

        <Button variant="outline" size="icon" className="w-8 h-8" onClick={clearGrid} title="Clear canvas"><RotateCcw size={15} /></Button>
        <Button size="icon" className="w-8 h-8" onClick={copyUrl} title="Copy share link"><Share2 size={15} /></Button>
      </header>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center"
        style={{ touchAction: 'none' }}
        onWheel={(e) => {
          e.preventDefault()
          store.zoom(e.deltaY < 0 ? 1 : -1)
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            pinchRef.current = Math.hypot(dx, dy)
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current !== null) {
            e.preventDefault()
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            const dist = Math.hypot(dx, dy)
            const delta = dist - pinchRef.current
            if (Math.abs(delta) > 30) {
              store.zoom(delta > 0 ? 1 : -1)
              pinchRef.current = dist
            }
          }
        }}
        onTouchEnd={() => { pinchRef.current = null }}
      >
        <canvas
          ref={canvasRef}
          className="border shadow cursor-crosshair touch-none select-none"
          style={{ borderColor: 'var(--jq-border)', display: 'block' }}
        />
      </div>

      {/* Mobile bottom toolbar */}
      <nav
        className="flex sm:hidden items-center gap-2 px-3 py-2 border-t overflow-x-auto shrink-0"
        style={{ background: 'var(--jq-surface)', borderColor: 'var(--jq-border)' }}
      >
        {palette.map((color, i) => (
          <div
            key={i}
            title={color}
            onClick={() => store.setActiveSwatch(i)}
            className="relative cursor-pointer shrink-0"
            style={{
              width: 36, height: 36,
              borderRadius: 4,
              background: color,
              border: `2px solid ${activeSwatch === i ? 'var(--jq-text)' : 'transparent'}`,
              transform: activeSwatch === i ? 'scale(1.1)' : undefined,
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => store.setPaletteColor(i, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
          </div>
        ))}
        <div
          title="Eraser"
          onClick={() => store.setActiveSwatch(-1)}
          className="flex items-center justify-center cursor-pointer shrink-0 text-sm"
          style={{
            width: 36, height: 36,
            borderRadius: 4,
            background: 'var(--jq-bg)',
            border: `2px ${activeSwatch === -1 ? 'solid var(--jq-text)' : 'dashed var(--jq-border)'}`,
            transform: activeSwatch === -1 ? 'scale(1.1)' : undefined,
          }}
        >
          ✕
        </div>

        <Separator orientation="vertical" className="h-6 shrink-0" style={{ background: 'var(--jq-border)' }} />

        <Button variant="outline" size="icon" className="w-9 h-9 shrink-0" onClick={() => store.zoom(-1)}>−</Button>
        <span className="text-xs w-8 text-center shrink-0" style={{ color: 'var(--jq-muted)' }}>{cellSize}</span>
        <Button variant="outline" size="icon" className="w-9 h-9 shrink-0" onClick={() => store.zoom(1)}>+</Button>

        <Separator orientation="vertical" className="h-6 shrink-0" style={{ background: 'var(--jq-border)' }} />

        <Input
          type="number" min={2} max={200}
          value={colsInput}
          onChange={(e) => setColsInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyDims()}
          className="w-14 h-9 text-center text-xs px-1 shrink-0"
          style={{ background: 'var(--jq-bg)', borderColor: 'var(--jq-border)', color: 'var(--jq-text)' }}
        />
        <span className="text-xs shrink-0" style={{ color: 'var(--jq-muted)' }}>×</span>
        <Input
          type="number" min={2} max={200}
          value={rowsInput}
          onChange={(e) => setRowsInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyDims()}
          className="w-14 h-9 text-center text-xs px-1 shrink-0"
          style={{ background: 'var(--jq-bg)', borderColor: 'var(--jq-border)', color: 'var(--jq-text)' }}
        />
        <Button variant="outline" size="sm" className="h-9 px-2 text-xs shrink-0" onClick={applyDims}>↵</Button>
      </nav>

    </div>
  )
}
