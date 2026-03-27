# Phone Auth Migration Guide

> **Current state:** HiveLog v1 uses email + password auth for fast local testing.
> When you're ready, follow this guide to switch to the final spec:
> **Phone number → SMS OTP (6-digit) → 4-digit PIN**

---

## Why phone auth?
- Beekeepers in the field don't want to type email addresses wearing gloves
- 4-digit PIN is faster to enter than a full password
- No email account required — just a phone number

---

## What you need before migrating

- [ ] Twilio account (twilio.com) — free trial is fine to start
- [ ] A Twilio phone number with SMS capability (~$1/month)
- [ ] A Twilio Messaging Service (Messaging → Services → Create)
- [ ] Three values from Twilio:
  - Account SID (starts `AC...`)
  - Auth Token
  - Messaging Service SID (starts `MG...`)

---

## Migration Steps

### 1. Configure Twilio in Supabase
1. Supabase Dashboard → **Authentication → Providers → Phone**
2. Toggle **Enable Phone provider** → ON
3. Set **SMS provider** to **Twilio**
4. Paste your Account SID, Auth Token, and Messaging Service SID
5. Click **Save**

### 2. Supabase Auth Settings
1. Authentication → **Settings**
2. Make sure **"Enable phone signup"** is ON
3. Set OTP expiry to `600` (10 minutes — useful in field conditions)

### 3. Replace Login.jsx
The original phone + OTP + PIN login code is preserved below.
Replace the contents of `src/pages/Login.jsx` with this implementation:

```
STEPS:
  PHONE      → user enters phone number
               → if returning: show PIN entry (STEPS.LOGIN_PIN)
               → if new: send OTP (STEPS.OTP)
  OTP        → verify 6-digit SMS code → go to SET_PIN
  SET_PIN    → first-time: set 4-digit PIN via supabase.auth.updateUser({ password: pin })
  LOGIN_PIN  → returning user: supabase.auth.signInWithPassword({ phone, password: pin })
  FORGOT_OTP → re-send OTP to phone → verify → go to RESET_PIN
  RESET_PIN  → supabase.auth.updateUser({ password: newPin })
```

Key Supabase calls:
```js
// Send OTP
supabase.auth.signInWithOtp({ phone })

// Verify OTP (new user)
supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })

// Set PIN after first OTP verify
supabase.auth.updateUser({ password: pin })

// Returning user login
supabase.auth.signInWithPassword({ phone, password: pin })
```

The `useAuth` hook and `supabaseClient.js` require **zero changes**.

### 4. Update SETUP.md
Remove the "disable email confirmation" note from Step 1d.
Add Twilio credentials steps (already documented in SETUP.md § Step 2).

### 5. Remove this file
Once phone auth is live and tested, delete `PHONE_AUTH_TODO.md`.

---

## Testing Phone Auth (free Twilio trial)
Twilio free trial only sends SMS to **verified numbers**.
Before going live, verify your test numbers:
Twilio Console → Phone Numbers → **Verified Caller IDs** → Add a number

For production use, upgrade your Twilio account (~$20 to remove trial restrictions).
