import {
  ApiError,
  createGoogleAuthUrl,
  getAuthenticatedUser,
  getConnection,
  logGoogleSyncEnvPresence,
  sendError,
  syncCalendarEvents,
  type ApiRequest,
  type ApiResponse,
} from "./_lib.js";

const syncTimeoutMs = 25000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  console.log("[google-sync] start");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    console.log("[google-sync] finished", { status: 405 });
    return;
  }

  let userIdReceived = false;
  let statusCode = 200;

  try {
    logGoogleSyncEnvPresence();
    const user = await getAuthenticatedUser(req);
    userIdReceived = Boolean(user.id);
    console.log("[google-sync] user found", { found: userIdReceived });
    console.log("[google-sync] user_id recebido", { sim: userIdReceived });

    const connection = await getConnection(user.id);
    console.log("[google-sync] connection found", { found: Boolean(connection) });
    console.log("[google-sync] conexão Google encontrada", { sim: Boolean(connection) });
    console.log("[google-sync] refresh_token encontrado", { sim: Boolean(connection?.refresh_token_encrypted) });

    if (!connection) {
      statusCode = 401;
      res.status(401).json({
        code: "needs_google_connection",
        error: "Google Agenda não conectado.",
        connectUrl: "/api/google/connect",
        authUrl: createGoogleAuthUrl(req, user.id),
      });
      return;
    }

    const body = typeof req.body === "object" && req.body !== null ? req.body as { clientId?: string } : {};
    const result = await withTimeout(syncCalendarEvents(user.id, body.clientId, connection), syncTimeoutMs);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (!userIdReceived) {
      console.log("[google-sync] user_id recebido", { sim: false });
      console.log("[google-sync] user found", { found: false });
    }
    statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    sendError(res, error);
  } finally {
    console.log("[google-sync] finished", { status: statusCode });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ApiError(504, "Tempo limite excedido ao sincronizar Google Agenda.")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
