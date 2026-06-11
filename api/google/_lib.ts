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
  const items: SyncItemSummary[] = [];

  const supabase = getSupabaseAdmin();
  const [pointsResult, milesResult, clientsResult] = await Promise.all([
    selectPrograms("points_programs", userId, clientId),
    selectPrograms("miles_programs", userId, clientId),
    clientId
      ? supabase.from("clients").select("id,name,email").eq("user_id", userId).eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (pointsResult.error) {
    logGoogleSyncSupabaseError("select_points_programs", pointsResult.error);
    throw new ApiError(500, "Não foi possível carregar pontos.", pointsResult.error);
  }
  if (milesResult.error) {
    logGoogleSyncSupabaseError("select_miles_programs", milesResult.error);
    throw new ApiError(500, "Não foi possível carregar milhas.", milesResult.error);
  }
  if (clientsResult.error) {
    logGoogleSyncSupabaseError("select_client", clientsResult.error);
    throw new ApiError(500, "Não foi possível carregar cliente.", clientsResult.error);
  }

  const client = clientsResult.data as { name?: string | null; email?: string | null } | null;
  const candidates = [
    ...(pointsResult.data ?? []).map((program: ProgramRow) => ({ type: "points" as const, kind: "Pontos" as const, table: "points_programs" as const, program })),
    ...(milesResult.data ?? []).map((program: ProgramRow) => ({ type: "miles" as const, kind: "Milhas" as const, table: "miles_programs" as const, program })),
  ];
  const expirations: typeof candidates = [];

  for (const item of candidates) {
    const programName = getProgramName(item.program);
    const skipReason = getEligibilitySkipReason(item.program, connection.calendar_id);

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
      items.push(getSyncItemSummary(item, "skipped"));
      continue;
    }

    if (getDaysRemaining(item.program.expiration_date as string) <= 730) {
      expirations.push(item);
    }
  }

  expirations.sort((a, b) => getDaysRemaining(a.program.expiration_date as string) - getDaysRemaining(b.program.expiration_date as string));

  console.log("[google-sync] vencimentos encontrados", { quantidade: expirations.length });
  console.log("[google-sync] eligible count", { count: expirations.length });

  let createdCount = 0;
  let updatedCount = 0;
  let recreatedCount = 0;
  let googleEventExistsCount = 0;
  const errors: CalendarSyncError[] = [];

  for (const item of expirations) {
    try {
      const event = buildCalendarEvent(item.kind, item.program, client);
      const eventId = item.program.google_event_id || deterministicEventId(userId, item.table, item.program.id, item.program.expiration_date || "");
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
        connection.calendar_id,
        eventId,
        event,
        Boolean(item.program.google_event_id),
        () => clearProgramGoogleEventId(supabase, item.table, item.program.id, userId),
      );

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
        items.push(getSyncItemSummary(item, "skipped"));
        console.log("[google-sync] eligible item skipped", {
          type: item.type,
          program: getProgramName(item.program),
          expiration_date: item.program.expiration_date,
          calendar_sync_enabled: item.program.calendar_sync_enabled,
          google_event_id: item.program.google_event_id,
          skipReason: "metadata_update_failed",
        });
        errors.push(getCalendarSyncError(item.table, item.program.id, error));
        continue;
      }
      if (result.action === "created") createdCount += 1;
      if (result.action === "updated") updatedCount += 1;
      if (result.action === "recreated") recreatedCount += 1;
      items.push(getSyncItemSummary(item, result.action));
    } catch (error) {
      skippedByReason.google_upsert_failed += 1;
      items.push(getSyncItemSummary(item, "skipped"));
      console.log("[google-sync] eligible item skipped", {
        type: item.type,
        program: getProgramName(item.program),
        expiration_date: item.program.expiration_date,
        calendar_sync_enabled: item.program.calendar_sync_enabled,
        google_event_id: item.program.google_event_id,
        skipReason: "google_upsert_failed",
        error: getSafeErrorDetails(error),
      });
      errors.push(getCalendarSyncError(item.table, item.program.id, error));
    }
  }

  const result = {
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
  const columns = table === "points_programs"
    ? "id,user_id,client_id,program_name,balance,cpm,expiration_date,calendar_sync_enabled,google_event_id"
    : "id,user_id,client_id,airline,balance,cpm,expiration_date,calendar_sync_enabled,google_event_id";
  let query = supabase
    .from(table)
    .select(columns)
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

function getProgramTypeLabel(kind: "Pontos" | "Milhas") {
  return kind === "Pontos" ? "Pontos" : "Milhas";
}

function formatProgramBalance(program: ProgramRow) {
  return Math.round(Number(program.balance ?? 0)).toLocaleString("pt-BR");
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

function buildCalendarEvent(kind: "Pontos" | "Milhas", program: ProgramRow, client: { name?: string | null; email?: string | null } | null) {
  const programName = getProgramName(program);
  const expirationDate = program.expiration_date || "";
  const daysRemaining = getDaysRemaining(expirationDate);
  const balance = formatProgramBalance(program);
  const typeLabel = getProgramTypeLabel(kind);
  const statusLabel = getDaysLabel(daysRemaining);
  const estimatedValue = Number(program.balance ?? 0) * Number(program.cpm ?? 0);
  const clientName = client?.name || client?.email || "";
  const descriptionLines = [
    `Programa: ${programName}`,
    `Quantidade: ${balance} ${kind.toLowerCase()}`,
    `Tipo: ${typeLabel}`,
    `Vencimento: ${formatPtBrDate(expirationDate)}`,
    `Status: ${statusLabel}`,
    clientName ? `Cliente: ${clientName}` : "",
    `Valor estimado: ${formatCurrencyBRL(estimatedValue)}`,
    "",
    "Atenção: estes pontos/milhas estão próximos do vencimento. Verifique possibilidade de uso, transferência, renovação ou emissão antes da data final.",
  ].filter(Boolean);

  return {
    summary: `Vencimento: ${programName} - ${balance} ${kind.toLowerCase()}`,
    description: descriptionLines.join("\n"),
    start: { date: expirationDate },
    end: { date: addDays(expirationDate, 1) },
  };
}

async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: unknown,
  preferUpdate: boolean,
  clearStoredEventId: () => Promise<void>,
): Promise<{ eventId: string; action: "created" | "updated" | "recreated" }> {
  if (preferUpdate) {
    const updateResponse = await callGoogleCalendar("PUT", calendarId, eventId, accessToken, event);
    if (updateResponse.ok) return { eventId, action: "updated" as const };

    if (updateResponse.status === 404) {
      await clearStoredEventId();
      const recreatedEventId = createReplacementEventId(eventId);
      const recreated = await insertGoogleEvent(accessToken, calendarId, recreatedEventId, event);
      return { eventId: recreated.eventId, action: "recreated" as const };
    }

    return await throwGoogleError(updateResponse);
  }

  return await insertGoogleEvent(accessToken, calendarId, eventId, event);
}

async function insertGoogleEvent(accessToken: string, calendarId: string, eventId: string, event: unknown): Promise<{ eventId: string; action: "created" | "updated" }> {
  const insertResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: eventId, ...(event as Record<string, unknown>) }),
  });

  if (insertResponse.ok) {
    const payload = await insertResponse.json();
    return { eventId: payload.id || eventId, action: "created" as const };
  }

  if (insertResponse.status === 409) {
    const updateResponse = await callGoogleCalendar("PUT", calendarId, eventId, accessToken, event);
    if (updateResponse.ok) return { eventId, action: "updated" as const };
    return await throwGoogleError(updateResponse);
  }

  return await throwGoogleError(insertResponse);
}

function callGoogleCalendar(method: "PUT", calendarId: string, eventId: string, accessToken: string, event: unknown) {
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
}

async function throwGoogleError(response: Response): Promise<never> {
  const payload = await response.json().catch(() => null);
  logGoogleSyncGoogleError("upsert_event", payload);
  throw new ApiError(response.status, "Não foi possível sincronizar evento no Google Agenda.", payload);
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
