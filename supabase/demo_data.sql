-- =====================================================
-- MAZAL DEMO DATA
-- Run this AFTER creating a test user account
-- =====================================================

-- First, create some demo users (you'll need to update the auth_id after creating accounts)
-- For now, this creates profiles that will be visible as suggestions

-- Demo shadchanim (matchmakers)
INSERT INTO users (id, auth_id, first_name, last_name, email, gender, date_of_birth, current_city, current_state, current_country, is_active, profile_complete)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-shadchan-1', 'Sarah', 'Goldstein', 'sarah@demo.com', 'female', '1965-03-15', 'Brooklyn', 'NY', 'USA', true, true),
  ('22222222-2222-2222-2222-222222222222', 'demo-shadchan-2', 'Rabbi Moshe', 'Katz', 'moshe@demo.com', 'male', '1958-07-22', 'Lakewood', 'NJ', 'USA', true, true),
  ('33333333-3333-3333-3333-333333333333', 'demo-shadchan-3', 'Rivka', 'Cohen', 'rivka@demo.com', 'female', '1970-11-08', 'Los Angeles', 'CA', 'USA', true, true)
ON CONFLICT (id) DO NOTHING;

-- Demo singles for suggestions
INSERT INTO users (id, auth_id, first_name, last_name, email, gender, date_of_birth, current_city, current_state, current_country, is_active, profile_complete, bio)
VALUES
  -- Women
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'demo-user-1', 'Chana', 'Levy', 'chana@demo.com', 'female', '1998-05-12', 'Brooklyn', 'NY', 'USA', true, true, 'Passionate about chesed and education. Looking for a serious ben Torah.'),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'demo-user-2', 'Miriam', 'Schwartz', 'miriam@demo.com', 'female', '1997-08-25', 'Teaneck', 'NJ', 'USA', true, true, 'Software engineer with a love for learning. Modern Orthodox.'),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'demo-user-3', 'Shira', 'Berger', 'shira@demo.com', 'female', '1999-02-14', 'Los Angeles', 'CA', 'USA', true, true, 'Teacher by day, artist by night. Looking for someone who values growth.'),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'demo-user-4', 'Leah', 'Friedman', 'leah@demo.com', 'female', '1996-11-30', 'Chicago', 'IL', 'USA', true, true, 'Physical therapist who loves hiking and Shabbos hosting.'),
  -- Men
  ('bbbb1111-bbbb-1111-bbbb-111111111111', 'demo-user-5', 'Yosef', 'Klein', 'yosef@demo.com', 'male', '1996-03-18', 'Lakewood', 'NJ', 'USA', true, true, 'Learning in kollel, looking for a partner to build a bayis neeman.'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'demo-user-6', 'David', 'Stern', 'david@demo.com', 'male', '1995-09-07', 'Brooklyn', 'NY', 'USA', true, true, 'CPA with a morning seder. Balance of Torah and parnassah.'),
  ('bbbb3333-bbbb-3333-bbbb-333333333333', 'demo-user-7', 'Avi', 'Rosen', 'avi@demo.com', 'male', '1997-06-22', 'Monsey', 'NY', 'USA', true, true, 'Rebbe at a local yeshiva. Looking for a partner in avodas Hashem.'),
  ('bbbb4444-bbbb-4444-bbbb-444444444444', 'demo-user-8', 'Moshe', 'Weiss', 'moshe.weiss@demo.com', 'male', '1998-12-03', 'Baltimore', 'MD', 'USA', true, true, 'Medical student with a strong commitment to Torah values.')
ON CONFLICT (id) DO NOTHING;

