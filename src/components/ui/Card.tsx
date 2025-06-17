// src/components/ui/Card.tsx
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`
        glass 
        rounded-xl 
        p-6 
        transition-all 
        duration-200
        ${onClick ? 'cursor-pointer glass-hover' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  )
}