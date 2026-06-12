import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bvoszzsyjnrsfntvsiiy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2b3N6enN5am5yc2ZudHZzaWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODY1NDAsImV4cCI6MjA5MzE2MjU0MH0.DU4Si4r-Ptk8s3RyZ_GGUyvI6L4g0zYN621a3G5hAhU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
