// src/components/shared/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  text?: string
}

export default function LoadingSpinner({ text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700"></div>
        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
      </div>
      {text && <p className="text-slate-300 text-sm">{text}</p>}
    </div>
  )
}
