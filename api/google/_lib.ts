import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  redirect: (statusOrUrl: number | string, url?: string) => void;
};

type GoogleConnection = {
  id: string;
  user_id: string;
  google_email: string | null;
  refresh_token_encrypted: string;
  access_token_encrypted: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
};

type ProgramRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  name?: string | null;
  program_name?: string | null;
  airline?: string | null;
  balance: number | null;
  cpm?: number | null;
  expiration_date: string | null;
  calendar_sync_enabled?: boolean | null;
  google_event_id: string | null;
  account_name?: string | null;
  program_account_name?: string | null;
  loyalty_account?: string | null;
  membership_number?: string | null;
  cpf?: string | null;
  holder_name?: string | null;
  client_name?: string | null;
  profile_name?: string | null;
  customer_name?: string | null;
  full_name?: string | null;
};

type CalendarSyncError = {
  table: "points_programs" | "miles_programs";
  programId: string;
  code?: string | number;
  message?: string;
};

type SkipReason =
  | "no_expiration_date"
  | "sync_disabled"
  | "missing_calendar_id"
  | "google_event_exists"
  | "invalid_date"
  | "google_upsert_failed"
  | "metadata_update_failed"
  | "unknown_error";

type SkippedByReason = Record<SkipReason, number>;

type SyncItemSummary = {
  type: "points" | "miles";
  program: string;
  action: "updated" | "created" | "recreated" | "skipped";
  googleEventIdPresent: boolean;
};

type GoogleCalendarEventPayload = {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
};

type GoogleCalendarEventSnapshot = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type GoogleCalendarItemResult = {
  clientId: string | null;
  clientName: string;
  program: string;
  amount: string;
  type: "Pontos" | "Milhas";
  expiration_date: string | null;
  expirationDate: string | null;
  reminderDate: string | null;
  eventDate: string | null;
  accountName?: string | null;
  holderName?: string | null;
  maskedCpf?: string | null;
  action: "created" | "updated" | "recreated" | "failed";
  calendarId: string;
  googleEventId: string | null;
  googleHtmlLink: string | null;
  googleSummary: string | null;
  googleDescription: string | null;
  googleStart: GoogleCalendarEventSnapshot["start"] | null;
  googleEnd: GoogleCalendarEventSnapshot["end"] | null;
  verified: boolean;
  error?: string | null;
};

type GoogleCalendarSyncResult = {
  ok: boolean;
  partial: boolean;
  connected: boolean;
  eligibleCount: number;
  createdCount: number;
  updatedCount: number;
  recreatedCount: number;
  googleEventExistsCount: number;
  skippedCount: number;
  skippedByReason: SkippedByReason;
  items: GoogleCalendarItemResult[];
  errors: CalendarSyncError[];
};

const calendarScope = process.env.GOOGLE_CALENDAR_SCOPES || "https://www.googleapis.com/auth/calendar.events";
const fallbackAppUrl = "https://gestao-lilac.vercel.app";
const googleSyncEnvNames = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GOOGLE_CALENDAR_SCOPES",
  "APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEYY",
  "TOKEN_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_STATE_SECRET",
] as const;

export function logGoogleSyncEnvPresence() {
  console.log("[google-sync] envs presentes", Object.fromEntries(
    googleSyncEnvNames.map((name) => [name, Boolean(process.env[name])]),
  ));
}

function getSafeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: undefined, message: error instanceof Error ? error.message : String(error) };
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" || typeof record.code === "number" ? record.code : undefined,
    message: typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : undefined,
  };
}

export function logGoogleSyncSupabaseError(context: string, error: unknown) {
  console.error("[google-sync] erro Supabase", { context, ...getSafeErrorDetails(error) });
}

export function logGoogleSyncGoogleError(context: string, error: unknown) {
  console.error("[google-sync] erro Google Calendar", { context, ...getSafeErrorDetails(error) });
}

function getCalendarSyncError(table: "points_programs" | "miles_programs", programId: string, error: unknown): CalendarSyncError {
  return { table, programId, ...getSafeErrorDetails(error) };
}

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function getAppUrl(req?: ApiRequest) {
  const configuredUrl = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configuredUrl) {
    return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
  }

  const host = req?.headers["x-forwarded-host"] || req?.headers.host;
  const resolvedHost = Array.isArray(host) ? host[0] : host;
  return resolvedHost ? `https://${resolvedHost}` : fallbackAppUrl;
}

