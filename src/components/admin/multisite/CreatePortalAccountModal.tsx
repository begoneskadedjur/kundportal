import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Key, Mail, User, Loader2, Send, RefreshCw } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'
import toast from 'react-hot-toast'

interface CreatePortalAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organization: {
    id: string
    name: string
    billing_email: string
    contact_person?: string
    contact_email?: string
    contact_phone?: string
    primary_contact_email?: string
  }
}

export default function CreatePortalAccountModal({
  isOpen,
  onClose,
  onSuccess,
  organization
}: CreatePortalAccountModalProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(false)

  const email = organization.contact_email || organization.primary_contact_email || organization.billing_email

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setShowPassword(false)
      setSendEmail(false)
    }
  }, [isOpen])

  const generatePassword = () => {
    const generated = crypto.randomUUID().slice(0, 12) + 'A1!'
    setPassword(generated)
    setShowPassword(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Lösenordet måste vara minst 6 tecken')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: organization.name,
          contact_person: organization.contact_person,
          contact_email: email,
          contact_phone: organization.contact_phone,
          customer_id: organization.id,
          skip_customer_creation: true,
          send_email: sendEmail,
          password
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte skapa portalkonto')
      }

      toast.success(
        sendEmail
          ? `Portalkonto skapat och inbjudan skickad till ${email}`
          : `Portalkonto skapat för ${organization.name} (ingen inbjudan skickad)`
      )
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating portal account:', error)
      toast.error(error.message || 'Kunde inte skapa portalkonto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Skapa portalkonto"
      size="md"
      footer={
        <div className="flex justify-end gap-3 px-4 py-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || password.length < 6}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {sendEmail ? 'Skapa konto och bjud in' : 'Skapa konto'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Kund-info */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">{organization.name}</span>
          </div>
          <p className="text-xs text-slate-400">
            Kontot skapas för denna kund med angett lösenord.
          </p>
        </div>

        {/* E-post (readonly) */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            E-postadress
          </label>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
            <Mail className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-300">{email}</span>
          </div>
        </div>

        {/* Lösenord */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            Lösenord (min 6 tecken)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ange lösenord..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={generatePassword}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Generera
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <p className="text-xs text-red-400 mt-1">Minst 6 tecken krävs</p>
          )}
        </div>

        {/* E-post toggle */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
            />
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-white">Skicka inbjudan via e-post</p>
                <p className="text-xs text-slate-400">
                  {sendEmail
                    ? 'Kunden får ett mail med inloggningsuppgifter'
                    : 'Kontot skapas utan att skicka e-post (du kan bjuda in senare)'}
                </p>
              </div>
            </div>
          </label>
        </div>
      </form>
    </Modal>
  )
}
