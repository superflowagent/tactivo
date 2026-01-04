import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local explicitly (team stores secrets there)
dotenv.config({ path: '.env.local' })

// basic presence checks (do not log secrets)
console.log('env loaded ->', {
  hasUrl: !!process.env.SUPABASE_URL,
  hasAnon: !!process.env.SUPABASE_ANON_KEY,
  hasTestUser: !!process.env.TEST_USER_EMAIL,
  hasTestPass: !!process.env.TEST_USER_PASS
})

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL
const TEST_USER_PASS = process.env.TEST_USER_PASS
const TEST_EVENT_ID = process.env.TEST_EVENT_ID // uuid of an event with attendees
const TEST_PROFILE_ID = process.env.TEST_PROFILE_ID // uuid of a profile to fetch

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env')
    process.exit(1)
}
if (!TEST_USER_EMAIL || !TEST_USER_PASS) {
    console.error('Set TEST_USER_EMAIL and TEST_USER_PASS in your .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
    console.log('Signing in as test user...')
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: TEST_USER_EMAIL, password: TEST_USER_PASS })
    if (signInErr) {
        console.error('Sign-in failed:', signInErr)
        process.exit(1)
    }
    console.log('Signed in, user id:', signInData.user?.id)

    // Call debug RPC to see what auth.uid() resolves to and company
    console.log('Calling debug_get_caller_info...')
    const { data: dbg, error: dbgErr } = await supabase.rpc('debug_get_caller_info')
    if (dbgErr) {
        console.error('Debug RPC error:', dbgErr)
    } else {
        console.log('debug_get_caller_info ->', dbg)
    }

    // Call get_event_attendee_profiles (if event provided)
    if (TEST_EVENT_ID) {
        console.log('Calling get_event_attendee_profiles for event', TEST_EVENT_ID)
        const { data: attendees, error: attErr } = await supabase.rpc('get_event_attendee_profiles', { p_event: TEST_EVENT_ID })
        if (attErr) console.error('get_event_attendee_profiles error:', attErr)
        else console.log('get_event_attendee_profiles ->', attendees)
    }

    // Call get_profiles_by_ids_for_clients (if profile id provided)
    if (TEST_PROFILE_ID) {
        console.log('Calling get_profiles_by_ids_for_clients with id', TEST_PROFILE_ID)
        const { data: profs, error: profErr } = await supabase.rpc('get_profiles_by_ids_for_clients', { p_ids: [TEST_PROFILE_ID] })
        if (profErr) console.error('get_profiles_by_ids_for_clients error:', profErr)
        else console.log('get_profiles_by_ids_for_clients ->', profs)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
