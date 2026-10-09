// src/components/ui/AnimatedProgressBar.tsx - Stegrad för avtalswizarden
// Horisontell rad med numrerad prick + namn. Klara steg får bock på brandgrön
// prick, aktuellt steg är understruket, steg som inte nåtts är gråa och går
// inte att klicka på. Raden scrollar i sidled på smal skärm.

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
  className?: string
}

export default function AnimatedProgressBar({
  steps,
  currentStep,
  onStepClick,
  maxReachedStep,
  documentType,
  selectedTemplate,
  className = ''
}: AnimatedProgressBarProps) {
  // Dölj steg 3 (avtalspart) för offerter eftersom det väljs automatiskt av mallen
  const visibleSteps = steps.filter(step => !(step.id === 3 && documentType === 'offer' && selectedTemplate))
  const reached = Math.max(maxReachedStep ?? currentStep, currentStep)

  return (
    <nav aria-label="Steg" className={`flex gap-1 overflow-x-auto ${className}`}>
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
            className={`flex items-center gap-2 min-h-[48px] px-3 border-b-2 text-sm whitespace-nowrap transition-colors ${
              isActive
                ? 'border-[#20c58f] font-bold text-white'
                : isReached
                  ? 'border-transparent font-medium text-slate-300 hover:text-white cursor-pointer'
                  : 'border-transparent font-medium text-slate-500 cursor-default'
            }`}
          >
            <span
              className={`w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-bold ${
                isCompleted
                  ? 'bg-[#20c58f] text-[#052e22]'
                  : isActive
                    ? 'bg-white text-slate-950'
                    : 'bg-slate-800 text-slate-500'
              }`}
            >
              {isCompleted ? '✓' : index + 1}
            </span>
            <span>{step.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
