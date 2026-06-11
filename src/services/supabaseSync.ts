import { supabase } from "../lib/supabase/client";

export type MilesProgram = {
  id: string;
  localId?: string;
  airline: string;
  balance: number;
  cpm: number;
  bonusPercentage: number;
  expirationDate: string;
  googleEventId?: string;
  calendarSyncedAt?: string;
  calendarSyncEnabled?: boolean;
};

export type PointsProgram = {
  id: string;
  localId?: string;
  type: "loyalty_points" | "bank_points";
  programName: string;
  balance: number;
  cpm: number;
  expirationDate: string;
  googleEventId?: string;
  calendarSyncedAt?: string;
  calendarSyncEnabled?: boolean;
};

export type BonusTransfer = {
  id: string;
  localId?: string;
  pointsProgramId?: string;
  milesProgramId?: string;
  originProgramName: string;
  destinationProgramName: string;
  sentAmount: number;
  bonusPercentage: number;
  date: string;
};

export type CreditCardRecord = {
  id: string;
  localId?: string;
  bank: string;
  cardName: string;
  limitValue: number;
  pointsBalance: number;
  pointsPerDollar: number;
  dueDay: number;
};

export type FlightRedemption = {
  id: string;
  localId?: string;
  date: string;
  origin: string;
  destination: string;
  airline: string;
  regularPrice: number;
  paidPrice: number;
  milesUsed: number;
  cpm?: number;
  airportFee?: number;
  totalCost?: number;
  savings?: number;
};

export type Goal = {
  id: string;
  localId?: string;
  title: string;
  destination: string;
  requiredMiles: number;
  deadline: string;
};

export type Profile = {
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  plan: string;
};

export type AppData = {
  id: string;
  localId?: string;
  cards: CreditCardRecord[];
  milesPrograms: MilesProgram[];
  pointsPrograms: PointsProgram[];
  transfers: BonusTransfer[];
  redemptions: FlightRedemption[];
  goals: Goal[];
  profile: Profile;
};

type UserData = {
  clients: AppData[];
  hasRemoteData: boolean;
};

type TableName =
  | "clients"
  | "credit_cards"
  | "points_programs"
  | "miles_programs"
  | "bonus_transfers"
  | "flight_redemptions"
  | "goals";

const TABLE_LABELS: Record<TableName, string> = {
  clients: "Cliente",
  credit_cards: "Cartão",
  points_programs: "Programa de pontos",
  miles_programs: "Programa de milhas",
  bonus_transfers: "Transferência",
  flight_redemptions: "Emissão",
  goals: "Meta",
};

const ALLOWED_DELETE_TABLES = new Set<TableName>(Object.keys(TABLE_LABELS) as TableName[]);

export class SupabaseSyncError extends Error {
  constructor(message = "Nao foi possivel salvar no Supabase. Verifique sua conexao e tente novamente.") {
    super(message);
    this.name = "SupabaseSyncError";
  }
}

type SupabaseErrorPayload = Record<string, unknown> | undefined;

type SupabaseErrorWithContext = {
  code?: string;
  message?: string;
  details?: string;
  context?: string;
  payload?: SupabaseErrorPayload;
};

export function handleSupabaseError(context: string, error: unknown, payload?: SupabaseErrorPayload) {
  const supabaseError = error as SupabaseErrorWithContext;
  const resolvedContext = supabaseError?.context ?? context;
  const resolvedPayload = supabaseError?.payload ?? payload;
  const [table, action] = resolvedContext.split(".");
  const isProgramsTable = table === "points_programs" || table === "miles_programs" || table === "bonus_transfers";

  if (isProgramsTable) {
    console.error("PROGRAMS SAVE ERROR", {
      context: resolvedContext,
      table,
      action,
      code: supabaseError?.code,
      message: supabaseError?.message,
      details: supabaseError?.details,
      payload: resolvedPayload,
      id: resolvedPayload?.id,
      local_id: resolvedPayload?.local_id,
      user_id: resolvedPayload?.user_id,
    });
  }

  console.error("SUPABASE ERROR", {
    context: resolvedContext,
    code: supabaseError?.code,
    message: supabaseError?.message,
    details: supabaseError?.details,
    payload: resolvedPayload,
  });
  window.alert(supabaseError?.message || "Não foi possível salvar no Supabase. Tente novamente.");
}

