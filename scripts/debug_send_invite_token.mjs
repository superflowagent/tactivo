const SUPABASE_URL = 'https://hzztmtkdaofrwcwzotas.supabase.co'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid' // intentionally invalid
    ; (async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ email: 'victor97romero@gmail.com' })
        })
        console.log('status', res.status)
        console.log('body', await res.text())
    })()