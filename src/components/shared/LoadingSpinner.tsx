// src/components/shared/LoadingSpinner.tsx
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700"></div>
        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
      </div>
    </div>
  )
}