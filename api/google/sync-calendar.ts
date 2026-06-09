import {
  createGoogleAuthUrl,
  getAuthenticatedUser,
  getConnection,
  sendError,
  syncCalendarEvents,
  type ApiRequest,
  type ApiResponse,
} from "./_lib";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    const connection = await getConnection(user.id);

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
    sendError(res, error);
  }
}
