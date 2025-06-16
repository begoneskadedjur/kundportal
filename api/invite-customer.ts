// api/invite-customer.ts
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY! // Service role key

interface RequestBody {
  email: string
  companyName: string
  redirectUrl?: string
}

interface SuccessResponse {
  success: true
  method: 'invite' | 'reset'
  message: string
  data?: any
}

interface ErrorResponse {
  error: string
  details?: string
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, companyName, redirectUrl }: RequestBody = req.body

    if (!email || !companyName) {
      return res.status(400).json({ error: 'Email and company name are required' })
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Send invitation using custom SMTP
    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        company_name: companyName,
        invited_by: 'admin',
        invitation_date: new Date().toISOString()
      },
      redirectTo: redirectUrl || `${req.headers.origin || 'http://localhost:3000'}/activate-account`
    })

    if (inviteError) {
      console.error('Invitation failed:', inviteError)
      return res.status(500).json({ 
        error: 'Failed to send invitation email',
        details: inviteError.message 
      })
    }

    console.log(`✅ Invitation sent successfully to ${email} for ${companyName}`)

    return res.status(200).json({ 
      success: true, 
      method: 'invite',
      message: 'Invitation sent successfully via custom SMTP',
      data 
    })

  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: (error as Error).message 
    })
  }
}

// Alternative version for Next.js App Router (if using)
// api/invite-customer/route.js
/*
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

export async function POST(request) {
  try {
    const { email, companyName, redirectUrl } = await request.json()

    if (!email || !companyName) {
      return NextResponse.json({ error: 'Email and company name are required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Try invite first, then fallback to reset
    try {
      const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          company_name: companyName,
          invited_by: 'admin'
        },
        redirectTo: redirectUrl || `${request.headers.get('origin')}/activate-account`
      })

      if (inviteError) {
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl || `${request.headers.get('origin')}/activate-account`
        })

        if (resetError) {
          throw new Error(`Email sending failed: ${resetError.message}`)
        }

        return NextResponse.json({ 
          success: true, 
          method: 'reset',
          message: 'Activation link sent' 
        })
      }

      return NextResponse.json({ 
        success: true, 
        method: 'invite',
        message: 'Invitation sent successfully' 
      })

    } catch (emailError) {
      return NextResponse.json({ 
        error: 'Failed to send email',
        details: emailError.message 
      }, { status: 500 })
    }

  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}
*/