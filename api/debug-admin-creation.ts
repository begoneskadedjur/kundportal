// api/debug-admin-creation.ts - DEBUG ENDPOINT för att isolera admin creation problem
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const debugResults = {
    timestamp: new Date().toISOString(),
    steps: [],
    finalStatus: 'unknown',
    error: null
  }

  try {
    const { testEmail = 'test-admin@begone.se' } = req.body
    
    console.log('🚀 DEBUG ADMIN CREATION STARTING')
    debugResults.steps.push(`Starting debug with test email: ${testEmail}`)

    // STEG 1: Kontrollera Supabase-anslutning
    console.log('🔍 Step 1: Testing Supabase connection...')
    try {
      const { data: healthCheck } = await supabaseAdmin.from('technicians').select('count').limit(1)
      debugResults.steps.push('✅ Supabase connection OK')
      console.log('✅ Supabase connection OK')
    } catch (connError) {
      debugResults.steps.push(`❌ Supabase connection failed: ${connError}`)
      console.error('❌ Supabase connection failed:', connError)
    }

    // STEG 2: Kontrollera om test admin technician finns
    console.log('🔍 Step 2: Checking if test admin technician exists...')
    const { data: testTechnician, error: techError } = await supabaseAdmin
      .from('technicians')
      .select('*')
      .eq('id', 'e0747c15-f47a-47ea-8385-fe59a049a75a') // Kristian Admin ID
      .single()

    if (techError || !testTechnician) {
      debugResults.steps.push(`❌ Test technician not found: ${techError?.message}`)
      console.error('❌ Test technician not found:', techError)
    } else {
      debugResults.steps.push(`✅ Test technician found: ${testTechnician.name} (role: ${testTechnician.role})`)
      console.log('✅ Test technician found:', testTechnician.name, 'role:', testTechnician.role)
    }

    // STEG 3: Kontrollera befintliga auth användare
    console.log('🔍 Step 3: Checking existing auth users for email conflicts...')
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      debugResults.steps.push(`⚠️ Could not list auth users: ${listError.message}`)
      console.warn('Could not list auth users:', listError)
    } else {
      const existingUser = existingUsers.users.find(u => u.email === testEmail)
      if (existingUser) {
        debugResults.steps.push(`🚨 Email ${testEmail} already exists in auth.users: ${existingUser.id}`)
        console.error('Email already exists:', existingUser.id)
      } else {
        debugResults.steps.push(`✅ Email ${testEmail} is unique in auth system`)
        console.log('✅ Email is unique')
      }
    }

    // STEG 4: Kontrollera profiles för duplicates
    console.log('🔍 Step 4: Checking profiles table for conflicts...')
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('technician_id', 'e0747c15-f47a-47ea-8385-fe59a049a75a')
      .single()

    if (existingProfile) {
      debugResults.steps.push(`🚨 Profile already exists for technician: ${JSON.stringify(existingProfile)}`)
      console.error('Profile already exists:', existingProfile)
    } else {
      debugResults.steps.push('✅ No existing profile for technician')
      console.log('✅ No existing profile')
    }

    // STEG 5: Testa constraint-logik manuellt
    console.log('🔍 Step 5: Testing constraint logic manually...')
    const constraintTest = await supabaseAdmin.rpc('sql', {
      query: `
        SELECT 
          CASE 
            WHEN (NULL IS NULL) AND (NULL IS NULL) AND ('admin' = 'admin') 
            THEN 'CONSTRAINT SATISFIED'
            ELSE 'CONSTRAINT VIOLATED'
          END as admin_constraint_check
      `
    })
    debugResults.steps.push(`Constraint test result: ${JSON.stringify(constraintTest)}`)

    // STEG 6: Försök skapa minimal auth user för test
    console.log('🔍 Step 6: Attempting minimal auth user creation...')
    
    const testUserMetadata = {
      display_name: 'Debug Test Admin',
      role: 'admin',
      technician_id: 'e0747c15-f47a-47ea-8385-fe59a049a75a',
      technician_name: 'Kristian Admin'
    }

    debugResults.steps.push(`Attempting to create user with metadata: ${JSON.stringify(testUserMetadata)}`)

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'TempDebugPassword123!',
      email_confirm: true,
      user_metadata: testUserMetadata
    })

    if (createError) {
      debugResults.steps.push(`❌ User creation failed: ${createError.message}`)
      debugResults.steps.push(`Error details: ${JSON.stringify({
        name: createError.name,
        code: createError.code,
        status: createError.status,
        message: createError.message
      })}`)
      debugResults.error = createError
      debugResults.finalStatus = 'failed'
      
      console.error('❌ User creation failed:', createError)
      console.error('Full error:', JSON.stringify(createError, null, 2))
    } else {
      debugResults.steps.push(`✅ User created successfully: ${newUser.user.id}`)
      debugResults.finalStatus = 'success'
      console.log('✅ User created:', newUser.user.id)

      // Vänta och kontrollera om profil skapades
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: createdProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', newUser.user.id)
        .single()

      if (createdProfile) {
        debugResults.steps.push(`✅ Profile created by trigger: ${JSON.stringify(createdProfile)}`)
        console.log('✅ Profile created:', createdProfile)
      } else {
        debugResults.steps.push('⚠️ Profile not created by trigger')
        console.warn('Profile not created by trigger')
      }

      // Cleanup: Ta bort test-användaren
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      debugResults.steps.push('🗑️ Test user cleaned up')
    }

    return res.status(200).json({
      success: debugResults.finalStatus === 'success',
      debug: debugResults
    })

  } catch (error: any) {
    console.error('🚨 DEBUG ENDPOINT ERROR:', error)
    debugResults.error = error.message
    debugResults.finalStatus = 'error'
    debugResults.steps.push(`❌ Unexpected error: ${error.message}`)
    
    return res.status(500).json({
      success: false,
      debug: debugResults,
      error: error.message
    })
  }
}