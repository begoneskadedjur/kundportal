import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, userIds, organizationId } = req.body

  // Verifiera att request kommer från en autentiserad användare
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Verifiera token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Kontrollera användarens behörighet
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, is_koordinator, organization_id, multisite_role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile not found' })
    }

    // Kontrollera behörighet
    const hasPermission = profile.is_admin || 
                         profile.is_koordinator || 
                         (profile.multisite_role === 'verksamhetschef' && profile.organization_id === organizationId)

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    switch (action) {
      case 'getUsersInfo':
        if (!userIds || !Array.isArray(userIds)) {
          return res.status(400).json({ error: 'Invalid userIds' })
        }

        const usersInfo = await Promise.all(userIds.map(async (userId) => {
          try {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
            
            if (!user) {
              return {
                user_id: userId,
                email: null,
                name: null,
                last_sign_in_at: null
              }
            }

            return {
              user_id: userId,
              email: user.email,
              name: user.user_metadata?.name || user.user_metadata?.organization_name || null,
              last_sign_in_at: user.last_sign_in_at
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error)
            return {
              user_id: userId,
              email: null,
              name: null,
              last_sign_in_at: null
            }
          }
        }))

        return res.status(200).json({ users: usersInfo })

      case 'createUser':
        const { email, name, password } = req.body

        if (!email || !name) {
          return res.status(400).json({ error: 'Email and name are required' })
        }

        // Skapa användare
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: password || undefined, // Om inget lösenord skickas, genereras ett
          email_confirm: true,
          user_metadata: {
            name,
            organization_id: organizationId
          }
        })

        if (createError) {
          return res.status(400).json({ error: createError.message })
        }

        return res.status(200).json({ user: newUser })

      case 'deleteUser':
        const { userId } = req.body

        if (!userId) {
          return res.status(400).json({ error: 'userId is required' })
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
          return res.status(400).json({ error: deleteError.message })
        }

        return res.status(200).json({ success: true })

      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error: any) {
    console.error('Error in multisite-users handler:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}