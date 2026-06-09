import {
  ApiError,
  exchangeCodeForTokens,
  getAppUrl,
  sendError,
  upsertConnection,
  verifyState,
  type ApiRequest,
  type ApiResponse,
} from "./_lib";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  try {
    const code = getQueryValue(req, "code");
    const state = getQueryValue(req, "state");
    const oauthError = getQueryValue(req, "error");

    if (oauthError) {
      throw new ApiError(400, "Autorização Google cancelada.", oauthError);
    }

    if (!code || !state) {
      throw new ApiError(400, "Callback Google inválido.");
    }

    const verifiedState = verifyState(state);
    const tokens = await exchangeCodeForTokens(req, code);
    await upsertConnection(verifiedState.userId, tokens);

    res.redirect(302, verifiedState.redirectTo || `${getAppUrl(req)}/?googleCalendar=connected`);
  } catch (error) {
    const redirectUrl = `${getAppUrl(req)}/?googleCalendar=error`;
    if (req.headers.accept?.toString().includes("application/json")) {
      sendError(res, error);
      return;
    }
    res.redirect(302, redirectUrl);
  }
}

function getQueryValue(req: ApiRequest, key: string) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}