export function getRedirectUri(req?: ApiRequest) {
  return process.env.GOOGLE_REDIRECT_URI || `${getAppUrl(req)}/api/google/callback`;
}

export function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL || getRequiredEnv("VITE_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getBearerToken(req: ApiRequest) {
  const header = req.headers.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function getAuthenticatedUser(req: ApiRequest) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new ApiError(401, "Sessão não encontrada.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new ApiError(401, "Sessão inválida.");
  }

  return data.user;
}

export function createGoogleAuthUrl(req: ApiRequest, userId: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: calendarScope,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState({
      userId,
      redirectTo: `${getAppUrl(req)}/?googleCalendar=connected`,
      exp: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(12).toString("hex"),
    }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(req: ApiRequest, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getRedirectUri(req),
      grant_type: "authorization_code",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    logGoogleSyncGoogleError("exchange_code_for_tokens", payload);
    throw new ApiError(400, "Não foi possível conectar ao Google Agenda.", payload);
  }

  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function refreshAccessToken(connection: GoogleConnection) {
  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    logGoogleSyncGoogleError("refresh_access_token", payload);
    throw new ApiError(401, "Conexão com Google Agenda expirada.", payload);
  }

  return payload as {
    access_token: string;
    expires_in?: number;
  };
}

export async function getGoogleEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload.email === "string" ? payload.email : null;
}

export async function getConnection(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logGoogleSyncSupabaseError("get_connection", error);
    throw new ApiError(500, "Não foi possível carregar conexão Google.", error);
  }
  return data as GoogleConnection | null;
}

export async function upsertConnection(userId: string, tokens: { access_token: string; refresh_token?: string; expires_in?: number }) {
  const existing = await getConnection(userId);
  const refreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existing?.refresh_token_encrypted;

  if (!refreshToken) {
    throw new ApiError(400, "Permissão offline do Google não retornou refresh token. Reconecte a conta.");
  }

  const googleEmail = await getGoogleEmail(tokens.access_token);
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("google_calendar_connections")
    .upsert({
      user_id: userId,
      google_email: googleEmail,
      refresh_token_encrypted: refreshToken,
      access_token_encrypted: encryptSecret(tokens.access_token),
      access_token_expires_at: expiresAt,
      calendar_id: existing?.calendar_id ?? "primary",
    }, { onConflict: "user_id" });

  if (error) {
    logGoogleSyncSupabaseError("upsert_connection", error);
    throw new ApiError(500, "Não foi possível salvar conexão Google.", error);
  }
}

