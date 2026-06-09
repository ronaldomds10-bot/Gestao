/// <reference types="vite/client" />

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../services/supabaseTypes";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required. Configure it in your environment variables.`);
  }

  return value;
}

function requireUrl(name: string, value: string | undefined) {
  const url = requireEnv(name, value);

  try {
    new URL(url);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  return url;
}

export const supabase = createClient<Database>(
  requireUrl("VITE_SUPABASE_URL", supabaseUrl),
  requireEnv("VITE_SUPABASE_ANON_KEY", supabaseAnonKey),
);
