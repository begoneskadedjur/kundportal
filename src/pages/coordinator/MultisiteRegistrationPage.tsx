import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MultisiteRegistrationWizard from '../../components/admin/multisite/MultisiteRegistrationWizard'

export default function MultisiteRegistrationPage() {
  const [isOpen, setIsOpen] = useState(true)
  const navigate = useNavigate()

  const handleClose = () => {
    setIsOpen(false)
    // Navigera tillbaka till organisationshantering
    navigate('/koordinator/multisite/organizations')
  }

  const handleSuccess = () => {
    setIsOpen(false)
    // Navigera tillbaka till organisationshantering efter framgångsrik registrering
    navigate('/koordinator/multisite/organizations')
  }

  // Om användaren trycker escape eller navigerar bort utan att stänga modalen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      <MultisiteRegistrationWizard
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  )
}