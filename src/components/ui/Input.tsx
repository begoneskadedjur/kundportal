// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
  as?: 'input' | 'textarea'
  rows?: number
}

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ label, error, helperText, icon, as = 'input', rows = 4, className = '', ...props }, ref) => {
    const baseStyles = `
      w-full px-4 py-2.5 
      bg-slate-900/50 
      border border-slate-700 
      rounded-lg 
      text-white 
      placeholder-slate-500
      focus:outline-none 
      focus:ring-2 
      focus:ring-green-500 
      focus:border-transparent
      transition-all duration-200
      ${error ? 'border-red-500 focus:ring-red-500' : ''}
      ${icon ? 'pl-10' : ''}
      ${className}
    `

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          
          {as === 'textarea' ? (
            <textarea
              ref={ref as any}
              rows={rows}
              className={baseStyles}
              {...(props as any)}
            />
          ) : (
            <input
              ref={ref as any}
              className={baseStyles}
              {...props}
            />
          )}
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-400">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-sm text-slate-500">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input