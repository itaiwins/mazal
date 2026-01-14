# Post-Launch Feature Enhancements

These features are planned for future releases after the initial App Store launch.

---

## High Priority

### 1. Push Notifications
- Match alerts when someone likes you back
- New message notifications
- Safta recommendation received
- Weekly activity digest
- "Your profile is expiring" reminders

**Implementation:** Expo Notifications + Supabase Edge Functions for triggers

### 2. Analytics Dashboard
- User engagement metrics
- Conversion funnel (signup → onboarding → active)
- Premium conversion rates
- Match success rates
- Retention metrics

**Implementation:** Mixpanel or Amplitude integration

### 3. Safta Analytics (Pro Feature)
- Track recommendation success rate
- See which profiles got matches
- Monthly matchmaking report
- Leaderboard for top matchmakers

### 4. Photo Verification
- AWS Rekognition selfie matching
- Verify profile photos are real
- "Verified" badge on profiles
- Reduce catfishing

**Implementation:** Already partially built in `/profile/verify.tsx`

---

## Medium Priority

### 5. Video Profiles
- 30-second video intros
- Show personality beyond photos
- Premium feature (Gold+)

**Implementation:** Expo Camera + Supabase Storage

### 6. Voice Messages
- Send voice notes in chat
- Premium feature
- Transcription option

### 7. Events / Speed Dating
- Virtual Jewish singles events
- Video chat rooms
- Calendar integration
- Premium or paid tickets

### 8. Icebreaker Games
- Question games in chat
- "This or That" matcher
- Compatibility quizzes

### 9. Profile Boosts
- Get featured in discovery
- Timed visibility increase
- Premium consumable

---

## Revenue Optimization

### 10. A/B Test Pricing
- Test different price points
- Regional pricing
- Experiment with free trial lengths

### 11. Promotional Offers
- First month free trials
- Holiday discounts (Hanukkah, Passover)
- Referral bonuses
- Student discounts

### 12. Referral Program
- Invite friends for premium days
- Viral growth mechanics
- Referral tracking

### 13. Gift Subscriptions
- Buy premium for a friend
- Perfect for Saftas gifting to grandchildren

---

## Community Features

### 14. Success Stories
- User-submitted engagement/wedding stories
- Social proof on landing pages
- Community celebration

### 15. Dating Tips Blog
- In-app content
- Jewish dating advice
- Relationship articles

### 16. Shadchan Certification
- Verify professional matchmakers
- Ratings and reviews
- Premium directory placement

---

## Technical Improvements

### 17. Android Release
- Google Play Store submission
- Android-specific optimizations
- Google Pay integration

### 18. Web App
- React Native Web port
- Desktop experience
- Profile management online

### 19. Apple Watch App
- Match notifications
- Quick profile view
- Message alerts

### 20. Siri Shortcuts
- "Open my matches"
- "Check new likes"

---

## Privacy & Safety

### 21. Incognito Mode (Platinum)
- Browse without being seen
- Only visible to people you like

### 22. Enhanced Blocking
- Block by phone number
- Import contacts to hide from

### 23. Safety Features
- Share date location with friend
- Emergency contact
- Date check-in reminders

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Push Notifications | High | Medium | P0 |
| Photo Verification | High | Medium | P0 |
| Analytics Dashboard | High | Medium | P1 |
| Safta Analytics | Medium | Low | P1 |
| Video Profiles | Medium | High | P2 |
| Events | High | High | P2 |
| Referral Program | High | Medium | P1 |
| Android Release | High | Medium | P1 |
| Voice Messages | Low | Medium | P3 |
| Web App | Medium | High | P3 |