function throwSupabaseError(context: string, error: unknown, payload?: SupabaseErrorPayload): never {
  if (typeof error === "object" && error !== null) {
    const enrichedError = error as SupabaseErrorWithContext;
    enrichedError.context = context;
    enrichedError.payload = payload;
  }
  throw error;
}

function ensureOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new SupabaseSyncError("Sem conexao com a internet. Os dados nao foram salvos.");
  }
}

function nullIfEmpty(value: string | undefined) {
  return value?.trim() ? value : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function isSchemaCompatibilityError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "PGRST204" || candidate.message?.includes("column") || false;
}

function isNoRowsError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: string; details?: string; message?: string };
  return candidate.code === "PGRST116" || candidate.details?.includes("0 rows") || candidate.message?.includes("0 rows") || false;
}

function externalId(prefix: string, id: string, parts: Array<string | number | undefined | null>) {
  if (id && !isUuid(id)) return id;
  if (id && isUuid(id)) return `${prefix}:${id}`;
  return `${prefix}:${parts.map((part) => String(part ?? "").trim()).join(":")}`;
}

function stableExternalId(prefix: string, parts: Array<string | number | undefined | null>) {
  return `${prefix}:${parts.map((part) => String(part ?? "").trim().toLowerCase()).join(":")}`;
}

function localId(record: { id: string; localId?: string }) {
  return record.localId || record.id;
}

function parseCpmInput(value: string | number | null | undefined) {
  const parsedValue = Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsedValue)) return 0;
  return parsedValue > 1 ? parsedValue / 1000 : parsedValue;
}

function getTransferFinalMiles(transfer: Pick<BonusTransfer, "sentAmount" | "bonusPercentage">) {
  return Math.round(transfer.sentAmount + transfer.sentAmount * (transfer.bonusPercentage / 100));
}

function getRedemptionCosts(redemption: FlightRedemption) {
  const airportFee = redemption.airportFee ?? 0;
  const cpm = redemption.cpm === undefined ? undefined : parseCpmInput(redemption.cpm);
  const hasCpm = cpm !== undefined;
  const persistedTotalCost = redemption.totalCost ?? redemption.paidPrice;
  const milesCost = hasCpm ? redemption.milesUsed * cpm : Math.max(persistedTotalCost - airportFee, 0);
  const totalCost = hasCpm ? milesCost + airportFee : persistedTotalCost;
  const economy = hasCpm ? redemption.regularPrice - totalCost : redemption.savings ?? redemption.regularPrice - totalCost;

  return { airportFee, milesCost, totalCost, economy };
}

function getNotes(sourceId: string, details?: string) {
  return `Migrado do localStorage: ${sourceId}${details ? `; ${details}` : ""}`;
}

function getNotesText(notes: string | null | undefined, key: string, fallback: string) {
  const match = notes?.match(new RegExp(`${key}:\\s*([^;]+)`));
  return match?.[1]?.trim() || fallback;
}

function getNotesNumber(notes: string | null | undefined, key: string, fallback: number) {
  const value = getNotesText(notes, key, "");
  return value ? parseCpmInput(value) : fallback;
}

function getPointsNotes(program: PointsProgram) {
  return getNotes(program.id, `tipo: ${program.type}; cpm: ${parseCpmInput(program.cpm)}`);
}

function getPointsProgramExternalId(clientId: string, program: PointsProgram, recordLocalId: string) {
  return stableExternalId("points", [
    clientId,
    recordLocalId,
    program.type,
    program.programName,
    Math.max(0, Math.round(program.balance)),
    parseCpmInput(program.cpm),
    program.expirationDate,
  ]);
}

