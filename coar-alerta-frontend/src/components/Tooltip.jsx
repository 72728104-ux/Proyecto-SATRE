import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Tooltip por hover/foco. Se porta al body para no recortarse en tablas u overflow.
 */
export default function Tooltip({ content, children }) {
  const tooltipId = useId()
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, above: false })

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const gap = 8
    const above = window.innerHeight - rect.bottom < 140
    setPos({
      top: above ? rect.top - gap : rect.bottom + gap,
      left: Math.min(Math.max(rect.left + rect.width / 2, 168), window.innerWidth - 168),
      above,
    })
    setOpen(true)
  }

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              data-cy="criterion-tooltip"
              className={`pointer-events-none fixed z-[80] w-max max-w-xs -translate-x-1/2 whitespace-pre-line rounded-lg bg-navy-950 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg ${pos.above ? '-translate-y-full' : ''}`}
              style={{ top: pos.top, left: pos.left }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}
