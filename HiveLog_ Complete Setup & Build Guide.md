# HiveLog: Complete Setup & Build Guide

This guide provides step-by-step instructions to initialize your project, set up your infrastructure (Supabase & Vercel), and use Claude Code to autonomously build the HiveLog MVP.

## Phase 1: Infrastructure Setup

### 1. Supabase (Database & Backend)
Claude Code can write the SQL, but you need to create the project and get the API keys.

1. Go to [Supabase](https://supabase.com) and create a new project.
2. **Get your API Keys:** Go to **Project Settings > API**. Copy your `Project URL` and `anon public` key. You will need these later.
3. **Configure Phone Auth:**
   - Go to **Authentication > Providers**.
   - Enable **Phone** provider.
   - You will need an SMS provider (like Twilio). Create a Twilio account, get a phone number, and copy your Account SID, Auth Token, and Message Service SID.
   - Paste these Twilio credentials into the Supabase Phone Auth settings.
   - Note: In Supabase Auth settings, disable "Confirm email" and ensure "Enable Phone Signup" is ON.

### 2. Vercel (Hosting)
1. Create a free account on [Vercel](https://vercel.com).
2. You will link this to your GitHub repository once Claude Code generates the project.

---

## Phase 2: Local Project Initialization

Before handing the reins to Claude Code, set up your empty project folder.

1. Open your terminal.
2. Create a new directory and navigate into it:
   ```bash
   mkdir hivelog
   cd hivelog
   ```
3. Place the `requirements.md` and `CLAUDE.md` files (provided with this guide) directly into this root folder.
4. Initialize a Git repository:
   ```bash
   git init
   ```

---

## Phase 3: Claude Code Setup

### 1. Install Claude Code
If you haven't installed Claude Code yet, run the following command in your terminal:

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://claude.ai/install.ps1 | iex
```

### 2. Authenticate
Run the Claude Code CLI and log in with your Claude Pro, Max, or Console account:
```bash
claude
```
Follow the browser prompts to authenticate.

---

## Phase 4: The Autonomous Build (Day 3 Kickoff)

With your folder prepared (`requirements.md` and `CLAUDE.md` in place), you are ready to kick off the build.

1. In your terminal, ensure you are in the `hivelog` directory.
2. Start Claude Code:
   ```bash
   claude
   ```
3. **Paste the following exact prompt to kick off the build:**

> "Read the `@requirements.md` file. I want you to autonomously scaffold and build the complete HiveLog MVP based on these specifications. 
> 
> Please execute this step-by-step:
> 1. Initialize a new Vite + React project in this directory (use vanilla React, no TypeScript unless you strongly prefer it for the PWA setup, but keep it simple).
> 2. Install necessary dependencies: `@supabase/supabase-js`, `vite-plugin-pwa`, `react-router-dom`, and `idb` (for offline IndexedDB queue).
> 3. Create the Supabase SQL schema file (including tables for yards, colonies, events, and all necessary Row Level Security policies). Save this as `supabase_schema.sql` in the root so I can run it in my Supabase dashboard later.
> 4. Build the UI components and screens as defined in the spec, prioritizing massive touch targets and high contrast.
> 5. Implement the Supabase Phone + PIN auth flow.
> 6. Implement the offline-first Service Worker and IndexedDB sync logic.
> 
> Use your best judgment for file structure. I have enabled 'Accept all' mode, so please proceed with creating and editing the files."

4. Claude Code will read your `CLAUDE.md` for context and `requirements.md` for the spec, and begin scaffolding the app, creating files, and writing code. Let it run.

---

## Phase 5: Connecting the Pieces

Once Claude Code finishes the build:

1. **Database Schema:** Claude generated a `supabase_schema.sql` file. Open your Supabase project dashboard, go to the **SQL Editor**, paste the contents of that file, and click **Run**. This creates your tables and RLS policies.
2. **Environment Variables:** Create a `.env.local` file in your project root and add your Supabase keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. **Test Locally:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` and test the phone login and offline functionality (you can simulate offline mode in Chrome DevTools > Network tab).

---

## Phase 6: Deployment (Day 6)

1. Commit your code to GitHub:
   ```bash
   git add .
   git commit -m "Initial MVP build"
   git branch -M main
   git remote add origin https://github.com/yourusername/hivelog.git
   git push -u origin main
   ```
2. Go to your Vercel dashboard and click **Add New > Project**.
3. Import your `hivelog` GitHub repository.
4. **Crucial Step:** In the Vercel deployment configuration, open the **Environment Variables** section and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. 

Once deployed, Vercel will give you a live URL. Text this link to your 3-5 beekeepers. Because we configured `vite-plugin-pwa`, when they open the link on their phones, they will be prompted to "Add to Home Screen".