function getPointsProgramRowKey(row: Record<string, any>) {
  return [
    row.local_id ?? row.id,
    row.user_id,
    row.program_name ?? row.name ?? "",
    String(row.balance ?? 0),
    String(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.025)),
    row.expiration_date ?? "",
    row.destination_program ?? "",
    String(row.bonus_percentage ?? 0),
  ].join("|");
}

function uniquePointRows(rows: Array<Record<string, any>>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getPointsProgramRowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMilesNotes(program: MilesProgram) {
  return getNotes(program.id, `cpm: ${parseCpmInput(program.cpm)}; bonus: ${program.bonusPercentage}`);
}

function getMilesProgramExternalId(clientId: string, program: MilesProgram) {
  return stableExternalId("miles", [
    clientId,
    program.airline,
    Math.max(0, Math.round(program.balance)),
    parseCpmInput(program.cpm),
    program.expirationDate,
  ]);
}

function getMilesProgramRowKey(row: Record<string, any>) {
  return [
    row.local_id ?? row.id,
    row.user_id,
    row.airline ?? row.name ?? "",
    String(row.balance ?? 0),
    String(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.04)),
    row.expiration_date ?? "",
  ].join("|");
}

function uniqueMilesRows(rows: Array<Record<string, any>>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getMilesProgramRowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getTransferNotes(transfer: BonusTransfer) {
  return getNotes(transfer.id, `origem: ${transfer.originProgramName}; destino: ${transfer.destinationProgramName}`);
}

function getRedemptionNotes(redemption: FlightRedemption) {
  return getNotes(redemption.id, `companhia: ${redemption.airline}; cpm: ${redemption.cpm ?? ""}; taxa: ${redemption.airportFee ?? 0}`);
}

function getGoalDescription(goal: Goal) {
  return getNotes(goal.id, `destino: ${goal.destination}`);
}

function mapClient(row: Record<string, any>, fallback?: AppData): AppData {
  return {
    id: row.id,
    localId: row.local_id ?? row.id,
    cards: fallback?.cards ?? [],
    milesPrograms: fallback?.milesPrograms ?? [],
    pointsPrograms: fallback?.pointsPrograms ?? [],
    transfers: fallback?.transfers ?? [],
    redemptions: fallback?.redemptions ?? [],
    goals: fallback?.goals ?? [],
    profile: {
      name: row.name || fallback?.profile.name || "Cliente",
      email: row.email || fallback?.profile.email || "",
      phone: row.phone || fallback?.profile.phone || "",
      joinedAt: row.joined_at || fallback?.profile.joinedAt || new Date().toISOString().slice(0, 10),
      plan: row.plan || fallback?.profile.plan || "Gestao RM",
    },
  };
}

function firstClientId(clients: AppData[]) {
  return clients[0]?.id ?? null;
}

function uniqueClients(clients: AppData[]) {
  const seenLocalIds = new Set<string>();
  const seenProfiles = new Set<string>();
  return clients.filter((client) => {
    const localId = client.localId ?? "";
    const profileKey = [
      client.profile.email.trim().toLowerCase(),
      client.profile.name.trim().toLowerCase(),
    ].join("|");
    if (localId && seenLocalIds.has(localId)) return false;
    if (profileKey !== "|" && seenProfiles.has(profileKey)) return false;
    if (localId) seenLocalIds.add(localId);
    if (profileKey !== "|") seenProfiles.add(profileKey);
    return true;
  });
}

async function loadTable(table: TableName, userId: string) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function saveByIdOrExternalId<TPrimary extends Record<string, any>, TFallback extends Record<string, any>>(
  table: TableName,
  primaryPayload: TPrimary,
  fallbackPayload: TFallback,
  recordId: string,
) {
  ensureOnline();

  if (isUuid(recordId)) {
    const { data, error } = await supabase
      .from(table)
      .update(primaryPayload as never)
      .eq("id", recordId)
      .eq("user_id", primaryPayload.user_id)
      .select("id")
      .single();

    if (!error) {
      return data.id as string;
    }

    if (!isSchemaCompatibilityError(error) && !isNoRowsError(error)) {
      throwSupabaseError(`${table}.update`, error, primaryPayload);
    }

    if (isSchemaCompatibilityError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(table)
        .update(fallbackPayload as never)
        .eq("id", recordId)
        .eq("user_id", fallbackPayload.user_id)
        .select("id")
        .single();

      if (!fallbackError) {
        return fallbackData.id as string;
      }

      if (!isNoRowsError(fallbackError)) {
        throwSupabaseError(`${table}.update.fallback`, fallbackError, fallbackPayload);
      }
    }

    recordId = "";
  }

  const { data, error } = await supabase
    .from(table)
    .upsert([fallbackPayload as never], { onConflict: "user_id,local_id" })
    .select("id")
    .single();

  if (!error) {
    return data.id as string;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(table)
    .upsert([primaryPayload as never], { onConflict: "user_id,local_id" })
    .select("id")
    .single();

  if (fallbackError) {
    throwSupabaseError(`${table}.upsert`, fallbackError, fallbackPayload);
  }

  return fallbackData.id as string;
}

export async function loadUserDataFromSupabase(userId: string, fallbackClients: AppData[] = []): Promise<UserData> {
  ensureOnline();

  const [clientRows, cardRows, pointRows, mileRows, transferRows, redemptionRows, goalRows] = await Promise.all([
    loadTable("clients", userId),
    loadTable("credit_cards", userId),
    loadTable("points_programs", userId),
    loadTable("miles_programs", userId),
    loadTable("bonus_transfers", userId),
    loadTable("flight_redemptions", userId),
    loadTable("goals", userId),
  ]);

  const clients = clientRows.length > 0
    ? uniqueClients(clientRows.map((row, index) => mapClient(row, fallbackClients[index])))
    : fallbackClients;
  const defaultClientId = firstClientId(clients);
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const resolveClient = (row: Record<string, any>) =>
    row.client_id ? clientMap.get(row.client_id) : defaultClientId ? clientMap.get(defaultClientId) : undefined;

  for (const row of cardRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    client.cards.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      bank: row.bank ?? "",
      cardName: row.card_name ?? row.name ?? "",
      limitValue: Number(row.limit_value ?? 0),
      pointsBalance: Number(row.points_balance ?? 0),
      pointsPerDollar: Number(row.points_multiplier ?? row.points_per_dollar ?? 0),
      dueDay: Number(row.due_day ?? 1),
    });
  }

  const pointsRowsById = new Map<string, Record<string, any>>();
  const milesRowsById = new Map<string, Record<string, any>>();

  for (const row of uniquePointRows(pointRows as Array<Record<string, any>>)) {
    pointsRowsById.set(row.id, row);
    const client = resolveClient(row);
    if (!client) continue;

    client.pointsPrograms.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      type: row.type ?? (getNotesText(row.notes, "tipo", "loyalty_points") as PointsProgram["type"]),
      programName: row.program_name ?? row.name ?? "",
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.025)),
      expirationDate: row.expiration_date ?? "",
      googleEventId: row.google_event_id ?? undefined,
      calendarSyncedAt: row.calendar_synced_at ?? undefined,
      calendarSyncEnabled: Boolean(row.calendar_sync_enabled),
    });
  }

  for (const row of uniqueMilesRows(mileRows as Array<Record<string, any>>)) {
    milesRowsById.set(row.id, row);
    const client = resolveClient(row);
    if (!client) continue;

    const airline = row.airline || row.name || "";
    client.milesPrograms.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      airline,
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.04)),
      bonusPercentage: Number(row.bonus_percentage ?? getNotesNumber(row.notes, "bonus", 0)),
      expirationDate: row.expiration_date ?? "",
      googleEventId: row.google_event_id ?? undefined,
      calendarSyncedAt: row.calendar_synced_at ?? undefined,
      calendarSyncEnabled: Boolean(row.calendar_sync_enabled),
    });
  }

  for (const row of transferRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    const originId = row.points_program_id ?? row.origin_program_id;
    const destinationId = row.miles_program_id ?? row.destination_program_id;
    const origin = originId ? pointsRowsById.get(originId) : undefined;
    const destination = destinationId ? milesRowsById.get(destinationId) : undefined;

    client.transfers.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      pointsProgramId: originId ?? undefined,
      milesProgramId: destinationId ?? undefined,
      originProgramName: row.origin_program || row.origin_program_name || origin?.name || origin?.program_name || getNotesText(row.notes, "origem", ""),
      destinationProgramName: row.destination_program || row.destination_program_name || destination?.airline || destination?.name || getNotesText(row.notes, "destino", ""),
      sentAmount: Number(row.transferred_points ?? row.sent_amount ?? 0),
      bonusPercentage: Number(row.bonus_percentage ?? 0),
      date: row.transfer_date ?? "",
    });
  }

  for (const row of redemptionRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    const notesCpm = getNotesText(row.notes, "cpm", "");
    const savedCpm = row.cpm !== null && row.cpm !== undefined && String(row.cpm).trim() !== ""
      ? parseCpmInput(row.cpm)
      : notesCpm
        ? parseCpmInput(notesCpm)
        : undefined;
    const airportFee = row.airport_fee ?? row.taxes ?? getNotesNumber(row.notes, "taxa", 0);
    const totalCost = Number(row.total_cost ?? row.paid_price ?? row.cash_cost ?? 0);
    const savings = row.savings === null || row.savings === undefined ? undefined : Number(row.savings);
    const regularPrice = Number(row.regular_price ?? row.sale_price ?? 0);
    const milesUsed = Number(row.miles_used ?? 0);
    const resolvedAirportFee = Number(airportFee ?? 0);
    client.redemptions.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      date: row.redemption_date ?? row.departure_date ?? "",
      origin: row.origin ?? "",
      destination: row.destination ?? "",
      airline: row.airline ?? getNotesText(row.notes, "companhia", ""),
      regularPrice,
      paidPrice: totalCost,
      milesUsed,
      cpm: savedCpm,
      airportFee: resolvedAirportFee,
      totalCost,
      savings,
    });
  }

  for (const row of goalRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    client.goals.push({
      id: row.id,
      localId: row.local_id ?? row.id,
      title: row.title ?? "",
      destination: row.destination ?? getNotesText(row.description, "destino", ""),
      requiredMiles: Number(row.required_miles ?? row.target_value ?? 0),
      deadline: row.deadline ?? row.due_date ?? "",
    });
  }

  const hasRemoteData =
    clientRows.length > 0 ||
    cardRows.length > 0 ||
    pointRows.length > 0 ||
    mileRows.length > 0 ||
    transferRows.length > 0 ||
    redemptionRows.length > 0 ||
    goalRows.length > 0;

  return { clients, hasRemoteData };
}