-- Shidduch profiles for demo users
INSERT INTO shidduch_profiles (id, user_id, community, hebrew_name, hashkafa_details, father_name, father_occupation, mother_name, parents_status, num_siblings, birth_order, seminary_yeshiva, college_university, highest_degree, minyan_frequency, learning_schedule, kollel_interest, looking_for_description, age_range_min, age_range_max, preferred_communities, marriage_timeline, photos_visible_to, profile_visible, accepting_suggestions)
VALUES
  -- Women profiles
  ('cccc1111-cccc-1111-cccc-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'yeshivish', 'Chana bas Avraham', 'Grew up in a warm frum home. Values Torah learning and middos.', 'Avraham', 'Rabbi/Teacher', 'Devorah', 'married', 5, 2, 'BJJ Seminary', NULL, 'high_school', NULL, NULL, 'not_applicable', 'Looking for a serious learner with good middos. Someone who will be a true partner in building a Torah home. Values growth and self-improvement.', 23, 28, ARRAY['yeshivish', 'modern_orthodox_machmir'], 'within_year', 'shadchan_only', true, true),

  ('cccc2222-cccc-2222-cccc-222222222222', 'aaaa2222-aaaa-2222-aaaa-222222222222', 'modern_orthodox', 'Miriam bas Yitzchak', 'Modern Orthodox - values both secular and Torah education equally.', 'Yitzchak', 'Doctor', 'Rachel', 'married', 3, 1, 'Stern College', 'Columbia University', 'masters', NULL, NULL, 'not_applicable', 'Looking for someone who is intellectually curious, has a growth mindset, and can be my best friend. Career is important but so is building a Jewish home.', 25, 32, ARRAY['modern_orthodox', 'modern_orthodox_machmir'], 'one_to_two_years', 'everyone', true, true),

  ('cccc3333-cccc-3333-cccc-333333333333', 'aaaa3333-aaaa-3333-aaaa-333333333333', 'modern_orthodox_machmir', 'Shira bas Moshe', 'Committed to halacha with an appreciation for the arts and creativity.', 'Moshe', 'Accountant', 'Sarah', 'married', 4, 3, 'Midreshet Lindenbaum', 'UCLA', 'bachelors', NULL, NULL, 'not_applicable', 'Creative soul looking for someone who appreciates beauty in the world while staying grounded in Torah values. Love of Israel a plus!', 22, 27, ARRAY['modern_orthodox', 'modern_orthodox_machmir'], 'within_year', 'matches_only', true, true),

  ('cccc4444-cccc-4444-cccc-444444444444', 'aaaa4444-aaaa-4444-aaaa-444444444444', 'modern_orthodox', 'Leah bas David', 'Active in community chesed. Balances career with strong Jewish values.', 'David', 'Lawyer', 'Esther', 'married', 2, 1, 'MMY', 'University of Michigan', 'doctorate', NULL, NULL, 'not_applicable', 'Looking for a partner who values family, community involvement, and personal growth. Someone who can laugh at themselves and take life''s adventures together.', 26, 34, ARRAY['modern_orthodox'], 'flexible', 'everyone', true, true),

  -- Men profiles
  ('dddd1111-dddd-1111-dddd-111111111111', 'bbbb1111-bbbb-1111-bbbb-111111111111', 'yeshivish', 'Yosef ben Shlomo', 'Dedicated to Torah learning. Planning to learn for several years after marriage.', 'Shlomo', 'Business Owner', 'Chaya', 'married', 7, 4, 'Mir Yeshiva', NULL, 'rabbinical_ordination', 'three_times_daily', '8 hours daily', 'currently_in_kollel', 'Looking for an isha kesheira who values Torah and wants to build a bayis shel Torah. She should be supportive of long-term learning and have her own strengths.', 20, 24, ARRAY['yeshivish'], 'asap', 'shadchan_only', true, true),

  ('dddd2222-dddd-2222-dddd-222222222222', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'yeshivish', 'David ben Yaakov', 'Torah U''Parnassah. Works full time but maintains serious learning.', 'Yaakov', 'Real Estate', 'Rivka', 'married', 4, 2, 'Torah Vodaas', 'Brooklyn College', 'bachelors', 'three_times_daily', 'Morning seder + night seder', 'working', 'Seeking a partner who appreciates the balance of Torah and worldly responsibilities. Looking for warmth, intelligence, and shared values.', 23, 28, ARRAY['yeshivish', 'modern_orthodox_machmir'], 'within_year', 'matches_only', true, true),

  ('dddd3333-dddd-3333-dddd-333333333333', 'bbbb3333-bbbb-3333-bbbb-333333333333', 'yeshivish', 'Avi ben Chaim', 'Passionate mechanech dedicated to the next generation.', 'Chaim', 'Rebbe', 'Malka', 'married', 6, 1, 'Ner Yisroel', NULL, 'rabbinical_ordination', 'three_times_daily', 'Daily shiur + personal learning', 'working', 'Looking for someone who shares my passion for chinuch and wants to build a home of Torah, warmth, and hachnosas orchim.', 24, 29, ARRAY['yeshivish'], 'within_year', 'shadchan_only', true, true),

  ('dddd4444-dddd-4444-dddd-444444444444', 'bbbb4444-bbbb-4444-bbbb-444444444444', 'modern_orthodox_machmir', 'Moshe ben Eliyahu', 'Future doctor with deep commitment to halacha and helping others.', 'Eliyahu', 'Engineer', 'Naomi', 'married', 3, 2, 'Yeshivat Sha''alvim', 'Johns Hopkins', 'doctorate', 'daily', 'Daily daf + shiurim when possible', 'not_applicable', 'Looking for someone who is intellectually driven, has strong values, and wants to build a home that combines professional success with deep Jewish commitment.', 24, 30, ARRAY['modern_orthodox', 'modern_orthodox_machmir'], 'one_to_two_years', 'everyone', true, true)
ON CONFLICT (id) DO NOTHING;

-- Demo references
INSERT INTO shidduch_references (profile_id, reference_type, name, relationship, phone, email, best_contact_method)
VALUES
  ('cccc1111-cccc-1111-cccc-111111111111', 'rabbi', 'Rabbi Yehuda Green', 'Family Rav for 15 years', '555-0101', 'rabbi.green@demo.com', 'phone'),
  ('cccc1111-cccc-1111-cccc-111111111111', 'teacher', 'Mrs. Leah Tannenbaum', 'Seminary teacher', '555-0102', 'l.tannenbaum@demo.com', 'email'),
  ('cccc2222-cccc-2222-cccc-222222222222', 'rabbi', 'Rabbi Jonathan Sacks', 'Shul Rabbi', '555-0103', 'rabbi.sacks@demo.com', 'phone'),
  ('cccc2222-cccc-2222-cccc-222222222222', 'employer', 'Dr. Michael Chen', 'Manager at work', '555-0104', 'm.chen@demo.com', 'email'),
  ('dddd1111-dddd-1111-dddd-111111111111', 'rabbi', 'Rav Aharon Feldman', 'Rosh Yeshiva', '555-0105', NULL, 'phone'),
  ('dddd1111-dddd-1111-dddd-111111111111', 'teacher', 'Rabbi Shmuel Kamenetzky', 'Mashgiach', '555-0106', NULL, 'phone'),
  ('dddd2222-dddd-2222-dddd-222222222222', 'rabbi', 'Rabbi Yaakov Perlow', 'Family Rav', '555-0107', 'perlow@demo.com', 'phone'),
  ('dddd2222-dddd-2222-dddd-222222222222', 'employer', 'Mark Johnson', 'Senior Partner', '555-0108', 'mjohnson@demo.com', 'email')
ON CONFLICT DO NOTHING;

-- Create some demo suggestions (you'll need to replace YOUR_PROFILE_ID with your actual shidduch profile ID)
-- These will show up after you complete the shidduch onboarding

-- NOTE: Run this after you create your test account and complete shidduch onboarding:
-- 1. Get your shidduch profile ID from the shidduch_profiles table
-- 2. Replace 'YOUR_PROFILE_ID' with your actual ID
-- 3. Run the INSERT statements below

/*
-- Example suggestions for a female user:
INSERT INTO shidduch_suggestions (profile_a_id, profile_b_id, suggested_by_type, suggestion_reason, compatibility_notes, profile_a_status, profile_b_status)
VALUES
  ('YOUR_PROFILE_ID', 'dddd1111-dddd-1111-dddd-111111111111', 'shadchan', 'Both families have strong Torah backgrounds and similar hashkafas.', 'Similar values regarding kollel learning. Both from large families.', 'pending', 'interested'),
  ('YOUR_PROFILE_ID', 'dddd2222-dddd-2222-dddd-222222222222', 'shadchan', 'Great match - both value Torah U''Parnassah balance.', 'Both career-oriented with strong learning. Similar backgrounds.', 'pending', 'pending'),
  ('YOUR_PROFILE_ID', 'dddd4444-dddd-4444-dddd-444444444444', 'algorithm', 'High compatibility score based on hashkafa and interests.', 'Both intellectually driven. Geographic proximity in future.', 'pending', 'pending');

-- Example suggestions for a male user:
INSERT INTO shidduch_suggestions (profile_a_id, profile_b_id, suggested_by_type, suggestion_reason, compatibility_notes, profile_a_status, profile_b_status)
VALUES
  ('YOUR_PROFILE_ID', 'cccc1111-cccc-1111-cccc-111111111111', 'shadchan', 'She is supportive of kollel learning. Similar hashkafa.', 'Both from yeshivish backgrounds. Great family compatibility.', 'pending', 'interested'),
  ('YOUR_PROFILE_ID', 'cccc2222-cccc-2222-cccc-222222222222', 'shadchan', 'Both value intellectual growth alongside Torah.', 'Similar professional ambitions. Strong Jewish commitment.', 'pending', 'pending'),
  ('YOUR_PROFILE_ID', 'cccc3333-cccc-3333-cccc-333333333333', 'algorithm', 'Compatible hashkafa and shared creative interests.', 'Both appreciate arts/creativity within Torah framework.', 'pending', 'pending');
*/

-- Demo photos for profiles (placeholder URLs - replace with actual image URLs)
INSERT INTO user_photos (id, user_id, url, is_primary, "order", is_verified)
VALUES
  ('photo-a1', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'https://randomuser.me/api/portraits/women/1.jpg', true, 0, true),
  ('photo-a2', 'aaaa2222-aaaa-2222-aaaa-222222222222', 'https://randomuser.me/api/portraits/women/2.jpg', true, 0, true),
  ('photo-a3', 'aaaa3333-aaaa-3333-aaaa-333333333333', 'https://randomuser.me/api/portraits/women/3.jpg', true, 0, true),
  ('photo-a4', 'aaaa4444-aaaa-4444-aaaa-444444444444', 'https://randomuser.me/api/portraits/women/4.jpg', true, 0, true),
  ('photo-b1', 'bbbb1111-bbbb-1111-bbbb-111111111111', 'https://randomuser.me/api/portraits/men/1.jpg', true, 0, true),
  ('photo-b2', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'https://randomuser.me/api/portraits/men/2.jpg', true, 0, true),
  ('photo-b3', 'bbbb3333-bbbb-3333-bbbb-333333333333', 'https://randomuser.me/api/portraits/men/3.jpg', true, 0, true),
  ('photo-b4', 'bbbb4444-bbbb-4444-bbbb-444444444444', 'https://randomuser.me/api/portraits/men/4.jpg', true, 0, true)
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Demo data inserted successfully! Create a test account and complete shidduch onboarding to see suggestions.' as message;
