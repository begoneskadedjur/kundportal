// Diagramfärger för sidan Marknad, valda per tema (dataviz-paletten, kategoriplats 1, 2, 4 och 8).
import { useTheme } from '../../../contexts/ThemeContext'

export function useDiagramFarger() {
  const { resolvedTheme } = useTheme()
  const ljust = resolvedTheme === 'light'
  return {
    brand: '#20c58f',
    serie1: ljust ? '#2a78d6' : '#3987e5',
    serie2: ljust ? '#eb6834' : '#d95926',
    rod: ljust ? '#e34948' : '#e66767',
    gul: ljust ? '#eda100' : '#c98500',
    rutnat: ljust ? '#e2e8f0' : '#334155',
    axel: ljust ? '#64748b' : '#94a3b8',
    yta: ljust ? '#ffffff' : '#1e293b',
  }
}
