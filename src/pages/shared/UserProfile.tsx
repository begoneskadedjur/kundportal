import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { PageHeader } from '../../components/shared'
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Save, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle,
  Building2,
  Shield,
  Calendar,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  
  // Profildata
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [roleType, setRoleType] = useState('')
  
  // Lösenordsdata
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Flagga för första inloggning
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [user])

  const loadUserData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Hämta användardata
      const { data: userData } = await supabase.auth.getUser()
      
      // Kolla om det är första inloggningen (temporärt lösenord)
      const firstLogin = userData?.user?.user_metadata?.temp_password === true || 
                        userData?.user?.user_metadata?.must_change_password === true
      
      setIsFirstLogin(firstLogin)
      setMustChangePassword(firstLogin)
      
      // Hämta profil från profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      // Sätt användardata
      setEmail(user.email || '')
      setDisplayName(profileData?.display_name || userData?.user?.user_metadata?.name || '')
      setPhone(userData?.user?.user_metadata?.phone || '')
      
      // Hämta organisation och roll om användaren tillhör en multisite-organisation
      if (profileData?.organization_id) {
        const { data: orgData } = await supabase
          .from('customers')
          .select('company_name')
          .eq('organization_id', profileData.organization_id)
          .eq('site_type', 'huvudkontor')
          .single()
        
        if (orgData) {
          setOrganizationName(orgData.company_name)
        }
        
        // Hämta roll från multisite_user_roles
        const { data: roleData } = await supabase
          .from('multisite_user_roles')
          .select('role_type')
          .eq('user_id', user.id)
          .eq('organization_id', profileData.organization_id)
          .single()
        
        if (roleData) {
          setRoleType(getRoleName(roleData.role_type))
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      toast.error('Kunde inte ladda användardata')
    } finally {
      setLoading(false)
    }
  }

  const getRoleName = (roleType: string) => {
    const roleNames: Record<string, string> = {
      'verksamhetschef': 'Verksamhetschef',
      'regionchef': 'Regionchef',
      'platsansvarig': 'Platsansvarig',
      'admin': 'Administratör',
      'koordinator': 'Koordinator',
      'technician': 'Tekniker',
      'customer': 'Kund'
    }
    return roleNames[roleType] || roleType
  }

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Lösenordet måste vara minst 8 tecken'
    }
    if (!/[A-Z]/.test(password)) {
      return 'Lösenordet måste innehålla minst en stor bokstav'
    }
    if (!/[a-z]/.test(password)) {
      return 'Lösenordet måste innehålla minst en liten bokstav'
    }
    if (!/[0-9]/.test(password)) {
      return 'Lösenordet måste innehålla minst en siffra'
    }
    return null
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!displayName || !email) {
      toast.error('Namn och e-post är obligatoriska')
      return
    }
    
    setSavingProfile(true)
    try {
      // Uppdatera auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        email: email,
        data: {
          name: displayName,
          phone: phone
        }
      })
      
      if (authError) throw authError
      
      // Uppdatera profiles-tabellen
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)
      
      if (profileError) throw profileError
      
      toast.success('Profil uppdaterad!')
      
      // Om e-post ändrades, informera om verifiering
      if (email !== user?.email) {
        toast('En bekräftelse har skickats till din nya e-postadress', {
          icon: '📧',
          duration: 5000
        })
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Kunde inte uppdatera profil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validera nytt lösenord
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }
    
    // Kontrollera att lösenorden matchar
    if (newPassword !== confirmPassword) {
      toast.error('Lösenorden matchar inte')
      return
    }
    
    // Vid första inloggning behövs inte nuvarande lösenord
    if (!isFirstLogin && !currentPassword) {
      toast.error('Ange ditt nuvarande lösenord')
      return
    }
    
    setSavingPassword(true)
    try {
      if (!isFirstLogin) {
        // Verifiera nuvarande lösenord först
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword
        })
        
        if (signInError) {
          throw new Error('Felaktigt nuvarande lösenord')
        }
      }
      
      // Uppdatera lösenord
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      
      // Ta bort flaggan för temporärt lösenord
      if (isFirstLogin) {
        await supabase.auth.updateUser({
          data: {
            temp_password: false,
            must_change_password: false
          }
        })
        setIsFirstLogin(false)
        setMustChangePassword(false)
      }
      
      toast.success('Lösenord uppdaterat!')
      
      // Rensa formulär
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Om det var första inloggningen, navigera till dashboard
      if (isFirstLogin) {
        const dashboardPath = profile?.role === 'admin' ? '/admin/dashboard' : 
                            profile?.role === 'koordinator' ? '/koordinator/dashboard' :
                            profile?.role === 'technician' ? '/technician/dashboard' :
                            '/customer/dashboard'
        navigate(dashboardPath)
      }
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast.error(error.message || 'Kunde inte uppdatera lösenord')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Min profil" 
          description="Hantera dina kontouppgifter och inställningar"
        />

        {/* Varning vid första inloggning */}
        {mustChangePassword && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/10">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-amber-400 mb-1">
                    Byt lösenord för att fortsätta
                  </h3>
                  <p className="text-amber-200/80">
                    Du använder ett temporärt lösenord. Av säkerhetsskäl måste du skapa ett eget lösenord innan du kan fortsätta.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profilinformation */}
          <Card>
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                Profilinformation
              </h2>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Namn
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="För- och efternamn"
                  required
                  disabled={mustChangePassword}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  E-postadress
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din.email@exempel.se"
                  required
                  disabled={mustChangePassword}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Telefonnummer
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+46 70 123 45 67"
                  disabled={mustChangePassword}
                />
              </div>

              {organizationName && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2" />
                    Organisation
                  </label>
                  <Input
                    type="text"
                    value={organizationName}
                    disabled
                    className="bg-slate-800 text-slate-400"
                  />
                </div>
              )}

              {roleType && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Shield className="w-4 h-4 inline mr-2" />
                    Roll
                  </label>
                  <Input
                    type="text"
                    value={roleType}
                    disabled
                    className="bg-slate-800 text-slate-400"
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={savingProfile || mustChangePassword}
                className="w-full flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sparar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Spara ändringar
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Byt lösenord */}
          <Card className={mustChangePassword ? 'ring-2 ring-amber-500' : ''}>
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" />
                Byt lösenord
                {mustChangePassword && (
                  <span className="text-sm text-amber-400 ml-auto">Obligatoriskt</span>
                )}
              </h2>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              {!isFirstLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nuvarande lösenord
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      required={!isFirstLogin}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nytt lösenord
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minst 8 tecken"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bekräfta nytt lösenord
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Upprepa lösenordet"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lösenordskrav */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-300 mb-2">Lösenordskrav:</p>
                <ul className="space-y-1 text-sm">
                  <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                    <CheckCircle className="w-4 h-4" />
                    Minst 8 tecken
                  </li>
                  <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                    <CheckCircle className="w-4 h-4" />
                    Minst en stor bokstav
                  </li>
                  <li className={`flex items-center gap-2 ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                    <CheckCircle className="w-4 h-4" />
                    Minst en liten bokstav
                  </li>
                  <li className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                    <CheckCircle className="w-4 h-4" />
                    Minst en siffra
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                variant={mustChangePassword ? "primary" : "secondary"}
                disabled={savingPassword}
                className="w-full flex items-center justify-center gap-2"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uppdaterar...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    {mustChangePassword ? 'Skapa nytt lösenord' : 'Byt lösenord'}
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Kontoinformation */}
        <Card className="mt-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Kontoinformation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Konto-ID:</span>
                <p className="text-white font-mono">{user?.id}</p>
              </div>
              <div>
                <span className="text-slate-400">Medlem sedan:</span>
                <p className="text-white">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('sv-SE') : 'Okänt'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}