export async function saveClientToSupabase(userId: string, client: AppData) {
  const idPayload = isUuid(client.id) ? { id: client.id } : {};
  const recordLocalId = localId(client);
  const profile = client.profile;
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    local_id: recordLocalId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    plan: profile.plan,
    joined_at: nullIfEmpty(profile.joinedAt),
  };

  ensureOnline();
  const updateClientById = async (recordId: string, payload = primaryPayload) => {
    const { data, error } = await supabase
      .from("clients")
      .update(payload as never)
      .eq("id", recordId)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (error) {
      throwSupabaseError("clients.update", error, payload);
    }

    return { ...client, localId: recordLocalId, id: data.id as string };
  };

  if (isUuid(client.id)) {
    const { data, error } = await supabase
      .from("clients")
      .update(primaryPayload as never)
      .eq("id", client.id)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (!error) {
      return { ...client, localId: recordLocalId, id: data.id as string };
    }

    if (!isNoRowsError(error)) {
      throwSupabaseError("clients.update", error, primaryPayload);
    }
  }

  if (profile.email.trim() || profile.name.trim()) {
    const { data: existingClient, error: existingError } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .eq("email", profile.email)
      .eq("name", profile.name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throwSupabaseError("clients.findExisting", existingError, primaryPayload);
    }

    if (existingClient?.id) {
      return updateClientById(existingClient.id as string, {
        ...primaryPayload,
        id: existingClient.id,
      });
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .upsert([primaryPayload as never], { onConflict: "user_id,local_id" })
    .select("id")
    .single();

  if (error) {
    throwSupabaseError("clients.upsert", error, primaryPayload);
  }

  const id = data.id as string;
  return { ...client, localId: recordLocalId, id };
}

export async function saveCardToSupabase(userId: string, clientId: string, card: CreditCardRecord) {
  const idPayload = isUuid(card.id) ? { id: card.id } : {};
  const recordLocalId = localId(card);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    external_id: externalId("card", card.id, [clientId, card.bank, card.cardName, card.dueDay]),
    card_name: card.cardName,
    bank: card.bank,
    limit_value: card.limitValue,
    points_balance: Math.max(0, Math.round(card.pointsBalance)),
    due_day: card.dueDay,
    points_per_dollar: card.pointsPerDollar,
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...card, localId: recordLocalId, id: await saveByIdOrExternalId("credit_cards", primaryPayload, fallbackPayload, card.id) };
}

