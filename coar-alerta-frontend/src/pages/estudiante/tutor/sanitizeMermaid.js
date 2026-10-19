const SPECIAL_IN_NODE = /[()[\]{}<>#&;:,/"'\\]/
const BREAKING_IN_LABEL = /["`<>#&]/g

/** Mermaid 12 exige comillas si el texto del nodo tiene paréntesis u otros especiales. */
export function sanitizeMermaidChart(chart) {
  let source = String(chart || '').trim()
  if (!source) return ''
  source = source.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '')
  source = [...source].filter((ch) => {
    const code = ch.codePointAt(0)
    return code > 8 && code !== 0x0b && code !== 0x0c && (code < 0x0e || code > 0x1f) && code !== 0x7f && (code < 0x200b || code > 0x200d) && code !== 0xfeff
  }).join('')
  source = source.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")
  return source.replace(/([A-Za-z_][\w-]*)(\s*)\[([^\]]+)\]/g, (full, id, space, label) => {
    const trimmed = label.trim()
    const quoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    if (quoted) {
      const inner = trimmed.slice(1, -1).replace(BREAKING_IN_LABEL, '')
      if (inner === trimmed.slice(1, -1)) return full
      return `${id}${space}${trimmed[0]}${inner}${trimmed[0]}`
    }
    if (!SPECIAL_IN_NODE.test(trimmed)) return full
    return `${id}${space}["${trimmed.replace(BREAKING_IN_LABEL, '')}"]`
  })
}
