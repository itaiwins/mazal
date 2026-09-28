#!/usr/bin/env node
/**
 * MEXA-279 - the Orthodox / Safta / Shidduch reads, run as a real signed-in user.
 *
 * Those screens are behind the feature flags from 9dbc0e7, so nothing here can be checked by
 * opening the app. This runs the rewritten queries verbatim instead: sign in as A, ask for B,
 * and show B's row coming back - and show that the same read cannot reach B's email, phone or
 * coordinates, which is the point of `user_public_profiles` (00013, MEXA-261).
 *
 * Requires `user_public_profiles` to exist on the target project, i.e. 00013 applied.
 *
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   node scripts/e2e/mexa279-public-profile-reads.mjs
 *
 * Fixture accounts follow the naming rule in scripts/README.md: fixed addresses under
 * @example.com carrying an `e2e-` label, deleted at setup and again in `finally`, by email
 * rather than by captured id. A teardown failure exits non-zero even if every check passed,
 * because the rows are still live either way.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE_ROLE) {
  console.error('Need SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the env.');
  console.error('set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a');
  process.exit(2);
}

const admin = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
const PASSWORD = 'violet-e2e-mexa279-Pass!1';

// Fixed addresses, per scripts/README.md. A crashed run's rows stay reclaimable.
const FIXTURES = {
  a: { email: 'violet-e2e-mexa279-a@example.com', first: 'Aviva', gender: 'female' },
  b: { email: 'violet-e2e-mexa279-b@example.com', first: 'Baruch', gender: 'male' },
  shadchan: { email: 'violet-e2e-mexa279-shadchan@example.com', first: 'Shimon', gender: 'male' },
  safta: { email: 'violet-e2e-mexa279-safta@example.com' },
};
const ALL_EMAILS = Object.values(FIXTURES).map((f) => f.email);

let failures = 0;
function check(label, passed, detail = '') {
  if (!passed) failures++;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
  if (detail) console.log(`      ${detail}`);
}

/** Reported, never asserted: something true of the project rather than of this change. */
function note(label, detail = '') {
  console.log(`NOTE  ${label}`);
  if (detail) console.log(`      ${detail}`);
}

/**
 * Insert a fixture and abort the run if it did not land.
 *
 * Every fixture insert goes through this. An earlier version ignored these errors, and when
 * migration 00017 changed what `matches` accepts, the missing row surfaced as two checks
 * quietly reporting `rows=0` - which reads like the code under test being broken rather than
 * the setup never happening. A failed fixture has to be louder than a failed assertion, not
 * quieter.
 */
async function seed(what, insert) {
  const { data, error } = await insert();
  if (error) throw new Error(`could not seed ${what}: ${error.code} ${error.message}`);
  return data;
}

/**
 * Every check below is about reading other people through `user_public_profiles`, so if the
 * view is missing they would all fail - or worse, the "B disappears when blocked" pair would
 * pass for the wrong reason, because a missing relation also returns no rows. Stop instead.
 */
async function requireView() {
  const { error } = await admin.from('user_public_profiles').select('id').limit(1);
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    throw new Error(
      'public.user_public_profiles does not exist on this project. Apply ' +
        'supabase/migrations/00013_users_column_privacy.sql (MEXA-261) first - without the ' +
        'view every check here is vacuous.'
    );
  }
  if (error) throw error;
}