export async function updateConnectionAccessToken(connection: GoogleConnection, accessToken: string, expiresIn = 3600) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("google_calendar_connections")
    .update({
      access_token_encrypted: encryptSecret(accessToken),
      access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
    .eq("id", connection.id);
}

export async function revokeConnection(connection: GoogleConnection) {
  const token = decryptSecret(connection.refresh_token_encrypted);
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

export async function syncCalendarEvents(userId: string, clientId: string | undefined, connection: GoogleConnection) {
  const refreshed = await refreshAccessToken(connection);
  await updateConnectionAccessToken(connection, refreshed.access_token, refreshed.expires_in);
  const skippedByReason = createSkippedByReason();
  const items: GoogleCalendarItemResult[] = [];

  const supabase = getSupabaseAdmin();
  // Google Calendar is connected once per logged-in user; clientId only scopes which records are synced.
  const calendarId = connection.calendar_id || "primary";
  const clientsResult = await supabase
    .from("clients")
    .select("id,name,email,phone,plan,local_id")
    .eq("user_id", userId);

  console.log("GOOGLE CALENDAR CALENDAR_ID", calendarId);
  console.log("GOOGLE SYNC SELECTED CLIENT ID", clientId ?? null);
  console.log("GOOGLE SYNC AUTH USER ID", userId);
  console.log("GOOGLE SYNC HAS GOOGLE TOKENS", Boolean(connection.refresh_token_encrypted || connection.access_token_encrypted));
  if (clientsResult.error) {
    logGoogleSyncSupabaseError("select_clients", clientsResult.error);
    throw new ApiError(500, "Não foi possível carregar clientes.", clientsResult.error);
  }

  const clientMap = new Map<string, { id: string; name?: string | null; email?: string | null }>(
    (clientsResult.data ?? []).map((row: Record<string, unknown>) => [
      String(row.id),
      {
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : null,
        email: typeof row.email === "string" ? row.email : null,
      },
    ]),
  );
  const selectedClient = clientId ? clientMap.get(clientId) ?? null : null;
  const selectedClientName = resolveClientName(selectedClient);
  console.log("GOOGLE SYNC SELECTED CLIENT", { clientId: clientId ?? null, clientName: selectedClientName });
  console.log("[google-sync] clientId:", clientId ?? null);
  console.log("[google-sync] clientName:", selectedClientName);
  if (selectedClientName === "Não identificado") {
    console.warn("[google-sync] clientName não encontrado", { clientId });
  }

  const [pointsResult, milesResult] = await Promise.all([
    selectPrograms("points_programs", userId, clientId),
    selectPrograms("miles_programs", userId, clientId),
  ]);

  if (pointsResult.error) {
    logGoogleSyncSupabaseError("select_points_programs", pointsResult.error);
    throw new ApiError(500, "Não foi possível carregar pontos.", pointsResult.error);
  }
  if (milesResult.error) {
    logGoogleSyncSupabaseError("select_miles_programs", milesResult.error);
    throw new ApiError(500, "Não foi possível carregar milhas.", milesResult.error);
  }
  const candidates = [
    ...(pointsResult.data ?? []).map((program: ProgramRow) => ({ type: "points" as const, kind: "Pontos" as const, table: "points_programs" as const, program })),
    ...(milesResult.data ?? []).map((program: ProgramRow) => ({ type: "miles" as const, kind: "Milhas" as const, table: "miles_programs" as const, program })),
  ];
  const expirations: typeof candidates = [];

  for (const item of candidates) {
    const programName = getProgramName(item.program);
    const skipReason = getEligibilitySkipReason(item.program, calendarId);

    console.log("[google-sync] eligible item check", {
      type: item.type,
      program: programName,
      expiration_date: item.program.expiration_date,
      calendar_sync_enabled: item.program.calendar_sync_enabled,
      google_event_id: item.program.google_event_id,
      skipReason,
    });

    if (skipReason) {
      skippedByReason[skipReason] += 1;
      continue;
    }

    if (getDaysRemaining(item.program.expiration_date as string) <= 730) {
      expirations.push(item);
    }
  }

  expirations.sort((a, b) => getDaysRemaining(a.program.expiration_date as string) - getDaysRemaining(b.program.expiration_date as string));

  console.log("[google-sync] vencimentos encontrados", { quantidade: expirations.length });
  console.log("[google-sync] eligible count", { count: expirations.length });
  console.log("GOOGLE SYNC ELIGIBLE COUNT", expirations.length);

  let createdCount = 0;
  let updatedCount = 0;
  let recreatedCount = 0;
  let googleEventExistsCount = 0;
  const errors: CalendarSyncError[] = [];

  for (const item of expirations) {
    const programClientId = item.program.client_id ?? clientId ?? null;
    const clientName = selectedClientName;
    const event = buildCalendarEvent(item.kind, item.program, clientName);
    console.log("GOOGLE SYNC SELECTED CLIENT", { clientId: programClientId, clientName });
    console.log("GOOGLE CALENDAR EVENT SUMMARY", event.summary);
    console.log("GOOGLE CALENDAR EVENT DESCRIPTION", event.description);
    const eventId = item.program.google_event_id || deterministicEventId(userId, item.table, item.program.id, item.program.expiration_date || "");
    try {
      if (item.program.google_event_id) {
        googleEventExistsCount += 1;
      }
      console.log("[google-sync] upsert event start", {
        type: item.type,
        program: getProgramName(item.program),
        expiration_date: item.program.expiration_date,
        calendar_sync_enabled: item.program.calendar_sync_enabled,
        google_event_id: item.program.google_event_id,
        eventId,
        action: item.program.google_event_id ? "update" : "create",
        creationSkipReason: item.program.google_event_id ? "google_event_exists" : null,
        skipReason: null,
      });
      const result = await upsertGoogleEvent(
        refreshed.access_token,
        calendarId,
        eventId,
        event,
        Boolean(item.program.google_event_id),
        () => clearProgramGoogleEventId(supabase, item.table, item.program.id, userId),
      );

      if (result.action === "created") createdCount += 1;
      if (result.action === "updated") updatedCount += 1;
      if (result.action === "recreated") recreatedCount += 1;

      const { error } = await supabase
        .from(item.table)
        .update({
          google_event_id: result.eventId,
          calendar_synced_at: new Date().toISOString(),
          calendar_sync_enabled: true,
        })
        .eq("id", item.program.id)
        .eq("user_id", userId);

      if (error) {
        logGoogleSyncSupabaseError("update_program_google_event_id", error);
        skippedByReason.metadata_update_failed += 1;
        console.log("[google-sync] eligible item skipped", {
          type: item.type,
          program: getProgramName(item.program),
          expiration_date: item.program.expiration_date,
          calendar_sync_enabled: item.program.calendar_sync_enabled,
          google_event_id: item.program.google_event_id,
          skipReason: "metadata_update_failed",
        });
        errors.push(getCalendarSyncError(item.table, item.program.id, error));
        items.push({
          clientId: programClientId,
          clientName,
          program: getProgramName(item.program),
          amount: formatProgramAmount(item.program, item.kind),
          type: item.kind,
          expiration_date: item.program.expiration_date,
          expirationDate: item.program.expiration_date,
          reminderDate: subtractMonths(item.program.expiration_date || "", 3),
          eventDate: compareLocalDates(subtractMonths(item.program.expiration_date || "", 3), formatLocalDate(new Date())) < 0
            ? formatLocalDate(new Date())
            : subtractMonths(item.program.expiration_date || "", 3),
          accountName: getAccountName(item.program),
          holderName: getHolderName(item.program),
          maskedCpf: getMaskedCpf(item.program.cpf),
          action: result.action,
          calendarId,
          googleEventId: result.event.id || result.eventId,
          googleHtmlLink: result.event.htmlLink || null,
          googleSummary: result.event.summary || event.summary,
          googleDescription: result.event.description || event.description,
          googleStart: result.event.start || event.start,
          googleEnd: result.event.end || event.end,
          verified: true,
          error: error instanceof Error ? error.message : "Não foi possível salvar o vínculo do evento no Supabase.",
        });
        continue;
      }

      items.push({
        clientId: programClientId,
        clientName,
        program: getProgramName(item.program),
        amount: formatProgramAmount(item.program, item.kind),
        type: item.kind,
        expiration_date: item.program.expiration_date,
        expirationDate: item.program.expiration_date,
        reminderDate: subtractMonths(item.program.expiration_date || "", 3),
        eventDate: compareLocalDates(subtractMonths(item.program.expiration_date || "", 3), formatLocalDate(new Date())) < 0
          ? formatLocalDate(new Date())
          : subtractMonths(item.program.expiration_date || "", 3),
        accountName: getAccountName(item.program),
        holderName: getHolderName(item.program),
        maskedCpf: getMaskedCpf(item.program.cpf),
        action: result.action,
        calendarId,
        googleEventId: result.event.id || result.eventId,
        googleHtmlLink: result.event.htmlLink || null,
        googleSummary: result.event.summary || event.summary,
        googleDescription: result.event.description || event.description,
        googleStart: result.event.start || event.start,
        googleEnd: result.event.end || event.end,
        verified: true,
        error: null,
      });
    } catch (error) {
      skippedByReason.google_upsert_failed += 1;
      console.log("[google-sync] eligible item skipped", {
        type: item.type,
        program: getProgramName(item.program),
        expiration_date: item.program.expiration_date,
        calendar_sync_enabled: item.program.calendar_sync_enabled,
        google_event_id: item.program.google_event_id,
        skipReason: "google_upsert_failed",
        error: getSafeErrorDetails(error),
      });
      items.push({
        clientId: programClientId,
        clientName,
        program: getProgramName(item.program),
        amount: formatProgramAmount(item.program, item.kind),
        type: item.kind,
        expiration_date: item.program.expiration_date,
        expirationDate: item.program.expiration_date,
        reminderDate: subtractMonths(item.program.expiration_date || "", 3),
        eventDate: compareLocalDates(subtractMonths(item.program.expiration_date || "", 3), formatLocalDate(new Date())) < 0
          ? formatLocalDate(new Date())
          : subtractMonths(item.program.expiration_date || "", 3),
        accountName: getAccountName(item.program),
        holderName: getHolderName(item.program),
        maskedCpf: getMaskedCpf(item.program.cpf),
        action: "failed",
        calendarId,
        googleEventId: eventId,
        googleHtmlLink: null,
        googleSummary: event.summary,
        googleDescription: event.description,
        googleStart: event.start,
        googleEnd: event.end,
        verified: false,
        error: error instanceof Error ? error.message : "Não foi possível sincronizar evento no Google Agenda.",
      });
      errors.push(getCalendarSyncError(item.table, item.program.id, error));
    }
  }

  const verifiedCount = items.filter((item) => item.verified).length;
  const successfulCount = createdCount + updatedCount + recreatedCount;
  const partial = errors.length > 0 || items.some((item) => item.action === "failed");
  const ok = errors.length === 0 && verifiedCount === successfulCount && (successfulCount > 0 || expirations.length === 0);
  const result = {
    ok,
    partial,
    connected: true,
    eligibleCount: expirations.length,
    createdCount,
    updatedCount,
    googleEventExistsCount,
    recreatedCount,
    skippedCount: getSkippedCount(skippedByReason),
    skippedByReason,
    items,
    errors,
  };

  console.log("[google-sync] resultado", {
    ok: result.ok,
    partial: result.partial,
    userId,
    eligibleCount: result.eligibleCount,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    googleEventExistsCount: result.googleEventExistsCount,
    recreatedCount: result.recreatedCount,
    skippedCount: result.skippedCount,
    skippedByReason: result.skippedByReason,
  });

  return result;
}

function selectPrograms(table: "points_programs" | "miles_programs", userId: string, clientId?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  return query;
}

function createSkippedByReason(): SkippedByReason {
  return {
    no_expiration_date: 0,
    sync_disabled: 0,
    missing_calendar_id: 0,
    google_event_exists: 0,
    invalid_date: 0,
    google_upsert_failed: 0,
    metadata_update_failed: 0,
    unknown_error: 0,
  };
}

function getSkippedCount(skippedByReason: SkippedByReason) {
  return Object.values(skippedByReason).reduce((sum, count) => sum + count, 0);
}

function getSyncItemSummary(
  item: { type: "points" | "miles"; program: ProgramRow },
  action: SyncItemSummary["action"],
): SyncItemSummary {
  return {
    type: item.type,
    program: getProgramName(item.program),
    action,
    googleEventIdPresent: Boolean(item.program.google_event_id),
  };
}

function getEligibilitySkipReason(program: ProgramRow, calendarId: string | null | undefined): SkipReason | null {
  if (!program.expiration_date) return "no_expiration_date";
  if (!isValidLocalDate(program.expiration_date)) return "invalid_date";
  if (program.calendar_sync_enabled === false) return "sync_disabled";
  if (!calendarId) return "missing_calendar_id";
  return null;
}

function getProgramName(program: ProgramRow) {
  return program.program_name || program.airline || program.name || "Programa";
}

function resolveClientName(client: { name?: string | null; email?: string | null } | null | undefined) {
  const name = client?.name?.trim();
  if (name) return name;
  return "Não identificado";
}

function getMaskedCpf(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return `***.***.***-${digits.slice(-2)}`;
}

function getAccountName(program: ProgramRow) {
  return (
    program.account_name
    || program.program_account_name
    || program.loyalty_account
    || program.membership_number
    || null
  );
}

function getHolderName(program: ProgramRow) {
  return program.holder_name || null;
}

function getProgramTypeLabel(kind: "Pontos" | "Milhas") {
  return kind === "Pontos" ? "Pontos" : "Milhas";
}

function formatProgramBalance(program: ProgramRow) {
  return Math.round(Number(program.balance ?? 0)).toLocaleString("pt-BR");
}

function formatProgramAmount(program: ProgramRow, kind: "Pontos" | "Milhas") {
  return `${formatProgramBalance(program)} ${kind.toLowerCase()}`;
}

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

async function clearProgramGoogleEventId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: "points_programs" | "miles_programs",
  programId: string,
  userId: string,
) {
  const { error } = await supabase
    .from(table)
    .update({
      google_event_id: null,
      calendar_synced_at: null,
    })
    .eq("id", programId)
    .eq("user_id", userId);

  if (error) {
    logGoogleSyncSupabaseError("clear_missing_google_event_id", error);
    throw new ApiError(500, "NÃ£o foi possÃ­vel limpar evento inexistente do Google Agenda.", error);
  }
}

function isValidLocalDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(`${date}T00:00:00`);

  return !Number.isNaN(parsed.getTime())
    && parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

function buildCalendarEvent(
  kind: "Pontos" | "Milhas",
  program: ProgramRow,
  clientName: string,
): GoogleCalendarEventPayload {
  const programName = getProgramName(program);
  const expirationDate = program.expiration_date || "";
  const reminderDate = subtractMonths(expirationDate, 3);
  const today = formatLocalDate(new Date());
  const eventDate = compareLocalDates(reminderDate, today) < 0 ? today : reminderDate;
  const daysRemaining = getDaysRemaining(expirationDate);
  const amount = formatProgramAmount(program, kind);
  const typeLabel = getProgramTypeLabel(kind);
  const statusLabel = getDaysLabel(daysRemaining);
  const estimatedValue = Number(program.balance ?? 0) * Number(program.cpm ?? 0);
  const accountName = getAccountName(program);
  const holderName = getHolderName(program);
  const maskedCpf = getMaskedCpf(program.cpf);
  const descriptionLines = [
    `Cliente/Perfil: ${clientName}`,
    `Programa: ${programName}`,
    `Quantidade: ${amount}`,
    `Tipo: ${typeLabel}`,
    `Data real de vencimento: ${formatPtBrDate(expirationDate)}`,
    `Aviso criado com 3 meses de antecedência: ${formatPtBrDate(reminderDate)}`,
    `Status no sistema: ${statusLabel}`,
    accountName ? `Conta vinculada: ${accountName}` : "",
    holderName ? `Titular: ${holderName}` : "",
    maskedCpf ? `CPF: ${maskedCpf}` : "",
    estimatedValue > 0 ? `Valor estimado: ${formatCurrencyBRL(estimatedValue)}` : "",
    "",
    "Atenção: estes pontos/milhas estão próximos do vencimento. Verifique possibilidade de uso, transferência, renovação ou emissão antes da data final.",
  ].filter(Boolean);

  return {
    summary: `Aviso: ${clientName} | ${programName} - ${amount} vencem em ${formatPtBrDate(expirationDate)}`,
    description: descriptionLines.join("\n"),
    start: { date: eventDate },
    end: { date: addDays(eventDate, 1) },
  };
}

async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventPayload,
  preferUpdate: boolean,
  clearStoredEventId: () => Promise<void>,
): Promise<{ eventId: string; action: "created" | "updated" | "recreated"; event: GoogleCalendarEventSnapshot }> {
  console.log("GOOGLE CALENDAR CALENDAR_ID", calendarId);
  console.log("GOOGLE CALENDAR EVENT PAYLOAD", event);
  console.log("[google-sync] calendar summary:", event.summary);
  console.log("[google-sync] calendar description:", event.description);
  console.log("[google-sync] payload enviado:", event);

  if (preferUpdate) {
    const updateResponse = await callGoogleCalendar("PUT", calendarId, eventId, accessToken, event);
    const updateSnapshot = await readGoogleCalendarResponse("GOOGLE CALENDAR UPDATE RESPONSE", updateResponse);

    if (updateSnapshot.status === 404) {
      await clearStoredEventId();
      return await recreateGoogleEvent(accessToken, calendarId, eventId, event);
    }

    if (!updateSnapshot.ok) {
      return await throwGoogleErrorFromSnapshot(updateSnapshot);
    }

    const verification = await verifyGoogleEvent(accessToken, calendarId, getSnapshotEventId(updateSnapshot.body, eventId));
    console.log("[google-sync] google response summary:", (verification.body as GoogleCalendarEventSnapshot | null)?.summary);
    console.log("[google-sync] google response htmlLink:", (verification.body as GoogleCalendarEventSnapshot | null)?.htmlLink);
    if (verification.status === 404) {
      await clearStoredEventId();
      return await recreateGoogleEvent(accessToken, calendarId, eventId, event);
    }

    if (!isValidGoogleEventSnapshot(verification.body, event)) {
      console.error("[google-sync] evento atualizado invalido", {
        calendarId,
        eventId,
        updateSnapshot,
        verification,
      });
      throw new ApiError(500, "O evento atualizado não foi confirmado no Google Agenda.", {
        updateResponse: updateSnapshot,
        verifyResponse: verification,
      });
    }

    return { eventId: getSnapshotEventId(verification.body, eventId), action: "updated" as const, event: verification.body as GoogleCalendarEventSnapshot };
  }

  const createResponse = await insertGoogleEvent(accessToken, calendarId, eventId, event);
  if (createResponse.status === 409) {
    const updateResponse = await callGoogleCalendar("PUT", calendarId, eventId, accessToken, event);
    const updateSnapshot = await readGoogleCalendarResponse("GOOGLE CALENDAR UPDATE RESPONSE", updateResponse);

    if (!updateSnapshot.ok) {
      return await throwGoogleErrorFromSnapshot(updateSnapshot);
    }

    const verification = await verifyGoogleEvent(accessToken, calendarId, getSnapshotEventId(updateSnapshot.body, eventId));
    console.log("[google-sync] google response summary:", (verification.body as GoogleCalendarEventSnapshot | null)?.summary);
    console.log("[google-sync] google response htmlLink:", (verification.body as GoogleCalendarEventSnapshot | null)?.htmlLink);
    if (!isValidGoogleEventSnapshot(verification.body, event)) {
      console.error("[google-sync] evento atualizado invalido", {
        calendarId,
        eventId,
        updateSnapshot,
        verification,
      });
      throw new ApiError(500, "O evento atualizado não foi confirmado no Google Agenda.", {
        updateResponse: updateSnapshot,
        verifyResponse: verification,
      });
    }

    return { eventId: getSnapshotEventId(verification.body, eventId), action: "updated" as const, event: verification.body as GoogleCalendarEventSnapshot };
  }

  if (!createResponse.ok) {
    return await throwGoogleErrorFromSnapshot(createResponse);
  }

  const createVerification = await verifyGoogleEvent(accessToken, calendarId, getSnapshotEventId(createResponse.body, eventId));
  console.log("[google-sync] google response summary:", (createVerification.body as GoogleCalendarEventSnapshot | null)?.summary);
  console.log("[google-sync] google response htmlLink:", (createVerification.body as GoogleCalendarEventSnapshot | null)?.htmlLink);
  if (!isValidGoogleEventSnapshot(createVerification.body, event)) {
    console.error("[google-sync] evento criado invalido", {
      calendarId,
      eventId,
      createResponse,
      createVerification,
    });
    throw new ApiError(500, "O evento criado não foi confirmado no Google Agenda.", {
      createResponse,
      verifyResponse: createVerification,
    });
  }

  return { eventId: getSnapshotEventId(createVerification.body, eventId), action: "created" as const, event: createVerification.body as GoogleCalendarEventSnapshot };
}

