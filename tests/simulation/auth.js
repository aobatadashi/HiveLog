/**
 * Auth module — reads .env.local, creates authenticated Supabase client.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

const ENV_PATH = resolve(process.cwd(), '.env.local');

export function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    throw new Error('.env.local not found. Run from the project root.');
  }
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

export function appendEnv(key, value) {
  let content = '';
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, 'utf-8');
    // Replace existing key if present
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
      writeFileSync(ENV_PATH, content);
      return;
    }
  }
  writeFileSync(ENV_PATH, content + `\n${key}=${value}\n`);
}

export function createSupabase(env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  }
  return createClient(url, key);
}

export async function authenticate(supabase, env) {
  const email = env.SIM_USER_EMAIL;
  const password = env.SIM_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Missing SIM_USER_EMAIL or SIM_USER_PASSWORD in .env.local.\n' +
      'Run: node tests/setup_sim_user.js first.'
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed: ${error.message}`);
  return data.user;
}

export async function getAuthenticatedClient() {
  const env = loadEnv();
  const supabase = createSupabase(env);
  const user = await authenticate(supabase, env);
  return { supabase, user, env };
}
