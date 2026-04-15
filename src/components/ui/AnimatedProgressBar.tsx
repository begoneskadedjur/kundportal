// src/components/ui/AnimatedProgressBar.tsx - Förbättrad progress indicator för wizard

import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  id: number
  title: string
  icon: LucideIcon
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

  // Filtrera bort steg som ska hoppas över
  const visibleSteps = steps.filter(step => {
    // Dölj steg 3 (avtalspart) för offerter eftersom det väljs automatiskt
    const shouldSkip = step.id === 3 && documentType === 'offer' && selectedTemplate
    return !shouldSkip
  })

  // Beräkna progress percentage
  const completedSteps = visibleSteps.filter(step => step.id < currentStep).length
  const progressPercentage = (completedSteps / (visibleSteps.length - 1)) * 100

  const stepContent = visibleSteps.map((step, index) => {
    const Icon = step.icon
    const isActive = currentStep === step.id
    const isCompleted = currentStep > step.id
    const isClickable = maxReachedStep !== undefined ? step.id <= maxReachedStep : step.id <= currentStep

    return (
      <motion.div
        key={step.id}
        className="flex flex-col items-center flex-shrink-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        {/* Step Circle */}
        <motion.div
          className={`flex items-center gap-3 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => isClickable && onStepClick(step.id)}
          whileHover={isClickable ? { scale: 1.05 } : {}}
          whileTap={isClickable ? { scale: 0.95 } : {}}
        >
          <motion.div
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative overflow-hidden ${
              isCompleted
                ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/30'
                : isActive
                  ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
            }`}
            animate={{
              boxShadow: isActive
                ? '0 0 20px rgba(59, 130, 246, 0.5)'
                : isCompleted
                  ? '0 0 20px rgba(34, 197, 94, 0.3)'
                  : '0 0 0px rgba(0, 0, 0, 0)'
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Background Pulse Effect for Active Step */}
            {isActive && (
              <motion.div
                className="absolute inset-0 bg-blue-400 rounded-full"
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut"
                }}
              />
            )}

            {/* Icon with Animation */}
            <motion.div
              initial={false}
              animate={{
                rotate: isCompleted ? 360 : 0,
                scale: isActive ? 1.1 : 1
              }}
              transition={{ duration: 0.3 }}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <CheckCircle className="w-5 h-5" />
                </motion.div>
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Step Title + Number */}
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
        >
          <div className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
            isActive
              ? 'text-blue-400'
              : isCompleted
                ? 'text-green-400'
                : 'text-slate-400'
          }`}>
            {step.title}
          </div>

          {/* Step Number */}
          <div className={`text-xs mt-1 ${
            isActive || isCompleted ? 'text-slate-300' : 'text-slate-500'
          }`}>
            Steg {step.id}
          </div>
        </motion.div>
      </motion.div>
    )
  })

  return (
    <div className={`bg-slate-900/30 border-b border-slate-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">

        {/* ── Desktop: fast bredd med progress-linje ── */}
        <div className="relative hidden md:block">
          {/* Background Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700" />

          {/* Animated Progress Line */}
          <motion.div
            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />

          {/* Steps Container */}
          <div className="flex items-start justify-between relative z-10">
            {stepContent}
          </div>
        </div>

        {/* ── Mobil: horisontell scroll ── */}
        <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex items-start gap-3 relative w-max">
            {/* Background connector line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-700" />
            {/* Progress line */}
            <motion.div
              className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-blue-500 to-green-500"
              initial={{ width: 0 }}
              animate={{ width: `calc(${progressPercentage}% - 20px)` }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
            {visibleSteps.map((step) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              const isClickable = maxReachedStep !== undefined ? step.id <= maxReachedStep : step.id <= currentStep

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center flex-shrink-0 w-16 relative z-10"
                  onClick={() => isClickable && onStepClick(step.id)}
                >
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative overflow-hidden ${
                      isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : isActive
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-600 bg-slate-800 text-slate-400'
                    } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    animate={{
                      boxShadow: isActive
                        ? '0 0 16px rgba(59, 130, 246, 0.5)'
                        : isCompleted
                          ? '0 0 12px rgba(34, 197, 94, 0.3)'
                          : 'none'
                    }}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-blue-400 rounded-full"
                        initial={{ scale: 0, opacity: 0.6 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </motion.div>

                  <div className={`mt-1.5 text-center text-xs font-medium leading-tight whitespace-normal break-words w-full text-center ${
                    isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-500'
                  }`}>
                    {step.title}
                  </div>
                  <div className={`text-xs ${isActive || isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                    {step.id}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress Percentage */}
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-sm text-slate-400">
            Framsteg: <span className="text-green-400 font-semibold">{Math.round(progressPercentage)}%</span>
          </div>

          {/* Mobile Progress Bar */}
          <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5 md:hidden">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
