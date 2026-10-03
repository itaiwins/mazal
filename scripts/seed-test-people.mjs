#!/usr/bin/env node
/**
 * Fill the live project with fake people so every screen has something on it (MEXA-581).
 *
 *   node scripts/seed-test-people.mjs                 # seed (refuses if a seed is already there)
 *   node scripts/seed-test-people.mjs --dry-run       # print what it would create, touch nothing
 *   node scripts/seed-test-people.mjs --wipe --dry-run   # list exactly what --wipe would delete
 *   node scripts/seed-test-people.mjs --wipe          # delete every seeded row, nothing else
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from archive/credentials/mazal-supabase.env.
 * Set SEED_PASSWORD to give every fake account a password you know, so you can sign in as one
 * of them and test the other side of a match. Without it each account gets a random password
 * nobody ever sees.
 *
 * ## What it makes
 *
 * 58 people (31 women, 24 men, 3 non-binary), ages 19-60, in 16 cities, each with a complete
 * profile, 3 photos and 3 prompt answers. Photos are free hotlinks: the face is one of
 * pravatar.cc's 70 portraits (each used once, picked by eye for gender and age), the other two
 * are picsum.photos scenery. No storage upload, so nothing to clean up in a bucket.
 *
 * For the tester's own account (TESTER_EMAIL, Itai's by default) it adds, **without writing to
 * that account's own rows**:
 *
 *  - likes aimed at them, so the first cards in their deck are people who already like them
 *    and a right swipe makes an instant match;
 *  - matches, most with a few unread messages from the other person and two brand new.
 *
 * The one row written as the tester is their like on each person they are matched with, since
 * a match always has one and without it that person would also turn up in their deck. Their
 * `users` row is never touched and nothing is sent in their name. Plus some likes, passes,
 * matches and chats among the fake people themselves.
 *
 * Every push the triggers queue for those inserts is deleted straight away, so the tester's
 * phone is not buzzed thirty times by people who do not exist.
 *
 * ## How the seeded set is found again
 *
 * A seeded account has an email `seed-<n>@seed.mazal.invalid` **and** `app_metadata.mazal_seed
 * = true`. Both must hold. `.invalid` is reserved by RFC 2606, so no real person can have that
 * address, and `app_metadata` is only writable with the service role, so a user cannot tag or
 * untag themselves. Every other seeded row hangs off one of those accounts by foreign key, so
 * deleting the auth user cascades through `users` to photos, prompts, swipes, matches and
 * messages - including the tester's own swipes on fake people and any messages they sent in a
 * fake match, which go with the match.
 *
 * Two kinds of row do not cascade, and --wipe removes them by hand:
 *
 *  - `notification_queue` rows addressed to the tester about a fake person (a match they made
 *    by swiping right on one). They belong to the tester's user id, so they are matched on
 *    the fake person's id inside `data`.
 *  - `deleted_accounts` tombstones. `users_record_deletion` writes one when a deleted user had
 *    been reported or blocked - which happens if the tester reports or blocks a fake person
 *    while testing. The seed never creates a block or a report, so a fresh seed leaves none.
 *
 * Supabase sends no email for any of this: accounts are created with `email_confirm: true`.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const args = new Set(process.argv.slice(2));
const WIPE = args.has('--wipe');
const DRY_RUN = args.has('--dry-run');
const SEED_DOMAIN = 'seed.mazal.invalid';
const TESTER_EMAIL = process.env.TESTER_EMAIL || 'itairotem23@gmail.com';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (archive/credentials/mazal-supabase.env)');
  process.exit(2);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Throw on any PostgREST error: a silent failed insert reads later as a missing feature. */
async function must(promise, what) {
  const { data, error, count } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return count ?? data;
}

// ---------------------------------------------------------------------------------------------
// The people. Deterministic: the same run produces the same people every time.
// ---------------------------------------------------------------------------------------------

let state = 581;
const rand = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickN = (list, n) => {
  const copy = [...list];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};