async function resolveCreditCardSupabaseId(userId: string, clientId: string, card: CreditCardRecord, recordLocalId: string) {
  if (isUuid(card.id)) return card.id;

  const queryBy = async (column: "local_id" | "external_id", value: string | undefined) => {
    if (!value) return null;

    const { data, error } = await supabase
      .from("credit_cards")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq(column, value)
      .limit(1)
      .maybeSingle();

    if (error) {
      throwSupabaseError(`credit_cards.resolve.${column}`, error, { user_id: userId, client_id: clientId, [column]: value });
    }

    return typeof data?.id === "string" ? data.id : null;
  };

  const byLocalId = await queryBy("local_id", recordLocalId);
  if (byLocalId) return byLocalId;

  const byExternalId = await queryBy("external_id", card.id);
  if (byExternalId) return byExternalId;

  const { data, error } = await supabase
    .from("credit_cards")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("bank", card.bank)
    .eq("card_name", card.cardName)
    .eq("due_day", card.dueDay)
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError("credit_cards.resolve.signature", error, {
      user_id: userId,
      client_id: clientId,
      bank: card.bank,
      card_name: card.cardName,
      due_day: card.dueDay,
    });
  }

  if (typeof data?.id === "string") return data.id;

  console.error("CARD WITHOUT SUPABASE ID", { userId, clientId, card });
  throw new SupabaseSyncError("Cartao sem id real do Supabase para atualizar. Recarregue os dados e tente novamente.");
}