/** Delete every fixture by email, in dependency order, whether or not this run created it. */
async function teardown() {
  const { data: rows } = await admin.from('users').select('id').in('email', ALL_EMAILS);
  const userIds = (rows ?? []).map((r) => r.id);

  if (userIds.length > 0) {
    const { data: accounts } = await admin
      .from('safta_accounts')
      .select('id')
      .in('email', ALL_EMAILS);
    const accountIds = (accounts ?? []).map((r) => r.id);

    await admin.from('safta_likes').delete().in('liked_user_id', userIds);
    await admin.from('safta_likes').delete().in('for_user_id', userIds);
    if (accountIds.length > 0) {
      await admin.from('safta_connections').delete().in('safta_account_id', accountIds);
    }

    const { data: profiles } = await admin
      .from('shidduch_profiles')
      .select('id')
      .in('user_id', userIds);
    const profileIds = (profiles ?? []).map((r) => r.id);
    if (profileIds.length > 0) {
      await admin.from('shidduch_suggestions').delete().in('profile_a_id', profileIds);
      await admin.from('shidduch_suggestions').delete().in('profile_b_id', profileIds);
      await admin.from('shidduch_profiles').delete().in('id', profileIds);
    }

    await admin.from('matches').delete().in('user1_id', userIds);
    await admin.from('user_photos').delete().in('user_id', userIds);
    await admin.from('safta_accounts').delete().in('email', ALL_EMAILS);
    await admin.from('users').delete().in('id', userIds);
  } else {
    await admin.from('safta_accounts').delete().in('email', ALL_EMAILS);
  }

  // auth.users is not reachable by email through the data API, so page the admin list.
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  for (const u of list?.users ?? []) {
    if (u.email && ALL_EMAILS.includes(u.email)) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) throw delErr;
    }
  }

  const { data: left } = await admin.from('users').select('email').in('email', ALL_EMAILS);
  if ((left ?? []).length > 0) {
    throw new Error(`teardown left rows in public.users: ${left.map((r) => r.email).join(', ')}`);
  }
}

async function createMember({ email, first, gender }, extra = {}) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const { data: row, error: rowError } = await admin
    .from('users')
    .insert({
      auth_id: created.user.id,
      email,
      // A real-looking contact pair, so "A cannot read B's email or phone" has something to
      // fail on rather than a null.
      phone: `+1555010${Math.floor(1000 + Math.random() * 8999)}`,
      first_name: first,
      last_name: 'Fixture',
      display_name: first,
      date_of_birth: '1995-04-01',
      gender,
      jewish_background: 'modern_orthodox',
      looking_for: 'marriage_minded',
      is_active: true,
      onboarding_complete: true,
      occupation: 'Fixture',
      current_city: 'Brooklyn',
      current_state: 'NY',
      current_latitude: 40.6782,
      current_longitude: -73.9442,
      is_orthodox_user: true,
      ...extra,
    })
    .select('id')
    .single();
  if (rowError) throw rowError;

  return { email, authId: created.user.id, id: row.id };
}

