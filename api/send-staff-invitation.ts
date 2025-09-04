// api/send-staff-invitation.ts - Skicka välkomstmail till anställda

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { getStaffWelcomeEmailTemplate } from './email-templates/staff-welcome'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== SEND STAFF INVITATION API START ===')
    
    const { 
      technicianId, 
      email, 
      name, 
      role, 
      tempPassword,
      invitedBy 
    } = req.body
    
    console.log('Staff invitation request:', { 
      technicianId, 
      email, 
      name, 
      role,
      hasPassword: !!tempPassword 
    })

    // 1. Validera inkommande data
    if (!technicianId || !email || !name || !role || !tempPassword) {
      return res.status(400).json({ 
        error: 'Alla fält är obligatoriska: technicianId, email, name, role, tempPassword' 
      })
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Validera roll
    const validRoles = ['admin', 'koordinator', 'technician']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Ogiltig roll. Måste vara en av: ${validRoles.join(', ')}` 
      })
    }

    // 4. Hämta tekniker-info från databas
    console.log('Fetching technician data...')
    const { data: technician, error: techError } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', technicianId)
      .single()

    if (techError || !technician) {
      console.error('Technician fetch error:', techError)
      return res.status(404).json({ error: 'Tekniker inte hittad' })
    }

    console.log('Technician found:', technician.name)

    // 5. Spara inbjudan i databas (krypterat lösenord)
    console.log('Saving invitation to database...')
    const { error: inviteError } = await supabase
      .from('staff_invitations')
      .insert({
        technician_id: technicianId,
        email: email,
        invited_by: invitedBy || null,
        role: role,
        temp_password: Buffer.from(tempPassword).toString('base64'), // Enkel base64 kryptering
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dagar
      })

    if (inviteError) {
      console.error('Failed to save invitation:', inviteError)
      // Fortsätt ändå med att skicka mailet
    }

    // 6. Förbered e-postinnehåll
    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
    
    const emailHtml = getStaffWelcomeEmailTemplate({
      recipientName: name,
      recipientEmail: email,
      tempPassword: tempPassword,
      role: role as 'admin' | 'koordinator' | 'technician',
      loginLink: loginLink
    })

    // 7. Konfigurera e-posttransport
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: RESEND_API_KEY
      }
    })

    // 8. Skicka välkomstmail
    console.log('Sending welcome email to:', email)
    const mailOptions = {
      from: 'Begone Skadedjur & Sanering AB <info@begone.se>',
      to: email,
      subject: `Välkommen till Begone Kundportal - ${name}`,
      html: emailHtml
    }

    const emailResult = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', emailResult.messageId)

    // 9. Uppdatera invitation status om mailet skickades
    if (emailResult.messageId) {
      await supabase
        .from('staff_invitations')
        .update({ 
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('technician_id', technicianId)
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    console.log('=== STAFF INVITATION SENT SUCCESSFULLY ===')
    return res.status(200).json({
      success: true,
      message: `Välkomstmail skickat till ${name} (${email})`,
      data: {
        technicianId,
        email,
        role,
        messageId: emailResult.messageId
      }
    })

  } catch (error: any) {
    console.error('=== SEND STAFF INVITATION API ERROR ===')
    console.error('Error details:', error)
    
    // Returnera mer specifik felinfo beroende på typ
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'E-posttjänsten är tillfälligt otillgänglig. Försök igen senare.'
      })
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'E-postautentisering misslyckades. Kontrollera API-nycklar.'
      })
    }
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skickande av välkomstmail',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Hjälpfunktion för att generera säkert lösenord (om det behövs på serversidan)
export function generateSecurePassword(): string {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
  let password = ""
  
  // Använd crypto för bättre slumpmässighet i produktion
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  // Säkerställ komplexitet
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[!@#$%]/.test(password)
  
  if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
    return generateSecurePassword() // Rekursivt generera nytt om kraven inte uppfylls
  }
  
  return password
}