export async function updateCardInSupabase(userId: string, clientId: string, card: CreditCardRecord) {
  ensureOnline();

  const recordLocalId = localId(card);
  const resolvedCardId = await resolveCreditCardSupabaseId(userId, clientId, card, recordLocalId);
  const payload = {
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    card_name: card.cardName,
    bank: card.bank,
    limit_value: card.limitValue,
    points_balance: Math.max(0, Math.round(card.pointsBalance)),
    due_day: card.dueDay,
    points_per_dollar: card.pointsPerDollar,
  };
  const fallbackPayload = {
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    card_name: card.cardName,
    bank: card.bank,
    limit_value: card.limitValue,
    points_balance: Math.max(0, Math.round(card.pointsBalance)),
    due_day: card.dueDay,
    points_multiplier: card.pointsPerDollar,
  };

  const { data, error } = await supabase
    .from("credit_cards")
    .update(payload as never)
    .eq("id", resolvedCardId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error) {
    if (!isSchemaCompatibilityError(error)) {
      throwSupabaseError("credit_cards.update", error, payload);
    }

      const { data: fallbackData, error: fallbackError } = await supabase
      .from("credit_cards")
      .update(fallbackPayload as never)
      .eq("id", resolvedCardId)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (fallbackError) {
      throwSupabaseError("credit_cards.update.fallback", fallbackError, fallbackPayload);
    }

    return { ...card, localId: recordLocalId, id: fallbackData.id as string };
  }

  return { ...card, localId: recordLocalId, id: data.id as string };
}

