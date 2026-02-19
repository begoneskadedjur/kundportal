import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface GalleryPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  totalImages: number
  onPageChange: (page: number) => void
}

export default function GalleryPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  totalImages,
  onPageChange,
}: GalleryPaginationProps) {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  // Build page numbers with ellipsis
  const pages: (number | string)[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
    }
  }

  return (
    <div className="flex items-center justify-between mt-6 px-4 py-3
                    bg-slate-800/50 border border-slate-700/50 rounded-xl">
      {/* Left: result info */}
      <p className="text-sm text-slate-400">
        Visar <span className="text-white font-medium">{from}–{to}</span> av{' '}
        <span className="text-white font-medium">{totalItems}</span> ärenden
      </p>

      {/* Center: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-30
                     text-slate-400 hover:text-white transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-30
                     text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page, i) =>
          typeof page === 'number' ? (
            <button
              key={i}
              onClick={() => onPageChange(page)}
              className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          ) : (
            <span key={i} className="px-2 text-slate-500">...</span>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-30
                     text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-slate-700 disabled:opacity-30
                     text-slate-400 hover:text-white transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Right: total images */}
      <p className="text-sm text-slate-400">
        <span className="text-white font-medium">{totalImages}</span> bilder totalt
      </p>
    </div>
  )
}
