(async () => {
    const sr = process.env.SR;
    if (!sr) {
        console.error('Please set SR env var to service role key');
        process.exit(2);
    }
    const body = {
        type: 'class',
        datetime: '2026-01-10T10:00:00+00:00',
        duration: 60,
        client: ['c35cad5e-08c6-43a2-80c7-1c0c6818966c'],
        company: '7659f9de-3ab0-4c19-8950-181d6b4d62a8',
        notes: 'test adjust trigger'
    };

    try {
        const res = await fetch('https://hzztmtkdaofrwcwzotas.supabase.co/rest/v1/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
                apikey: sr,
                Authorization: `Bearer ${sr}`
            },
            body: JSON.stringify(body)
        });
        const text = await res.text();
        console.log('STATUS', res.status);
        console.log(text);
    } catch (err) {
        console.error('ERR', err);
    }
})();