export async function savePointsProgramToSupabase(userId: string, clientId: string, program: PointsProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const recordLocalId = localId(program);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    external_id: getPointsProgramExternalId(clientId, program, recordLocalId),
    type: program.type,
    program_name: program.programName,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    expiration_date: nullIfEmpty(program.expirationDate),
    destination_program: null,
    bonus_percentage: 0,
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...program, localId: recordLocalId, id: await saveByIdOrExternalId("points_programs", primaryPayload, fallbackPayload, program.id) };
}

export async function saveMilesProgramToSupabase(userId: string, clientId: string, program: MilesProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const recordLocalId = localId(program);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    airline: program.airline,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    expiration_date: nullIfEmpty(program.expirationDate),
  };
  const fallbackPayload = {
    ...primaryPayload,
    external_id: getMilesProgramExternalId(clientId, program),
  };

  return { ...program, localId: recordLocalId, id: await saveByIdOrExternalId("miles_programs", primaryPayload, fallbackPayload, program.id) };
}

export async function saveTransferToSupabase(
  userId: string,
  clientId: string,
  transfer: BonusTransfer,
  pointsPrograms: PointsProgram[],
  milesPrograms: MilesProgram[],
) {
  const idPayload = isUuid(transfer.id) ? { id: transfer.id } : {};
  const recordLocalId = localId(transfer);
  const originId = transfer.pointsProgramId ?? pointsPrograms.find((program) => program.programName === transfer.originProgramName)?.id ?? null;
  const destinationId = transfer.milesProgramId ?? milesPrograms.find((program) => program.airline === transfer.destinationProgramName)?.id ?? null;
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    external_id: externalId("transfer", transfer.id, [clientId, transfer.originProgramName, transfer.destinationProgramName, transfer.date, transfer.sentAmount]),
    origin_program: transfer.originProgramName,
    destination_program: transfer.destinationProgramName,
    sent_amount: Math.max(0, Math.round(transfer.sentAmount)),
    bonus_percentage: transfer.bonusPercentage,
    bonus_miles: Math.max(getTransferFinalMiles(transfer) - transfer.sentAmount, 0),
    credited_miles: getTransferFinalMiles(transfer),
    transfer_date: nullIfEmpty(transfer.date),
    generated_value: 0,
  };
  const fallbackPayload = {
    ...primaryPayload,
    points_program_id: originId,
    miles_program_id: destinationId,
  };

  return {
    ...transfer,
    localId: recordLocalId,
    pointsProgramId: originId ?? undefined,
    milesProgramId: destinationId ?? undefined,
    id: await saveByIdOrExternalId("bonus_transfers", primaryPayload, fallbackPayload, transfer.id),
  };
}

export async function saveRedemptionToSupabase(userId: string, clientId: string, redemption: FlightRedemption) {
  const idPayload = isUuid(redemption.id) ? { id: redemption.id } : {};
  const recordLocalId = localId(redemption);
  const cpm = redemption.cpm === undefined ? null : parseCpmInput(redemption.cpm);
  const normalizedRedemption = { ...redemption, cpm: cpm ?? undefined };
  const costs = getRedemptionCosts(normalizedRedemption);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    external_id: externalId("redemption", redemption.id, [clientId, redemption.date, redemption.origin, redemption.destination, redemption.airline]),
    redemption_date: nullIfEmpty(redemption.date),
    origin: redemption.origin,
    destination: redemption.destination,
    airline: redemption.airline,
    miles_used: Math.max(0, Math.round(redemption.milesUsed)),
    regular_price: redemption.regularPrice,
    cpm,
    airport_fee: costs.airportFee,
    total_cost: costs.totalCost,
    savings: costs.economy,
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return {
    ...redemption,
    localId: recordLocalId,
    cpm: cpm ?? undefined,
    paidPrice: costs.totalCost,
    totalCost: costs.totalCost,
    savings: costs.economy,
    id: await saveByIdOrExternalId("flight_redemptions", primaryPayload, fallbackPayload, redemption.id),
  };
}