// pravatar.cc portraits, sorted by eye from the 70 it serves. Children, group shots and
// joke faces are left out.
const FACES = {
  female: [5, 9, 10, 16, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 38, 39, 41, 42, 43, 44, 45, 47, 48, 49, 40],
  male: [3, 8, 11, 12, 13, 14, 18, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 67, 68, 7],
  older_male: [17, 65, 69],
  non_binary: [15, 33, 62],
};

const NAMES = {
  female: ['Noa', 'Maya', 'Talia', 'Shira', 'Leah', 'Rachel', 'Hannah', 'Abby', 'Eliana', 'Yael', 'Rebecca', 'Sarah', 'Ariel', 'Dana', 'Tamar', 'Naomi', 'Jordana', 'Mia', 'Ella', 'Lily', 'Ava', 'Gabi', 'Rivka', 'Esther', 'Adina', 'Chloe', 'Sophie', 'Michal', 'Liora', 'Batya', 'Keren'],
  male: ['Ethan', 'Noah', 'Ari', 'Eli', 'Jacob', 'Daniel', 'Josh', 'Ben', 'Sam', 'Max', 'Jonah', 'Micah', 'Asher', 'Gabe', 'Zach', 'Avi', 'Yoni', 'Matan', 'Oren', 'Levi', 'Adam', 'David', 'Howard', 'Mort'],
  non_binary: ['Jules', 'Sasha', 'Rowan', 'Remy'],
};
const LAST = ['Cohen', 'Levy', 'Goldberg', 'Friedman', 'Katz', 'Shapiro', 'Rosen', 'Klein', 'Weiss', 'Stern', 'Kaplan', 'Adler', 'Berman', 'Gold', 'Schwartz', 'Peretz', 'Mizrahi', 'Azoulay', 'Benaim', 'Hadad', 'Blum', 'Feldman', 'Horowitz', 'Segal', 'Weinberg'];

const CITIES = [
  ['Tallahassee', 'FL', 30.4383, -84.2807], ['Miami', 'FL', 25.7617, -80.1918], ['Boca Raton', 'FL', 26.3683, -80.1289],
  ['Gainesville', 'FL', 29.6516, -82.3248], ['Atlanta', 'GA', 33.749, -84.388], ['New York', 'NY', 40.7128, -74.006],
  ['Brooklyn', 'NY', 40.6782, -73.9442], ['Hoboken', 'NJ', 40.744, -74.0324], ['Boston', 'MA', 42.3601, -71.0589],
  ['Philadelphia', 'PA', 39.9526, -75.1652], ['Washington', 'DC', 38.9072, -77.0369], ['Chicago', 'IL', 41.8781, -87.6298],
  ['Los Angeles', 'CA', 34.0522, -118.2437], ['San Francisco', 'CA', 37.7749, -122.4194], ['Austin', 'TX', 30.2672, -97.7431],
  ['Denver', 'CO', 39.7392, -104.9903],
];

const JOBS = [
  ['Software engineer', 'Stripe'], ['Nurse', 'Mount Sinai'], ['Law student', null], ['Product designer', 'Figma'],
  ['Teacher', 'Hillel Day School'], ['Med student', null], ['Marketing manager', 'Spotify'], ['Accountant', 'Deloitte'],
  ['Physical therapist', null], ['Data analyst', 'Capital One'], ['Social worker', 'JFS'], ['Architect', 'Gensler'],
  ['Grad student', null], ['Founder', 'a tiny startup'], ['Real estate agent', 'Compass'], ['Chef', 'Zahav'],
  ['Journalist', 'The Forward'], ['Consultant', 'McKinsey'], ['Dentist', null], ['Musician', null],
];
const SCHOOLS = ['Florida State', 'University of Florida', 'NYU', 'Columbia', 'Brandeis', 'Penn', 'University of Michigan', 'Emory', 'Tulane', 'UCLA', 'Boston University', 'Yeshiva University', 'Stern College', 'University of Maryland', 'Tel Aviv University'];
const EDUCATION = ["Bachelor's", "Master's", 'Some college', 'JD', 'MD', 'PhD'];

