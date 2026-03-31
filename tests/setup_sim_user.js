#!/usr/bin/env node
/**
 * Setup simulation test user in Supabase.
 * Creates jake.tanner@hivelog-sim.test and writes credentials to .env.local.
 */
import { loadEnv, appendEnv, createSupabase } from './simulation/auth.js';

const EMAIL = 'jake.tanner@hivelog-sim.test';
const PASSWORD = 'SimTest2026!';

async function main() {
  console.log('=== HiveLog Simulation: User Setup ===\n');

  const env = loadEnv();
  const supabase = createSupabase(env);

  // Check if credentials already exist
  if (env.SIM_USER_EMAIL && env.SIM_USER_PASSWORD) {
    console.log('Simulation credentials already in .env.local. Trying sign-in...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: env.SIM_USER_EMAIL,
      password: env.SIM_USER_PASSWORD,
    });
    if (!error && data.user) {
      console.log(`Already set up. User ID: ${data.user.id}`);
      appendEnv('SIM_USER_ID', data.user.id);
      process.exit(0);
    }
    console.log('Existing credentials failed. Creating new user...');
  }

  // Try sign in first (user might already exist)
  {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (!error && data.user) {
      console.log(`User already exists. ID: ${data.user.id}`);
      appendEnv('SIM_USER_EMAIL', EMAIL);
      appendEnv('SIM_USER_PASSWORD', PASSWORD);
      appendEnv('SIM_USER_ID', data.user.id);
      console.log('Credentials written to .env.local');
      process.exit(0);
    }
  }

  // Create new user
  console.log(`Creating user: ${EMAIL}`);
  const { data, error } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error) {
    console.error(`Failed to create user: ${error.message}`);
    console.error('If email confirmation is required, disable it in Supabase Dashboard:');
    console.error('  Auth > Settings > Email Auth > "Confirm email" toggle OFF');
    process.exit(1);
  }

  if (!data.user) {
    console.error('No user returned. Check Supabase auth settings.');
    process.exit(1);
  }

  console.log(`User created. ID: ${data.user.id}`);

  // Write to .env.local
  appendEnv('SIM_USER_EMAIL', EMAIL);
  appendEnv('SIM_USER_PASSWORD', PASSWORD);
  appendEnv('SIM_USER_ID', data.user.id);

  console.log('Credentials written to .env.local:');
  console.log(`  SIM_USER_EMAIL=${EMAIL}`);
  console.log(`  SIM_USER_PASSWORD=${PASSWORD}`);
  console.log(`  SIM_USER_ID=${data.user.id}`);
  console.log('\nNext: node tests/seed_simulation.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