async function signIn(email) {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function run() {
  const A = await createMember(FIXTURES.a);
  const B = await createMember(FIXTURES.b);
  const shadchan = await createMember(FIXTURES.shadchan);
  console.log(`fixtures: A=${A.id} ${FIXTURES.a.first}   B=${B.id} ${FIXTURES.b.first}\n`);

  await seed('B has a primary photo', () =>
    admin
      .from('user_photos')
      .insert({ user_id: B.id, photo_url: 'https://example.com/b-primary.jpg', photo_order: 0 })
  );
  // `matches` carries `CHECK (user1_id < user2_id)` since 00017 (MEXA-294), so a match is
  // stored in canonical id order rather than in "who swiped first" order. Which side A lands
  // on is therefore down to how the two UUIDs sort - the reason the screen resolves the
  // counterpart with `user1_id === me ? user2_id : user1_id` instead of assuming a side.
  const [firstId, secondId] = [A.id, B.id].sort();
  const match = await seed('A and B are matched', () =>
    admin.from('matches').insert({ user1_id: firstId, user2_id: secondId }).select('id').single()
  );

  const profileA = await seed("A's shidduch profile", () =>
    admin
      .from('shidduch_profiles')
      .insert({
        user_id: A.id,
        community: 'modern_orthodox',
        profile_visible: true,
        accepting_suggestions: true,
      })
      .select('id')
      .single()
  );
  const profileB = await seed("B's shidduch profile", () =>
    admin
      .from('shidduch_profiles')
      .insert({
        user_id: B.id,
        community: 'modern_orthodox',
        profile_visible: true,
        accepting_suggestions: true,
        hebrew_name: 'ברוך',
      })
      .select('id')
      .single()
  );
  await seed('a shadchan suggestion of B to A', () =>
    admin.from('shidduch_suggestions').insert({
      profile_a_id: profileA.id,
      profile_b_id: profileB.id,
      suggested_by_user_id: shadchan.id,
      suggested_by_type: 'shadchan',
      compatibility_score: 77,
      profile_a_status: 'pending',
    })
  );

  const { data: saftaAuth, error: saftaAuthError } = await admin.auth.admin.createUser({
    email: FIXTURES.safta.email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (saftaAuthError) throw saftaAuthError;
  const saftaAccount = await seed('a safta account', () =>
    admin
      .from('safta_accounts')
      .insert({
        auth_id: saftaAuth.user.id,
        email: FIXTURES.safta.email,
        display_name: 'Bubbe',
        relationship: 'grandparent',
        is_active: true,
      })
      .select('id')
      .single()
  );
  await seed('the safta connected to B', () =>
    admin
      .from('safta_connections')
      .insert({ safta_account_id: saftaAccount.id, connected_user_id: B.id, status: 'accepted' })
  );
  await seed('the safta recommending B to A', () =>
    admin.from('safta_likes').insert({
      safta_account_id: saftaAccount.id,
      for_user_id: A.id,
      liked_user_id: B.id,
      sent_to_user: true,
      sent_at: new Date().toISOString(),
    })
  );

  const a = await signIn(FIXTURES.a.email);
  const safta = await signIn(FIXTURES.safta.email);

  console.log('--- what the view does and does not carry -----------------------------');
  {
    const { data, error } = await a
      .from('user_public_profiles')
      .select('id, first_name, occupation, jewish_background, distance_miles')
      .in('id', [B.id]);
    check('A reads B from user_public_profiles', !error && data?.length === 1 && data[0].id === B.id,
      JSON.stringify(data?.[0] ?? error));
  }
  for (const column of ['email', 'phone', 'current_latitude', 'current_longitude', 'last_name']) {
    const { data, error } = await a
      .from('user_public_profiles')
      .select(`id,${column}`)
      .in('id', [B.id]);
    check(`the view has no ${column} to give`, !!error,
      error ? `${error.code} ${error.message}` : JSON.stringify(data));
  }
  {
    // Not this issue's assertion - whether `users` itself is closed is MEXA-261's, proved by
    // 00013's own tests. Reported here because it says whether the migration is fully applied
    // on the project these checks just ran against.
    const { data, error } = await a.from('users').select('id, email, phone').eq('id', B.id);
    const closed = !error && (data ?? []).length === 0;
    note(
      closed
        ? '`users` is own-row-only here, so 00013 is fully applied (MEXA-261)'
        : '`users` still serves other people here, so 00013 section 3 is NOT applied yet - ' +
            'the view exists but the old cross-user policy has not been dropped',
      `rows=${data?.length ?? 0} ${error ? error.code + ' ' + error.message : ''}`
    );
  }

  console.log('\n--- app/(orthodox-tabs)/index.tsx ------------------------------------');
  {
    const { data, error } = await a
      .from('user_public_profiles')
      .select('id, first_name, date_of_birth, jewish_background, bio, occupation')
      .eq('is_orthodox_user', true)
      .eq('is_active', true)
      .neq('id', A.id)
      .limit(20);
    check('the Orthodox deck contains B', !error && (data ?? []).some((r) => r.id === B.id),
      `rows=${data?.length ?? 0} ${error?.message ?? ''}`);

    const ids = (data ?? []).map((r) => r.id);
    const { data: photos, error: photoError } = await a
      .from('user_photos')
      .select('user_id, photo_url, photo_order')
      .in('user_id', ids)
      .order('photo_order', { ascending: true });
    check("its photo query returns B's primary photo",
      !photoError && (photos ?? []).some((p) => p.user_id === B.id),
      JSON.stringify((photos ?? []).find((p) => p.user_id === B.id) ?? photoError));
  }

  console.log('\n--- app/(orthodox-tabs)/matches.tsx ----------------------------------');
  {
    const { data, error } = await a
      .from('matches')
      .select('id, created_at, user1_id, user2_id')
      .or(`user1_id.eq.${A.id},user2_id.eq.${A.id}`)
      .order('created_at', { ascending: false });
    check('A reads the match row', !error && (data ?? []).some((r) => r.id === match.id),
      error?.message ?? `rows=${data?.length ?? 0}`);

    const otherIds = (data ?? []).map((r) => (r.user1_id === A.id ? r.user2_id : r.user1_id));
    const { data: others, error: otherError } = await a
      .from('user_public_profiles')
      .select('id, first_name, jewish_background')
      .in('id', otherIds);
    check('the counterpart resolves to B', !otherError && (others ?? []).some((u) => u.id === B.id),
      JSON.stringify(others ?? otherError));
  }

  console.log('\n--- app/(shidduch-tabs)/browse.tsx -----------------------------------');
  {
    const { data, error } = await a
      .from('shidduch_profiles')
      .select('id, user_id, hebrew_name, community, hashkafa_details, looking_for_description, created_at')
      .eq('profile_visible', true)
      .eq('accepting_suggestions', true)
      .neq('user_id', A.id)
      .limit(50);
    check("B's shidduch profile is browsable", !error && (data ?? []).some((r) => r.user_id === B.id),
      `rows=${data?.length ?? 0} ${error?.message ?? ''}`);

    const ids = [...new Set((data ?? []).map((r) => r.user_id))].filter(Boolean);
    const { data: users, error: userError } = await a
      .from('user_public_profiles')
      .select('id, first_name, date_of_birth, gender, current_city, current_state')
      .in('id', ids);
    check('and its user columns resolve to B',
      !userError && (users ?? []).some((u) => u.id === B.id),
      JSON.stringify((users ?? []).find((u) => u.id === B.id) ?? userError));
  }

  console.log('\n--- app/(shidduch-tabs)/index.tsx ------------------------------------');
  {
    const { data, error } = await a
      .from('shidduch_suggestions')
      .select(`
        id,
        profile_a_status,
        compatibility_score,
        suggested_by_user_id,
        profile_b:shidduch_profiles!shidduch_suggestions_profile_b_id_fkey(
          id,
          user_id,
          hebrew_name,
          community
        )
      `)
      .eq('profile_a_id', profileA.id)
      .neq('suggested_by_type', 'algorithm')
      .order('created_at', { ascending: false });
    check('A reads the shadchan suggestion, profile_b named by its FK',
      !error && (data ?? []).length === 1, JSON.stringify(data?.[0] ?? error));

    const ids = [
      ...new Set((data ?? []).flatMap((s) => [s.profile_b?.user_id, s.suggested_by_user_id])),
    ].filter(Boolean);
    const { data: users, error: userError } = await a
      .from('user_public_profiles')
      .select('id, first_name, date_of_birth, current_city, current_state')
      .in('id', ids);
    check('the suggested person and the shadchan both resolve',
      !userError && (users ?? []).some((u) => u.id === B.id) &&
        (users ?? []).some((u) => u.id === shadchan.id),
      JSON.stringify(users ?? userError));
  }

  console.log('\n--- src/services/matchingService.ts ----------------------------------');
  {
    const { data: viaView } = await a.from('user_public_profiles').select('id').eq('id', A.id);
    check('the view excludes the caller, which is why the source profile reads `users`',
      (viaView ?? []).length === 0, `rows=${viaView?.length ?? 0}`);

    const { data: own, error: ownError } = await a
      .from('users')
      .select('first_name, date_of_birth, gender, current_city, current_state, current_country')
      .eq('id', A.id)
      .maybeSingle();
    check('A reads its own row out of `users` for the source profile',
      !ownError && own?.gender === FIXTURES.a.gender, JSON.stringify(own ?? ownError));

    const { data: candidates, error: candidateError } = await a
      .from('shidduch_profiles')
      .select('id, user_id')
      .eq('profile_visible', true)
      .eq('accepting_suggestions', true)
      .neq('id', profileA.id)
      .limit(500);
    const ids = [...new Set((candidates ?? []).map((c) => c.user_id))].filter(Boolean);
    const { data: candidateUsers } = await a
      .from('user_public_profiles')
      .select('id, gender')
      .in('id', ids);
    check('and B is scoreable as a candidate (opposite gender, visible)',
      !candidateError && (candidateUsers ?? []).some((u) => u.id === B.id && u.gender === 'male'),
      JSON.stringify(candidateUsers ?? candidateError));
  }

  console.log('\n--- app/(safta-tabs)/profile.tsx, as the safta -----------------------');
  {
    const { data: account, error: accountError } = await safta
      .from('safta_accounts')
      .select('id')
      .eq('auth_id', saftaAuth.user.id)
      .maybeSingle();
    check('the safta resolves her own account row', !accountError && account?.id === saftaAccount.id,
      JSON.stringify(account ?? accountError));

    const { data: connections, error: connectionError } = await safta
      .from('safta_connections')
      .select('id, created_at, connected_user_id')
      .eq('safta_account_id', account?.id ?? '')
      .order('created_at', { ascending: false });
    check('her connections come back keyed on safta_account_id, not the absent safta_id',
      !connectionError && (connections ?? []).some((c) => c.connected_user_id === B.id),
      JSON.stringify(connections ?? connectionError));

    const ids = (connections ?? []).map((c) => c.connected_user_id).filter(Boolean);
    const { data: members, error: memberError } = await safta
      .from('user_public_profiles')
      .select('id, first_name, date_of_birth')
      .in('id', ids);
    check('the connected member resolves to B, for a caller with no `users` row of her own',
      !memberError && (members ?? []).some((m) => m.id === B.id),
      JSON.stringify(members ?? memberError));

    const { data: photos, error: photoError } = await safta
      .from('user_photos')
      .select('user_id, photo_url')
      .in('user_id', ids);
    check("and so does his photo", !photoError && (photos ?? []).some((p) => p.user_id === B.id),
      JSON.stringify(photos ?? photoError));
  }

  console.log('\n--- src/features/safta/hooks/useSaftaRecommendations.ts --------------');
  {
    const { data, error } = await a
      .from('safta_likes')
      .select(`*, safta:safta_accounts!safta_account_id(id, display_name)`)
      .eq('for_user_id', A.id)
      .eq('sent_to_user', true)
      .order('created_at', { ascending: false });
    check('A reads the recommendation made for her', !error && (data ?? []).length === 1,
      JSON.stringify(data?.[0] ?? error));

    const ids = [...new Set((data ?? []).map((r) => r.liked_user_id))].filter(Boolean);
    const { data: liked, error: likedError } = await a
      .from('user_public_profiles')
      .select('id, first_name, occupation, jewish_background')
      .in('id', ids);
    check('and the person recommended resolves to B',
      !likedError && (liked ?? []).some((u) => u.id === B.id), JSON.stringify(liked ?? likedError));
  }

  console.log('\n--- the two sanity checks that keep the rest honest ------------------');
  {
    // Deactivate B and the view should stop mentioning him, which is the row rule the
    // dropped `users` policy used to enforce.
    await admin.from('users').update({ is_active: false }).eq('id', B.id);
    const { data } = await a.from('user_public_profiles').select('id').eq('id', B.id);
    check('an inactive B disappears from the view', (data ?? []).length === 0,
      `rows=${data?.length ?? 0}`);
    await admin.from('users').update({ is_active: true }).eq('id', B.id);

    await admin.from('blocks').insert({ blocker_id: B.id, blocked_id: A.id });
    const { data: blocked } = await a.from('user_public_profiles').select('id').eq('id', B.id);
    check('a B who has blocked A disappears from the view', (blocked ?? []).length === 0,
      `rows=${blocked?.length ?? 0}`);
    await admin.from('blocks').delete().eq('blocker_id', B.id).eq('blocked_id', A.id);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
}

let runError;
try {
  await requireView();
  await teardown(); // reclaim anything a previous run left behind
  await run();
} catch (error) {
  runError = error;
  console.error('\nRUN ERROR:', error?.message ?? error);
} finally {
  try {
    await teardown();
    console.log('teardown: fixtures removed');
  } catch (error) {
    console.error('TEARDOWN FAILED, fixtures are still live:', error?.message ?? error);
    process.exit(1);
  }
  process.exit(runError || failures > 0 ? 1 : 0);
}
