# HiveLog — Infrastructure Setup Guide

Complete this guide **before** running the app. Takes ~20 minutes.

---

## Step 1 — Supabase (Database + Auth)

### 1a. Create a Supabase Project
1. Go to **[supabase.com](https://supabase.com)** → **New Project**
2. Name it `hivelog`, choose a region close to you, set a strong DB password
3. Wait ~2 minutes for it to provision

### 1b. Get Your API Keys
1. In your Supabase project → **Project Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon public** key → long JWT string starting with `eyJ...`
3. Open `.env.local` in this folder and paste them:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your_anon_key
   ```

### 1c. Run the Database Schema
1. In Supabase → **SQL Editor** → **New query**
2. Open `supabase_schema.sql` from this repo and paste the **entire contents**
3. Click **Run** — you should see success messages for all 3 tables + RLS policies

### 1d. Configure Email Auth (current v1 setup — no Twilio needed yet)
> Phone auth comes later. For now the app uses email + password — much faster to get started.

1. In Supabase → **Authentication** → **Settings** (left sidebar)
2. Under **User Signups**:
   - **Disable "Enable email confirmations"** — toggle it OFF
     *(This lets new accounts log in immediately without clicking a verification email)*
3. That's it — Email + Password is enabled by default in every Supabase project.

> **Switching to phone later?** See `PHONE_AUTH_TODO.md` in the project root for the full migration checklist.

---

## Step 2 — Twilio (SMS for OTP)

> Supabase uses Twilio to send the 6-digit OTP codes your users verify with.

### 2a. Create a Twilio Account
1. Go to **[twilio.com](https://www.twilio.com)** → **Sign up** (free trial works)
2. Verify your personal phone number during signup

### 2b. Get a Phone Number
1. Twilio Console → **Phone Numbers** → **Manage** → **Buy a number**
2. Search for a number with **SMS** capability in your country
3. Buy it (free trial credit covers this)

### 2c. Create a Messaging Service
1. Twilio Console → **Messaging** → **Services** → **Create Messaging Service**
2. Name it `HiveLog OTP`
3. Under **Sender Pool** → add the phone number you just bought
4. Copy the **Messaging Service SID** (starts with `MG...`)

### 2d. Collect Your Twilio Credentials
From the Twilio Console main dashboard, copy:
| Value | Where to find it | Looks like |
|---|---|---|
| Account SID | Dashboard (top of page) | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Auth Token | Dashboard (click "show") | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Messaging Service SID | Messaging → Services | `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

### 2e. Paste Credentials into Supabase
1. Back in Supabase → **Authentication** → **Providers** → **Phone**
2. Fill in:
   - **Twilio Account SID** → paste `AC...`
   - **Twilio Auth Token** → paste your token
   - **Twilio Message Service SID** → paste `MG...`
3. Click **Save**

### 2f. Test OTP (optional but recommended)
In Supabase → **Authentication** → **Users** → you can see users appear after first login.

---

## Step 3 — Local Development

```bash
# 1. Copy and fill in your env vars
cp .env.local.example .env.local
# (edit .env.local with your real Supabase URL and anon key)

# 2. Install dependencies (already done if you cloned fresh)
npm install

# 3. Start the dev server
npm run dev
# → Open http://localhost:5173
```

---

## Step 4 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → **New Project**
2. Import from GitHub → select `HiveLog` repo
3. Framework: **Vite** (auto-detected)
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy** — live URL in ~60 seconds

### Supabase CORS / Redirect URLs
After deploying, add your Vercel URL to Supabase:
1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://your-app.vercel.app`
3. **Redirect URLs**: add `https://your-app.vercel.app/**`

---

## Quick Reference — What Each Piece Does

| Service | Role in HiveLog |
|---|---|
| **Supabase** | PostgreSQL database + Row Level Security + Auth sessions |
| **Supabase Phone Auth** | Manages OTP flows, stores user sessions |
| **Twilio** | Sends the actual SMS text messages with OTP codes |
| **Vercel** | Hosts the built React/Vite app (static files + CDN) |
| **IndexedDB (idb)** | Local offline queue on the user's device |

---

## Troubleshooting

**"Invalid OTP" errors:**
- Make sure Twilio Messaging Service SID (not phone number SID) is entered in Supabase
- Check Twilio logs: Console → Monitor → Logs → Messaging

**"Row Level Security" errors in console:**
- Make sure you ran the full `supabase_schema.sql` — all RLS policies must exist
- Verify the user is authenticated before any DB query

**App works locally but not on Vercel:**
- Double-check env vars are set in Vercel project settings (not just `.env.local`)
- Vercel env vars are case-sensitive

**OTP never arrives:**
- Twilio free trial only sends to verified numbers — verify your test number in Twilio Console → Phone Numbers → Verified Caller IDs
