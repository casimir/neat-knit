import { useRef } from 'react'
import { useStore } from '@/store'

function Swatch({ color, index, size }: { color: string; index: number; size: number }) {
  const store = useStore()
  const active = store.activeSwatch === index
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    if (active) inputRef.current?.click()
    else store.setActiveSwatch(index)
  }

  return (
    <div
      title={active ? 'Click to edit color' : color}
      onClick={handleClick}
      className="cursor-pointer transition-transform hover:scale-110 shrink-0"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color,
        outline: active ? '2px solid var(--jq-text)' : '2px solid transparent',
        outlineOffset: 2,
      }}
    >
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => store.setPaletteColor(index, e.target.value)}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export function SwatchPicker({ size }: { size: number }) {
  const store = useStore()
  const { palette, activeSwatch } = store

  return (
    <div className="flex gap-1 items-center">
      {palette.map((color, i) => (
        <Swatch key={i} color={color} index={i} size={size} />
      ))}
      <div
        title="Eraser"
        onClick={() => store.setActiveSwatch(-1)}
        className="flex items-center justify-center cursor-pointer shrink-0 text-sm"
        style={{
          width: size, height: size, borderRadius: '50%',
          background: 'var(--jq-bg)',
          outline: activeSwatch === -1 ? '2px solid var(--jq-text)' : '2px dashed var(--jq-border)',
          outlineOffset: activeSwatch === -1 ? 2 : -2,
        }}
      >
        ✕
      </div>
    </div>
  )
}
