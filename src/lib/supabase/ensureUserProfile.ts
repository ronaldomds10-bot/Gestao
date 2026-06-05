import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";

const inFlightEnsures = new Map<string, Promise<void>>();
const completedEnsures = new Set<string>();

function getUserDisplayName(user: User) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return metadataName.trim() || user.email || "Usuario";
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function ensureProfile(user: User, name: string) {
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert([
    {
      user_id: user.id,
      email: user.email ?? "",
      name,
      full_name: name,
    },
  ]);

  if (insertError && !isDuplicateKeyError(insertError)) {
    throw insertError;
  }
}

async function ensureClient(user: User, name: string) {
  const { data: existingClient, error: selectError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingClient) {
    return;
  }

  const { error: insertError } = await supabase.from("clients").insert([
    {
      user_id: user.id,
      email: user.email ?? "",
      name,
      plan: "free",
      joined_at: getTodayDate(),
    },
  ]);

  if (insertError && !isDuplicateKeyError(insertError)) {
    throw insertError;
  }
}

export async function ensureUserProfile(user: User) {
  if (completedEnsures.has(user.id)) {
    return;
  }

  const currentEnsure = inFlightEnsures.get(user.id);
  if (currentEnsure) {
    return currentEnsure;
  }

  const ensurePromise = (async () => {
    const name = getUserDisplayName(user);
    await ensureProfile(user, name);
    await ensureClient(user, name);
    completedEnsures.add(user.id);
  })()
    .catch((error) => {
      console.error(
        "Nao foi possivel garantir o profile/client do usuario autenticado. Verifique RLS, policies e permissoes anon/authenticated no Supabase.",
        error,
      );
    })
    .finally(() => {
      inFlightEnsures.delete(user.id);
    });

  inFlightEnsures.set(user.id, ensurePromise);
  return ensurePromise;
}
