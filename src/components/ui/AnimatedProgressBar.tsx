// src/components/ui/AnimatedProgressBar.tsx - Stegrad för avtalswizarden
// Ligger i wizardens mörka band och är mörk i BÅDA temana, därför hårdkodade
// hex-färger i stället för slate/white (som remappas i ljust läge).
// Klar = grön prick med bock, aktuell = vit prick med grön ring och grön
// underlinje, ej nådd = ihålig prick. Raden scrollar i sidled på smal skärm,
// och under den ligger en 3 px förloppslinje.

interface Step {
  id: number
  title: string
}

interface AnimatedProgressBarProps {
  steps: Step[]
  currentStep: number
  onStepClick: (stepId: number) => void
  maxReachedStep?: number
  documentType: string
  selectedTemplate: string
  /** Förloppet i procent (0–100) för linjen under raden. */
  procent?: number
  className?: string
}

function Bock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export default function AnimatedProgressBar({
  steps,
  currentStep,
  onStepClick,
  maxReachedStep,
  documentType,
  selectedTemplate,
  procent,
  className = ''
}: AnimatedProgressBarProps) {
  // Dölj steg 3 (avtalspart) för offerter eftersom det väljs automatiskt av mallen
  const visibleSteps = steps.filter(step => !(step.id === 3 && documentType === 'offer' && selectedTemplate))
  const reached = Math.max(maxReachedStep ?? currentStep, currentStep)

  return (
    <div className={`flex flex-col ${className}`}>
      <nav aria-label="Steg" className="flex gap-0.5 overflow-x-auto">
        {visibleSteps.map((step, index) => {
          const isActive = step.id === currentStep
          const isCompleted = step.id < currentStep
          const isClickable = step.id <= reached && !isActive
          const isReached = step.id <= reached
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isReached}
              aria-current={isActive ? 'step' : undefined}
              className={`flex items-center gap-2.5 min-h-[50px] px-3.5 -mb-[3px] border-b-[3px] text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#20c58f] font-bold text-[#fff]'
                  : isReached
                    ? 'border-transparent font-medium text-[#c9d6e2] hover:text-[#fff] cursor-pointer'
                    : 'border-transparent font-medium text-[#5f7489] cursor-default'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted
                    ? 'bg-[#20c58f] text-[#052e22]'
                    : isActive
                      ? 'bg-[#fff] text-[#0e1c2b] shadow-[0_0_0_4px_rgba(32,197,143,0.35)]'
                      : 'bg-transparent text-[#5f7489] shadow-[inset_0_0_0_1.5px_#34495e]'
                }`}
              >
                {isCompleted ? <Bock /> : index + 1}
              </span>
              <span>{step.title}</span>
            </button>
          )
        })}
      </nav>
      {procent !== undefined && (
        <div className="h-[3px] bg-[#1d2f42] rounded-full overflow-hidden" aria-hidden="true">
          <div className="h-[3px] bg-[#20c58f] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(100, procent))}%` }} />
        </div>
      )}
    </div>
  )
}
