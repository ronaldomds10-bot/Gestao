/// <reference types="vite/client" />

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../services/supabaseTypes";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase Vite environment variables are not configured yet.");
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
);
