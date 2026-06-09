import {
  getAuthenticatedUser,
  getConnection,
  getSupabaseAdmin,
  revokeConnection,
  sendError,
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

    if (connection) {
      await revokeConnection(connection);
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("google_calendar_connections")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
}
