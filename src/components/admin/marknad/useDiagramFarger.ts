// Diagramfärger för Marknad och statistiken i Leads (Webb), valda per tema (dataviz-paletten).
// Kategoriplatserna används i fast ordning och följer entiteten, aldrig rangordningen.
import { useTheme } from '../../../contexts/ThemeContext'

const KATEGORI_LJUS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const KATEGORI_MORK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export function useDiagramFarger() {
  const { resolvedTheme } = useTheme()
  const ljust = resolvedTheme === 'light'
  const kategori = ljust ? KATEGORI_LJUS : KATEGORI_MORK
  return {
    ljust,
    brand: '#20c58f',
    serie1: kategori[0]!,
    serie2: kategori[1]!,
    rod: kategori[7]!,
    gul: kategori[3]!,
    /** De åtta kategoriplatserna i fast ordning. */
    kategori,
    /** Dämpad gråton för Övriga och sparklines. */
    dampad: ljust ? '#94a3b8' : '#64748b',
    rutnat: ljust ? '#e2e8f0' : '#334155',
    axel: ljust ? '#64748b' : '#94a3b8',
    yta: ljust ? '#ffffff' : '#1e293b',
  }
}