async function recreateGoogleEvent(accessToken: string, calendarId: string, eventId: string, event: GoogleCalendarEventPayload): Promise<{ eventId: string; action: "recreated"; event: GoogleCalendarEventSnapshot }> {
  const recreatedEventId = createReplacementEventId(eventId);
  const createResponse = await insertGoogleEvent(accessToken, calendarId, recreatedEventId, event);
  if (!createResponse.ok) {
    return await throwGoogleErrorFromSnapshot(createResponse);
  }

  const verification = await verifyGoogleEvent(accessToken, calendarId, getSnapshotEventId(createResponse.body, recreatedEventId));
  console.log("[google-sync] google response summary:", (verification.body as GoogleCalendarEventSnapshot | null)?.summary);
  console.log("[google-sync] google response htmlLink:", (verification.body as GoogleCalendarEventSnapshot | null)?.htmlLink);
  if (!isValidGoogleEventSnapshot(verification.body, event)) {
    console.error("[google-sync] evento recriado invalido", {
      calendarId,
      eventId: recreatedEventId,
      createResponse,
      verification,
    });
    throw new ApiError(500, "O evento recriado não foi confirmado no Google Agenda.", {
      createResponse,
      verifyResponse: verification,
    });
  }

  return { eventId: getSnapshotEventId(verification.body, recreatedEventId), action: "recreated" as const, event: verification.body as GoogleCalendarEventSnapshot };
}

