import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public client for client-side operations
// This client is safe to use in the browser.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