export async function saveGoalToSupabase(userId: string, clientId: string, goal: Goal) {
  const idPayload = isUuid(goal.id) ? { id: goal.id } : {};
  const recordLocalId = localId(goal);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    local_id: recordLocalId,
    external_id: externalId("goal", goal.id, [clientId, goal.title, goal.destination, goal.deadline]),
    title: goal.title,
    destination: goal.destination,
    required_miles: Math.max(0, Math.round(goal.requiredMiles)),
    deadline: nullIfEmpty(goal.deadline),
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...goal, localId: recordLocalId, id: await saveByIdOrExternalId("goals", primaryPayload, fallbackPayload, goal.id) };
}

type DeleteSupabaseRecordParams = {
  table: TableName;
  id?: string;
  local_id?: string;
  user_id?: string;
  label?: string;
};

export async function deleteSupabaseRecord({ table, id = "", local_id = "", user_id: requestedUserId, label }: DeleteSupabaseRecordParams) {
  ensureOnline();

  if (!ALLOWED_DELETE_TABLES.has(table)) {
    throw new SupabaseSyncError("Tabela nao permitida para exclusao.");
  }

  const resolvedLabel = label || TABLE_LABELS[table];
  const fallbackLocalId = local_id || id;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const authError = userError ?? new SupabaseSyncError("Usuario autenticado nao encontrado.");
    console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: undefined, error: authError });
    throwSupabaseError(`${table}.delete.auth`, authError, { table, id, local_id: fallbackLocalId });
  }

  if (requestedUserId && requestedUserId !== user.id) {
    const error = new SupabaseSyncError(`${resolvedLabel} nao pode ser excluido por outro usuario.`);
    console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: requestedUserId, error });
    throwSupabaseError(`${table}.delete.userMismatch`, error, { table, id, local_id: fallbackLocalId, user_id: requestedUserId });
  }

  const userId = user.id;
  const payload = { table, id, local_id: fallbackLocalId, user_id: userId };

  if (isUuid(id)) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: userId, error });
      throwSupabaseError(`${table}.delete`, error, payload);
    }

    if ((count ?? 0) > 0) {
      return true;
    }
  }

  if (!fallbackLocalId) {
    const error = new SupabaseSyncError(`${resolvedLabel} sem id real ou local_id para excluir no Supabase.`);
    console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: userId, error });
    throwSupabaseError(`${table}.delete.missingIdentifier`, error, payload);
  }

  const deleteByLocalIdQuery = supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("user_id", userId) as ReturnType<typeof supabase.from> & {
      eq(column: "local_id", value: string): Promise<{ error: unknown; count: number | null }>;
    };
  const { error, count } = await deleteByLocalIdQuery.eq("local_id", fallbackLocalId);

  if (error) {
    console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: userId, error });
    throwSupabaseError(`${table}.deleteByLocalId`, error, payload);
  }

  if ((count ?? 0) === 0) {
    const error = new SupabaseSyncError(`${resolvedLabel} nao encontrado no Supabase para exclusao.`);
    console.error("SUPABASE DELETE ERROR", { table, id, local_id: fallbackLocalId, user_id: userId, error });
    throwSupabaseError(`${table}.delete.notFound`, error, payload);
  }

  return true;
}

export async function deleteRecordFromSupabase(table: TableName, userId: string, recordId: string, recordLocalId?: string) {
  return deleteSupabaseRecord({ table, id: recordId, local_id: recordLocalId, user_id: userId });
}