async function insertGoogleEvent(accessToken: string, calendarId: string, eventId: string, event: GoogleCalendarEventPayload) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: eventId, ...event }),
  });

  const snapshot = await readGoogleCalendarResponse("GOOGLE CALENDAR CREATE RESPONSE", response);
  return snapshot;
}

function callGoogleCalendar(method: "PUT", calendarId: string, eventId: string, accessToken: string, event: GoogleCalendarEventPayload) {
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
}

async function verifyGoogleEvent(accessToken: string, calendarId: string, eventId: string) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const snapshot = await readGoogleCalendarResponse("GOOGLE CALENDAR VERIFY RESPONSE", response);
  return snapshot;
}

async function readGoogleCalendarResponse(label: string, response: Response) {
  const rawText = await response.text();
  let body: GoogleCalendarEventSnapshot | Record<string, unknown> | string | null = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText) as GoogleCalendarEventSnapshot;
    } catch {
      body = rawText;
    }
  }

  const snapshot = {
    ok: response.ok,
    status: response.status,
    body,
    rawText,
  };

  console.log(label, snapshot);
  return snapshot;
}

function isValidGoogleEventSnapshot(body: GoogleCalendarEventSnapshot | Record<string, unknown> | string | null, event: GoogleCalendarEventPayload) {
  if (!body || typeof body !== "object") return false;

  const record = body as GoogleCalendarEventSnapshot;
  return responseEventMatches(record, event)
    && typeof record.id === "string"
    && typeof record.status === "string"
    && typeof record.summary === "string"
    && typeof record.htmlLink === "string"
    && record.start !== undefined
    && record.end !== undefined;
}

