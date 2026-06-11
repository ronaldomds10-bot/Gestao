import {
  ApiError,
  createGoogleAuthUrl,
  getAuthenticatedUser,
  getConnection,
  logGoogleSyncEnvPresence,
  syncCalendarEvents,
  type ApiRequest,
  type ApiResponse,
} from "./_lib.js";

const syncTimeoutMs = 25000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  console.log("[google-sync] start");

  if (req.method !== "POST") {
    res.status(405).json(createSyncErrorBody("Método não permitido."));
    console.log("[google-sync] finished", { status: 405 });
    return;
  }

  let userIdReceived = false;
  let statusCode = 200;
  let connectionFound = false;

  try {
    logGoogleSyncEnvPresence();
    const user = await getAuthenticatedUser(req);
    userIdReceived = Boolean(user.id);
    console.log("[google-sync] user found", { found: userIdReceived });
    console.log("[google-sync] user_id recebido", { sim: userIdReceived });
    console.log("GOOGLE SYNC AUTH USER ID", user.id);

    const connection = await getConnection(user.id);
    connectionFound = Boolean(connection);
    console.log("[google-sync] connection found", { found: Boolean(connection) });
    console.log("[google-sync] conexão Google encontrada", { sim: Boolean(connection) });
    console.log("[google-sync] refresh_token encontrado", { sim: Boolean(connection?.refresh_token_encrypted) });
    console.log("GOOGLE SYNC HAS GOOGLE TOKENS", Boolean(connection?.refresh_token_encrypted || connection?.access_token_encrypted));

    if (!connection) {
      statusCode = 401;
      res.status(401).json(createSyncErrorBody("Google Agenda não conectado.", {
        connected: false,
        reason: "google_not_connected",
        message: "Este perfil ainda não está conectado ao Google Agenda.",
        code: "needs_google_connection",
        connectUrl: "/api/google/connect",
        authUrl: createGoogleAuthUrl(req, user.id),
      }));
      return;
    }

    const body = typeof req.body === "object" && req.body !== null ? req.body as { clientId?: string } : {};
    console.log("GOOGLE SYNC SELECTED CLIENT ID", body.clientId ?? null);
    if (!body.clientId) {
      statusCode = 400;
      res.status(400).json(createSyncErrorBody("Nenhum cliente/perfil selecionado foi enviado para sincronização.", {
        connected: false,
        reason: "missing_client_id",
        message: "Nenhum cliente/perfil selecionado foi enviado para sincronização.",
      }));
      return;
    }

    const result = await withTimeout(syncCalendarEvents(user.id, body.clientId, connection), syncTimeoutMs);
    res.status(200).json(result);
  } catch (error) {
    if (!userIdReceived) {
      console.log("[google-sync] user_id recebido", { sim: false });
      console.log("[google-sync] user found", { found: false });
    }
    statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    res.status(statusCode).json(createSyncErrorBody(error instanceof Error ? error.message : "Erro inesperado.", {
      connected: connectionFound,
      details: error instanceof ApiError ? error.details : undefined,
    }));
  } finally {
    console.log("[google-sync] finished", { status: statusCode });
  }
}

function createSyncErrorBody(message: string, extras: Record<string, unknown> = {}) {
  return {
    ok: false,
    partial: false,
    connected: false,
    reason: "sync_error",
    eligibleCount: 0,
    createdCount: 0,
    updatedCount: 0,
    recreatedCount: 0,
    googleEventExistsCount: 0,
    skippedByReason: {
      no_expiration_date: 0,
      sync_disabled: 0,
      missing_calendar_id: 0,
      google_event_exists: 0,
      invalid_date: 0,
      google_upsert_failed: 0,
      metadata_update_failed: 0,
      unknown_error: 0,
    },
    items: [],
    errors: [],
    error: message,
    ...extras,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ApiError(504, "Tempo limite excedido ao sincronizar Google Agenda.")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}


