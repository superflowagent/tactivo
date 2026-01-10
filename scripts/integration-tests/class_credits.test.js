/* Integration test for class credits behavior

Run with: SR=<service_role_key> node class_credits.test.js

This script will:
  - Create a temporary profile with class_credits = 5
  - Create an event of type 'class' with that profile as client -> expect class_credits -1
  - Add another client to event -> expect credits unchanged for original and -1 for added
  - Remove client -> expect refund
  - Change event type from 'class' to 'other' -> expect refund for all clients
  - Change back to 'class' -> expect deduction
  - Delete event -> expect refund
  - Cleanup profile
*/

const fetch = globalThis.fetch || require('node-fetch');
const { randomUUID } = require('crypto');

const SR = process.env.SR;
if (!SR) {
  console.error('Set SR env var to Supabase service_role key');
  process.exit(2);
}

const API = process.env.SUPABASE_URL || 'https://hzztmtkdaofrwcwzotas.supabase.co';

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  apikey: SR,
  Authorization: `Bearer ${SR}`,
  ...extra,
});

const assert = (cond, msg) => {
  if (!cond) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(3);
  }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('Starting integration test: class credits');

  // Find a company id to use
  const compRes = await fetch(`${API}/rest/v1/profiles?select=company&limit=1`, { headers: headers() });
  const comps = await compRes.json();
  assert(Array.isArray(comps) && comps.length > 0, 'failed to find company');
  const company = comps[0].company;
  console.log('Using company', company);

  // Create profile
  const userId = randomUUID();
  const createProfileRes = await fetch(`${API}/rest/v1/profiles`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ user: userId, company, role: 'client', class_credits: 5 }),
  });
  assert(createProfileRes.ok, 'failed to create profile');
  const [profile] = await createProfileRes.json();
  console.log('Created profile', profile.id, 'user', profile.user);

  try {
    // 1) Create class event with profile as client (use profile.user to test user-id path)
    const createEventRes = await fetch(`${API}/rest/v1/events`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ type: 'class', datetime: new Date().toISOString(), client: [profile.user], company }),
    });
    assert(createEventRes.ok, 'failed to create event');
    const [event] = await createEventRes.json();
    console.log('Created event', event.id);

    // slight delay to allow trigger to run
    await delay(250);

    let prof = await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}&select=id,class_credits,user`, { headers: headers() })).json();
    prof = Array.isArray(prof) ? prof[0] : prof;
    assert(prof.class_credits === 4, `expected 4 credits after event create, got ${prof.class_credits}`);
    console.log('Credits after creation OK:', prof.class_credits);

    // 2) Add another client (new profile)
    const user2 = randomUUID();
    const createProfile2Res = await fetch(`${API}/rest/v1/profiles`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ user: user2, company, role: 'client', class_credits: 2 }),
    });
    assert(createProfile2Res.ok, 'failed to create second profile');
    const [profile2] = await createProfile2Res.json();

    const addRes = await fetch(`${API}/rest/v1/events?id=eq.${event.id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ client: [profile.user, profile2.user] }),
    });
    assert(addRes.ok, 'failed to add client');
    await delay(250);

    const p1 = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}&select=id,class_credits,user`, { headers: headers() })).json())[0];
    const p2 = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile2.id}&select=id,class_credits,user`, { headers: headers() })).json())[0];
    assert(p1.class_credits === 4, `expected original p1 credits unchanged after adding someone; got ${p1.class_credits}`);
    assert(p2.class_credits === 1, `expected p2 credits decremented to 1; got ${p2.class_credits}`);
    console.log('Add client behavior OK');

    // 3) Remove profile2
    const remRes = await fetch(`${API}/rest/v1/events?id=eq.${event.id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ client: [profile.user] }),
    });
    assert(remRes.ok, 'failed to remove client');
    await delay(250);

    const p2_after = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile2.id}&select=id,class_credits`, { headers: headers() })).json())[0];
    assert(p2_after.class_credits === 2, `expected p2 credits refunded to 2; got ${p2_after.class_credits}`);
    console.log('Remove client behavior OK');

    // 4) Change event type to 'other' -> refund p1
    const patchTypeRes = await fetch(`${API}/rest/v1/events?id=eq.${event.id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ type: 'other' }),
    });
    assert(patchTypeRes.ok, 'failed to change type');
    await delay(250);

    const p1_afterType = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}&select=id,class_credits`, { headers: headers() })).json())[0];
    assert(p1_afterType.class_credits === 5, `expected p1 credits refunded to 5; got ${p1_afterType.class_credits}`);
    console.log('Type change refund OK');

    // 5) Change back to 'class' -> deduct
    const patchBackRes = await fetch(`${API}/rest/v1/events?id=eq.${event.id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ type: 'class' }),
    });
    assert(patchBackRes.ok, 'failed to change type back');
    await delay(250);

    const p1_afterBack = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}&select=id,class_credits`, { headers: headers() })).json())[0];
    assert(p1_afterBack.class_credits === 4, `expected p1 credits deducted to 4; got ${p1_afterBack.class_credits}`);
    console.log('Type change deduct OK');

    // 6) Delete event -> refund
    const delRes = await fetch(`${API}/rest/v1/events?id=eq.${event.id}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=representation' }),
    });
    assert(delRes.ok, 'failed to delete event');
    await delay(250);

    const p1_afterDel = (await (await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}&select=id,class_credits`, { headers: headers() })).json())[0];
    assert(p1_afterDel.class_credits === 5, `expected p1 credits refunded to 5 after delete; got ${p1_afterDel.class_credits}`);
    console.log('Delete refund OK');

    // cleanup profile2
    await fetch(`${API}/rest/v1/profiles?id=eq.${profile2.id}`, { method: 'DELETE', headers: headers() });

    console.log('Integration test PASSED');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(4);
  } finally {
    // cleanup profile
    await fetch(`${API}/rest/v1/profiles?id=eq.${profile.id}`, { method: 'DELETE', headers: headers() });
  }
})();
