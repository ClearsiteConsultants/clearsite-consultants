import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if user is admin
export const ADMIN_EMAIL = "your-admin-email@example.com"; // Change this to your email

export const isAdmin = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.email === ADMIN_EMAIL;
};