const BIOS = [
  'Shabbat dinner host, bad at saying no to dessert. Looking for someone to split a babka with.',
  'Moved here for work, stayed for the beaches. Will absolutely make you try my shakshuka.',
  'Half Israeli, half New Yorker, fully opinionated about hummus.',
  'Weekday spreadsheets, weekend hikes. My mom thinks I should be on here, so hi.',
  'Big family, bigger Seders. I laugh at my own jokes before I finish them.',
  'Former camp counselor, forever camp counselor. Ask me about color war.',
  'Trying every coffee shop in the city and keeping a ranked list. Currently 41 deep.',
  'I run, I read, I make a very serious challah. Looking for my plus one at every simcha.',
  'Grew up Reform, went to Israel, came back with a lot of questions and a love of falafel.',
  'Nurse by day, amateur DJ by night. Tell me your go-to karaoke song.',
  'Learning to surf, failing gracefully. Dog person, but cats seem to like me.',
  'Just finished my masters and finally have free time. Show me your favorite spot.',
  'Sephardic grandmother taught me everything about cooking and nothing about patience.',
  'Here for something real. Bonus points if you can beat me at Bananagrams.',
];

const PROMPTS = {
  shabbat_looks_like: ['Friday night dinner with way too many friends and a long walk after.', 'Sleeping in, a big lunch, and a nap I will not apologize for.'],
  jewish_food_take: ['Latkes over sufganiyot and it is not close.', 'Matzah brei is a breakfast food all year round.'],
  bubbe_describes: ['"Such a mensch, but call more."', '"Too skinny, eat something."'],
  favorite_holiday: ['Sukkot. Eating outside with everyone you love is the whole point.', 'Purim, because costumes are mandatory.'],
  deli_order: ['Pastrami on rye, extra mustard, a half sour on the side.', 'Matzah ball soup and whatever you are having.'],
  israel_memory: ['Sunrise on Masada after a 4am climb.', 'Shuk Machane Yehuda on a Friday afternoon, total chaos.'],
  seder_role: ['...reads the Four Questions even though I am 27.', '...hides the afikoman somewhere nobody can find it.'],
  geek_out_on: ['Fantasy football and old maps.', 'Sourdough hydration percentages.'],
  friends_describe: ['The planner of the group chat.', 'The one who always knows a guy.'],
  unusual_skill: ['I can name any Disney song in three notes.', 'Parallel parking on the first try, every time.'],
  life_motto: ['Gam zu l\'tova.', 'Say yes, figure it out later.'],
  love_language: ['Quality time and snacks.', 'Acts of service. Bring me coffee and I am yours.'],
  ideal_date: ['A walk, a falafel stand, and seeing where the night goes.', 'Mini golf. I will be competitive about it.'],
  green_flag: ['Being nice to the waiter.', 'Calling your grandparents.'],
  together_we_could: ['Host the best Shabbat dinner in the city.', 'Finally finish the NYT crossword on a Saturday.'],
  perfect_night_in: ['Takeout, a movie we both pretend to have seen, and a board game.'],
  swipe_right_if: ['You have a strong opinion about the best bagel.', 'You will come to my cousin\'s wedding with me.'],
  sunday_looks_like: ['Farmers market, brunch, nap, repeat.', 'Long run then a longer brunch.'],
  currently_obsessed: ['Padel. Ask me to play.', 'Making the perfect iced latte at home.'],
  cooking_specialty: ['My grandmother\'s chicken soup, the real recipe.', 'Shakshuka with way too much feta.'],
  dream_vacation: ['A month in Tel Aviv and the Galilee.', 'Japan in cherry blossom season.'],
};
const PROMPT_IDS = Object.keys(PROMPTS);

