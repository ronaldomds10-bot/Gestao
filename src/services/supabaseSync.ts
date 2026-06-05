import { supabase } from "../lib/supabase/client";

export type MilesProgram = {
  id: string;
  airline: string;
  balance: number;
  cpm: number;
  bonusPercentage: number;
  expirationDate: string;
};

export type PointsProgram = {
  id: string;
  type: "loyalty_points" | "bank_points";
  programName: string;
  balance: number;
  cpm: number;
  expirationDate: string;
};

export type BonusTransfer = {
  id: string;
  originProgramName: string;
  destinationProgramName: string;
  sentAmount: number;
  bonusPercentage: number;
  date: string;
};

export type CreditCardRecord = {
  id: string;
  bank: string;
  cardName: string;
  limitValue: number;
  pointsBalance: number;
  pointsPerDollar: number;
  dueDay: number;
};

export type FlightRedemption = {
  id: string;
  date: string;
  origin: string;
  destination: string;
  airline: string;
  regularPrice: number;
  paidPrice: number;
  milesUsed: number;
  cpm?: number;
  airportFee?: number;
};

export type Goal = {
  id: string;
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
  console.error("SUPABASE ERROR", {
    context: supabaseError?.context ?? context,
    code: supabaseError?.code,
    message: supabaseError?.message,
    details: supabaseError?.details,
    payload: supabaseError?.payload ?? payload,
  });
  window.alert("Não foi possível salvar no Supabase. Tente novamente.");
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
  const hasNewCostFields = redemption.cpm !== undefined;
  const milesCost = hasNewCostFields ? redemption.milesUsed * parseCpmInput(redemption.cpm ?? 0) : Math.max(redemption.paidPrice - airportFee, 0);
  const totalCost = hasNewCostFields ? milesCost + airportFee : redemption.paidPrice;
  const economy = redemption.regularPrice - totalCost;

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

function getPointsProgramExternalId(clientId: string, program: PointsProgram) {
  return stableExternalId("points", [
    clientId,
    program.type,
    program.programName,
    Math.max(0, Math.round(program.balance)),
    parseCpmInput(program.cpm),
    program.expirationDate,
  ]);
}

function getPointsProgramRowKey(row: Record<string, any>) {
  return [
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
    .upsert([primaryPayload as never], { onConflict: "user_id,external_id" })
    .select("id")
    .single();

  if (!error) {
    return data.id as string;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(table)
    .upsert([fallbackPayload as never], { onConflict: "user_id,external_id" })
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
    ? clientRows.map((row, index) => mapClient(row, fallbackClients[index]))
    : fallbackClients;
  const defaultClientId = firstClientId(clients);
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const resolveClient = (row: Record<string, any>) =>
    clientMap.get(row.client_id) ?? (defaultClientId ? clientMap.get(defaultClientId) : undefined);

  for (const row of cardRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    client.cards.push({
      id: row.id,
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
      type: row.type ?? (getNotesText(row.notes, "tipo", "loyalty_points") as PointsProgram["type"]),
      programName: row.program_name ?? row.name ?? "",
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.025)),
      expirationDate: row.expiration_date ?? "",
    });
  }

  for (const row of mileRows as Array<Record<string, any>>) {
    milesRowsById.set(row.id, row);
    const client = resolveClient(row);
    if (!client) continue;

    const airline = row.airline || row.name || "";
    client.milesPrograms.push({
      id: row.id,
      airline,
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(row.cpm ?? getNotesNumber(row.notes, "cpm", 0.04)),
      bonusPercentage: Number(row.bonus_percentage ?? getNotesNumber(row.notes, "bonus", 0)),
      expirationDate: row.expiration_date ?? "",
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

    const cpm = row.cpm ?? getNotesNumber(row.notes, "cpm", 0);
    const airportFee = row.airport_fee ?? row.taxes ?? getNotesNumber(row.notes, "taxa", 0);
    const paidPrice = row.paid_price ?? row.cash_cost ?? 0;

    client.redemptions.push({
      id: row.id,
      date: row.redemption_date ?? row.departure_date ?? "",
      origin: row.origin ?? "",
      destination: row.destination ?? "",
      airline: row.airline ?? getNotesText(row.notes, "companhia", ""),
      regularPrice: Number(row.regular_price ?? row.sale_price ?? 0),
      paidPrice: Number(paidPrice),
      milesUsed: Number(row.miles_used ?? 0),
      cpm: cpm ? parseCpmInput(cpm) : undefined,
      airportFee: Number(airportFee ?? 0),
    });
  }

  for (const row of goalRows as Array<Record<string, any>>) {
    const client = resolveClient(row);
    if (!client) continue;

    client.goals.push({
      id: row.id,
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
  const profile = client.profile;
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    plan: profile.plan,
    joined_at: nullIfEmpty(profile.joinedAt),
  };

  ensureOnline();
  const { data, error } = await supabase
    .from("clients")
    .upsert([primaryPayload as never])
    .select("id")
    .single();

  if (error) {
    throwSupabaseError("clients.upsert", error, primaryPayload);
  }

  const id = data.id as string;
  return { ...client, id };
}

export async function saveCardToSupabase(userId: string, clientId: string, card: CreditCardRecord) {
  const idPayload = isUuid(card.id) ? { id: card.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
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

  return { ...card, id: await saveByIdOrExternalId("credit_cards", primaryPayload, fallbackPayload, card.id) };
}

export async function savePointsProgramToSupabase(userId: string, clientId: string, program: PointsProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    external_id: getPointsProgramExternalId(clientId, program),
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

  return { ...program, id: await saveByIdOrExternalId("points_programs", primaryPayload, fallbackPayload, program.id) };
}

export async function saveMilesProgramToSupabase(userId: string, clientId: string, program: MilesProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    external_id: externalId("miles", program.id, [clientId, program.airline]),
    airline: program.airline,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    expiration_date: nullIfEmpty(program.expirationDate),
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...program, id: await saveByIdOrExternalId("miles_programs", primaryPayload, fallbackPayload, program.id) };
}

export async function saveTransferToSupabase(
  userId: string,
  clientId: string,
  transfer: BonusTransfer,
  pointsPrograms: PointsProgram[],
  milesPrograms: MilesProgram[],
) {
  const idPayload = isUuid(transfer.id) ? { id: transfer.id } : {};
  const originId = pointsPrograms.find((program) => program.programName === transfer.originProgramName)?.id ?? null;
  const destinationId = milesPrograms.find((program) => program.airline === transfer.destinationProgramName)?.id ?? null;
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
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
  };

  void originId;
  void destinationId;
  return { ...transfer, id: await saveByIdOrExternalId("bonus_transfers", primaryPayload, fallbackPayload, transfer.id) };
}

export async function saveRedemptionToSupabase(userId: string, clientId: string, redemption: FlightRedemption) {
  const idPayload = isUuid(redemption.id) ? { id: redemption.id } : {};
  const costs = getRedemptionCosts(redemption);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    external_id: externalId("redemption", redemption.id, [clientId, redemption.date, redemption.origin, redemption.destination, redemption.airline]),
    redemption_date: nullIfEmpty(redemption.date),
    origin: redemption.origin,
    destination: redemption.destination,
    airline: redemption.airline,
    miles_used: Math.max(0, Math.round(redemption.milesUsed)),
    regular_price: redemption.regularPrice,
    cpm: redemption.cpm ?? null,
    airport_fee: costs.airportFee,
    total_cost: costs.totalCost,
    savings: costs.economy,
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...redemption, id: await saveByIdOrExternalId("flight_redemptions", primaryPayload, fallbackPayload, redemption.id) };
}

export async function saveGoalToSupabase(userId: string, clientId: string, goal: Goal) {
  const idPayload = isUuid(goal.id) ? { id: goal.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    external_id: externalId("goal", goal.id, [clientId, goal.title, goal.destination, goal.deadline]),
    title: goal.title,
    destination: goal.destination,
    required_miles: Math.max(0, Math.round(goal.requiredMiles)),
    deadline: nullIfEmpty(goal.deadline),
  };
  const fallbackPayload = {
    ...primaryPayload,
  };

  return { ...goal, id: await saveByIdOrExternalId("goals", primaryPayload, fallbackPayload, goal.id) };
}

export async function deleteRecordFromSupabase(table: TableName, userId: string, recordId: string) {
  ensureOnline();

  if (!isUuid(recordId)) {
    console.warn("Registro sem id real do Supabase. Removendo apenas do estado/cache.", { table, recordId });
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", recordId)
    .eq("user_id", userId);

  if (error) {
    throwSupabaseError(`${table}.delete`, error, { user_id: userId, id: recordId });
  }
}
