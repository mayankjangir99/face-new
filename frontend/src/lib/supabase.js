import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.');
}

// This browser client deliberately receives only the publishable key. Keep all
// secret/service keys in server-side code or Supabase Edge Functions.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