const BACKGROUNDS = ['modern_orthodox', 'conservative', 'reform', 'reconstructionist', 'secular', 'just_jewish', 'sephardic', 'mizrachi', 'chabad', 'orthodox', 'converting'];
const OBSERVANCE = { orthodox: 'very_observant', modern_orthodox: 'very_observant', chabad: 'very_observant', conservative: 'somewhat_observant', sephardic: 'somewhat_observant', mizrachi: 'somewhat_observant' };

/** Ages the default deck filter (22-35) mostly shows, plus a few outside it to test filters. */
function ageFor(i, kind) {
  if (kind === 'older_male') return 52 + (i - FACES.male.length) * 4;
  if (i % 11 === 3) return 19 + (i % 3);
  if (i % 13 === 5) return 36 + (i % 5);
  return 22 + Math.floor(rand() * 12);
}

function dobFor(age) {
  // Somewhere between `age` and `age + 11 months` old today, so profile_age() says `age`.
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 1 - Math.floor(rand() * 330));
  return d.toISOString().slice(0, 10);
}

function buildPeople() {
  const people = [];
  const add = (gender, face, idx, kind) => {
    const n = people.length + 1;
    const first = NAMES[gender === 'non_binary' ? 'non_binary' : gender][idx];
    const last = pick(LAST);
    const background = pick(BACKGROUNDS);
    const observant = OBSERVANCE[background];
    const [city, st, lat, lng] = n <= 6 ? CITIES[0] : pick(CITIES); // a handful in Tallahassee, near Itai
    const [occupation, company] = pick(JOBS);
    const age = ageFor(idx, kind);
    people.push({
      n,
      email: `seed-${String(n).padStart(2, '0')}@${SEED_DOMAIN}`,
      face,
      profile: {
        first_name: first,
        last_name: last,
        display_name: first,
        gender,
        gender_preference: gender === 'female' ? (n % 9 === 0 ? ['female'] : ['male']) : gender === 'male' ? (n % 10 === 0 ? ['male'] : ['female']) : ['female', 'male', 'non_binary'],
        date_of_birth: dobFor(age),
        current_city: city,
        current_state: st,
        current_country: 'US',
        current_latitude: +(lat + (rand() - 0.5) * 0.08).toFixed(5),
        current_longitude: +(lng + (rand() - 0.5) * 0.08).toFixed(5),
        bio: pick(BIOS),
        height_cm: gender === 'male' ? 168 + Math.floor(rand() * 22) : 155 + Math.floor(rand() * 20),
        occupation,
        company,
        education: pick(EDUCATION),
        school: pick(SCHOOLS),
        jewish_background: background,
        observance_level: observant || pick(['culturally_jewish', 'not_observant', 'somewhat_observant']),
        keeps_shabbat: observant === 'very_observant' ? 'always' : pick(['sometimes', 'rarely', 'never']),
        keeps_kosher: observant === 'very_observant' ? 'strict' : pick(['kosher_style', 'at_home', 'not_kosher']),
        synagogue_attendance: observant === 'very_observant' ? 'weekly' : pick(['holidays', 'rarely', 'holidays']),
        jewish_education: pick(['day_school', 'hebrew_school', 'none', 'yeshiva', 'other']),
        looking_for: pick(['serious', 'marriage_minded', 'open', 'casual', 'serious']),
        wants_children: pick(['yes', 'yes', 'open', 'no']),
        partner_must_be_jewish: rand() < 0.7,
        raise_children_jewish: rand() < 0.8,
        willing_to_relocate: rand() < 0.4,
        is_active: true,
        is_verified: rand() < 0.3,
        onboarding_complete: true,
        elo_score: 1000 + Math.floor(rand() * 400),
      },
      prompts: pickN(PROMPT_IDS, 3).map((id, display_order) => ({ prompt_id: id, answer: pick(PROMPTS[id]), display_order })),
    });
  };
  FACES.female.forEach((f, i) => add('female', f, i));
  FACES.male.forEach((f, i) => add('male', f, i));
  FACES.older_male.forEach((f, i) => add('male', f, FACES.male.length + i, 'older_male'));
  FACES.non_binary.forEach((f, i) => add('non_binary', f, i));
  return people;
}