function responseEventMatches(record: GoogleCalendarEventSnapshot, event: GoogleCalendarEventPayload) {
  return record.summary === event.summary
    && record.start?.date === event.start.date
    && record.end?.date === event.end.date;
}

function getSnapshotEventId(body: GoogleCalendarEventSnapshot | Record<string, unknown> | string | null, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const record = body as GoogleCalendarEventSnapshot;
  return typeof record.id === "string" && record.id ? record.id : fallback;
}

async function throwGoogleErrorFromSnapshot(snapshot: { status: number; body: GoogleCalendarEventSnapshot | Record<string, unknown> | string | null; rawText: string }): Promise<never> {
  const payload = typeof snapshot.body === "object" && snapshot.body !== null
    ? snapshot.body
    : { rawText: snapshot.rawText };
  logGoogleSyncGoogleError("upsert_event", payload);
  throw new ApiError(snapshot.status, "Não foi possível sincronizar evento no Google Agenda.", payload);
}

function signState(payload: Record<string, unknown>) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getStateSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyState(state: string) {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) throw new ApiError(400, "Estado OAuth inválido.");

  const expectedSignature = createHmac("sha256", getStateSecret()).update(encodedPayload).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) throw new ApiError(400, "Estado OAuth inválido.");

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
    userId: string;
    redirectTo: string;
    exp: number;
  };

  if (!payload.userId || !payload.exp || payload.exp < Date.now()) {
    throw new ApiError(400, "Estado OAuth expirado.");
  }

  return payload;
}

function getStateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || getRequiredEnv("TOKEN_ENCRYPTION_KEY");
}

function encryptSecret(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey() {
  return createHash("sha256").update(getRequiredEnv("TOKEN_ENCRYPTION_KEY")).digest();
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function deterministicEventId(userId: string, table: string, programId: string, expirationDate: string) {
  return `rm${createHash("sha256").update(`${userId}:${table}:${programId}:${expirationDate}`).digest("hex").slice(0, 32)}`;
}

function createReplacementEventId(previousEventId: string) {
  return `rm${createHash("sha256").update(`${previousEventId}:${Date.now()}`).digest("hex").slice(0, 32)}`;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function subtractMonths(date: string, months: number) {
  if (!isValidLocalDate(date)) return "";

  const parsed = new Date(`${date}T00:00:00`);
  const year = parsed.getFullYear();
  const monthIndex = parsed.getMonth() - months;
  const target = new Date(year, monthIndex + 1, 0);
  const targetDay = Math.min(parsed.getDate(), target.getDate());
  parsed.setFullYear(target.getFullYear(), target.getMonth(), targetDay);

  return parsed.toISOString().slice(0, 10);
}

function compareLocalDates(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00`).getTime();
  const rightDate = new Date(`${right}T00:00:00`).getTime();
  if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) return 0;
  return leftDate - rightDate;
}

function formatLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDaysRemaining(expirationDate: string) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiration = new Date(`${expirationDate}T00:00:00`);
  return Math.round((expiration.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
}

function getDaysLabel(daysRemaining: number) {
  if (daysRemaining < 0) return `Vencido há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? "dia" : "dias"}`;
  if (daysRemaining === 0) return "Vence hoje";
  return `Vence em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`;
}

function formatPtBrDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export class ApiError extends Error {
  details?: unknown;
  statusCode: number;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function sendError(res: ApiResponse, error: unknown) {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }

  const message = error instanceof Error ? error.message : "Erro inesperado.";
  res.status(500).json({ error: message });
}

export type { ApiRequest, ApiResponse };
