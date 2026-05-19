import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Ensure it is set in .env.local and that this module is only imported on the server.");
}

// Admin client for secure server-side operations (bypasses RLS)
// NEVER import this file in a Client Component ("use client").
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