function photosFor(p) {
  return [
    `https://i.pravatar.cc/800?img=${p.face}`,
    `https://picsum.photos/seed/mazal-${p.n}-a/800/1000`,
    `https://picsum.photos/seed/mazal-${p.n}-b/800/1000`,
  ].map((photo_url, photo_order) => ({ photo_url, photo_order, is_primary: photo_order === 0 }));
}

const OPENERS = [
  ['Hey! Your deli order is exactly right', 'Ok but where do you get pastrami around here?'],
  ['Hi :) I had to match with someone who also loves Sukkot'],
  ['Mini golf first date? I am warning you now, I am very good', 'Like, suspiciously good'],
  ['So what brought you to Mazal?', 'My cousin met her husband on here and will not stop talking about it', 'No pressure though haha'],
  ['Shabbat dinner at my place this Friday, a bunch of friends are coming. You should come!'],
];

// ---------------------------------------------------------------------------------------------
// Finding the seeded set again
// ---------------------------------------------------------------------------------------------

async function listSeededAuthUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      // Both halves, never one: an address alone could be typed by anyone at signup.
      if (u.email?.endsWith(`@${SEED_DOMAIN}`) && u.app_metadata?.mazal_seed === true) found.push(u);
    }
    if (data.users.length < 1000) break;
  }
  return found;
}

async function findTester() {
  const rows = await must(db.from('users').select('id, auth_id, email').eq('email', TESTER_EMAIL), 'find tester');
  return rows[0] ?? null;
}

/** Every row that hangs off the seeded profiles, per table. What --wipe removes. */
async function seededFootprint(profileIds, testerId) {
  if (profileIds.length === 0) return { tables: {}, notificationIds: [], tombstoneIds: [] };
  const ids = `(${profileIds.join(',')})`;
  const count = (q, what) => must(q, what);
  const head = { count: 'exact', head: true };
  const tables = {
    users: await count(db.from('users').select('id', head).in('id', profileIds), 'count users'),
    user_photos: await count(db.from('user_photos').select('id', head).in('user_id', profileIds), 'count photos'),
    user_prompts: await count(db.from('user_prompts').select('id', head).in('user_id', profileIds), 'count prompts'),
    swipes: await count(db.from('swipes').select('id', head).or(`swiper_id.in.${ids},swiped_id.in.${ids}`), 'count swipes'),
    matches: await count(db.from('matches').select('id', head).or(`user1_id.in.${ids},user2_id.in.${ids}`), 'count matches'),
  };
  const matchIds = (await must(db.from('matches').select('id').or(`user1_id.in.${ids},user2_id.in.${ids}`), 'list matches')).map((m) => m.id);
  tables.messages = matchIds.length
    ? await count(db.from('messages').select('id', head).in('match_id', matchIds), 'count messages')
    : 0;
  const ownQueue = await count(db.from('notification_queue').select('id', head).in('user_id', profileIds), 'count own queue');

  // Queue rows addressed to the tester about a seeded person: they do not cascade.
  let notificationIds = [];
  if (testerId) {
    const rows = await must(
      db.from('notification_queue').select('id, data').eq('user_id', testerId),
      'list tester queue',
    );
    const seeded = new Set([...profileIds, ...matchIds]);
    notificationIds = rows
      .filter((r) => ['userId', 'senderId', 'matchId', 'likerId'].some((k) => seeded.has(r.data?.[k])))
      .map((r) => r.id);
  }
  tables.notification_queue = ownQueue + notificationIds.length;
  const tombstoneIds = (await must(db.from('deleted_accounts').select('id').in('user_id', profileIds), 'list tombstones')).map((t) => t.id);
  tables.deleted_accounts = tombstoneIds.length;
  return { tables, notificationIds, tombstoneIds };
}

