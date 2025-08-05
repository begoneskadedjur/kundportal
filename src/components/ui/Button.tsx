// src/components/ui/Button.tsx
import { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950'
  
  const variants = {
    primary: 'bg-[#20c58f] text-white hover:bg-[#1ba876] focus:ring-[#20c58f] disabled:bg-[#20c58f]/50 transition-colors duration-200',
    secondary: 'glass glass-hover text-white focus:ring-[#20c58f] transition-colors duration-200',
    outline: 'border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white focus:ring-[#20c58f] transition-colors duration-200',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 disabled:bg-red-500/50 transition-colors duration-200',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/10 focus:ring-slate-500 transition-colors duration-200'
  }

  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3'
  }

  const widthClass = fullWidth ? 'w-full' : ''

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${widthClass}
        ${loading || disabled ? 'cursor-not-allowed opacity-60' : ''}
        ${className}
      `}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  )
}