import {
  createGoogleAuthUrl,
  getAuthenticatedUser,
  sendError,
  type ApiRequest,
  type ApiResponse,
} from "./_lib";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    res.status(200).json({ authUrl: createGoogleAuthUrl(req, user.id) });
  } catch (error) {
    sendError(res, error);
  }
}