async function tableTotals() {
  const out = {};
  for (const t of ['users', 'user_photos', 'user_prompts', 'swipes', 'matches', 'messages', 'notification_queue', 'deleted_accounts']) {
    out[t] = await must(db.from(t).select('*', { count: 'exact', head: true }), `total ${t}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// --wipe
// ---------------------------------------------------------------------------------------------

async function wipe() {
  const authUsers = await listSeededAuthUsers();
  const authIds = authUsers.map((u) => u.id);
  const profiles = authIds.length
    ? await must(db.from('users').select('id, email').in('auth_id', authIds), 'list seeded profiles')
    : [];
  const stray = profiles.filter((p) => !p.email.endsWith(`@${SEED_DOMAIN}`));
  if (stray.length) throw new Error(`refusing: a seeded auth user owns a non-seed profile: ${stray.map((p) => p.email)}`);
  const tester = await findTester();
  const fp = await seededFootprint(profiles.map((p) => p.id), tester?.id);

  console.log(`seeded auth users: ${authUsers.length}`);
  console.log('rows that hang off them, per table:', fp.tables);
  if (DRY_RUN) {
    console.log('dry run: nothing deleted');
    return { authUsers: authUsers.length, ...fp.tables };
  }

  const before = await tableTotals();
  if (fp.notificationIds.length) await must(db.from('notification_queue').delete().in('id', fp.notificationIds), 'delete tester queue rows');
  for (const id of authIds) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error(`deleteUser ${id}: ${error.message}`);
  }
  // Written by users_record_deletion during the delete above, so read them again afterwards.
  const ids = profiles.map((p) => p.id);
  if (ids.length) await must(db.from('deleted_accounts').delete().in('user_id', ids), 'delete tombstones');
  const after = await tableTotals();
  const removed = Object.fromEntries(Object.keys(before).map((t) => [t, before[t] - after[t]]));
  console.log('removed per table:', removed);
  const left = await listSeededAuthUsers();
  if (left.length) throw new Error(`${left.length} seeded auth users survived the wipe`);
  return removed;
}

// ---------------------------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------------------------

async function seed() {
  const existing = await listSeededAuthUsers();
  if (existing.length) {
    console.error(`${existing.length} seeded accounts already exist; run --wipe first`);
    process.exit(1);
  }
  const people = buildPeople();
  const tester = await findTester();
  if (!tester) console.warn(`no profile for ${TESTER_EMAIL}; seeding without tester likes/matches`);

  const women = people.filter((p) => p.profile.gender === 'female');
  const likersOfTester = women.slice(0, 10); // appear first in the tester's deck
  const matchesWithTester = women.slice(10, 16); // 4 with unread messages, 2 brand new
  const created = { auth: 0, users: 0, user_photos: 0, user_prompts: 0, swipes: 0, matches: 0, messages: 0 };

  if (DRY_RUN) {
    console.log(`would create ${people.length} people:`);
    for (const p of people) console.log(`  ${p.email}  ${p.profile.first_name} ${p.profile.last_name}, ${p.profile.gender}, ${p.profile.date_of_birth}, ${p.profile.current_city}`);
    console.log(`tester ${TESTER_EMAIL}: ${likersOfTester.length} incoming likes, ${matchesWithTester.length} matches`);
    return;
  }

  const password = process.env.SEED_PASSWORD;
  for (const p of people) {
    const { data, error } = await db.auth.admin.createUser({
      email: p.email,
      password: password || randomBytes(24).toString('base64url'),
      email_confirm: true,
      app_metadata: { mazal_seed: true },
      user_metadata: { first_name: p.profile.first_name },
    });
    if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
    created.auth++;
    const [row] = await must(
      db.from('users').insert({ ...p.profile, auth_id: data.user.id, email: p.email }).select('id'),
      `insert profile ${p.email}`,
    );
    p.id = row.id;
    created.users++;
    await must(db.from('user_photos').insert(photosFor(p).map((x) => ({ ...x, user_id: p.id }))), `photos ${p.email}`);
    created.user_photos += 3;
    await must(db.from('user_prompts').insert(p.prompts.map((x) => ({ ...x, user_id: p.id }))), `prompts ${p.email}`);
    created.user_prompts += p.prompts.length;
  }

  const swipe = async (from, to, action) => {
    await must(db.from('swipes').insert({ swiper_id: from, swiped_id: to, action }), `swipe ${from}->${to}`);
    created.swipes++;
  };
  const match = async (a, b, at) => {
    const [user1_id, user2_id] = [a, b].sort(); // matches_check orders the pair
    const [m] = await must(db.from('matches').insert({ user1_id, user2_id, created_at: at }).select('id'), 'match');
    created.matches++;
    return m.id;
  };
  const say = async (matchId, senderId, lines, startMinutesAgo) => {
    for (const [i, content] of lines.entries()) {
      const at = new Date(Date.now() - (startMinutesAgo - i * 3) * 60_000).toISOString();
      await must(db.from('messages').insert({ match_id: matchId, sender_id: senderId, content, message_type: 'text', created_at: at }), 'message');
      created.messages++;
    }
  };
  const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

  if (tester) {
    for (const [i, p] of likersOfTester.entries()) await swipe(p.id, tester.id, i < 2 ? 'super_like' : 'like');
    for (const [i, p] of matchesWithTester.entries()) {
      await swipe(p.id, tester.id, 'like');
      const m = await match(p.id, tester.id, ago(2 + i * 9));
      // A match always has the tester's like behind it, and the deck hides only people the
      // tester has swiped on, so without this row the match would also be in their deck.
      // Inserted after the match, so check_for_match hits ON CONFLICT and makes no second one.
      await swipe(tester.id, p.id, 'like');
      if (i < OPENERS.length - 1) await say(m, p.id, OPENERS[i], 60 + i * 200);
    }
  }

  // Among the fake people: a busy little network nobody but a signed-in seed account sees.
  const men = people.filter((p) => p.profile.gender === 'male');
  const others = people.filter((p) => !likersOfTester.includes(p) && !matchesWithTester.includes(p));
  for (const [i, m] of men.slice(0, 12).entries()) {
    const targets = pickN(women.slice(16), 4);
    for (const w of targets) await swipe(m.id, w.id, rand() < 0.75 ? 'like' : 'pass');
    if (i < 8) {
      const w = targets[0];
      // The trigger made a match if she liked him back; make sure she does, then read it.
      await swipe(w.id, m.id, 'like').catch(() => {});
      const [a, b] = [m.id, w.id].sort();
      const rows = await must(db.from('matches').select('id').eq('user1_id', a).eq('user2_id', b), 'read match');
      if (rows[0]) {
        created.matches++;
        if (i < 5) await say(rows[0].id, w.id, OPENERS[(i + 1) % OPENERS.length], 300 + i * 60);
      }
    }
  }
  for (const p of pickN(others, 10)) {
    const q = pick(others);
    if (q !== p) await swipe(p.id, q.id, 'pass').catch(() => {});
  }

  // Every match and message above queued a push. None of these people exist; drop them.
  const fp = await seededFootprint(people.map((p) => p.id), tester?.id);
  if (fp.notificationIds.length) await must(db.from('notification_queue').delete().in('id', fp.notificationIds), 'drop tester pushes');
  await must(db.from('notification_queue').delete().in('user_id', people.map((p) => p.id)), 'drop seed pushes');

  console.log('created:', created);
  const after = await seededFootprint(people.map((p) => p.id), tester?.id);
  console.log('seeded rows now in each table:', after.tables);
  if (password) console.log('every seeded account signs in with SEED_PASSWORD');
}

try {
  await (WIPE ? wipe() : seed());
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
