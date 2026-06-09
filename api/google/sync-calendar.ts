import {
  createGoogleAuthUrl,
  getAuthenticatedUser,
  getConnection,
  logGoogleSyncEnvPresence,
  sendError,
  syncCalendarEvents,
  type ApiRequest,
  type ApiResponse,
} from "./_lib.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  let userIdReceived = false;

  try {
    logGoogleSyncEnvPresence();
    const user = await getAuthenticatedUser(req);
    userIdReceived = Boolean(user.id);
    console.log("[google-sync] user_id recebido", { sim: userIdReceived });

    const connection = await getConnection(user.id);
    console.log("[google-sync] conexão Google encontrada", { sim: Boolean(connection) });
    console.log("[google-sync] refresh_token encontrado", { sim: Boolean(connection?.refresh_token_encrypted) });

    if (!connection) {
      res.status(409).json({
        error: "Google Agenda não conectado.",
        authUrl: createGoogleAuthUrl(req, user.id),
      });
      return;
    }

    const body = typeof req.body === "object" && req.body !== null ? req.body as { clientId?: string } : {};
    const result = await syncCalendarEvents(user.id, body.clientId, connection);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (!userIdReceived) {
      console.log("[google-sync] user_id recebido", { sim: false });
    }
    sendError(res, error);
  }
}
