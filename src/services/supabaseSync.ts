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

async function upsertWithCompatibility<TPrimary extends Record<string, any>, TFallback extends Record<string, any>>(
  table: TableName,
  primaryPayload: TPrimary,
  fallbackPayload: TFallback,
) {
  ensureOnline();

  const { data, error } = await supabase
    .from(table)
    .upsert([primaryPayload as never])
    .select("id")
    .single();

  if (!error) {
    return data.id as string;
  }

  if (!isSchemaCompatibilityError(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(table)
    .upsert([fallbackPayload as never])
    .select("id")
    .single();

  if (fallbackError) {
    throw fallbackError;
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
      cardName: row.name ?? row.card_name ?? "",
      limitValue: Number(row.limit_value ?? 0),
      pointsBalance: Number(row.points_balance ?? 0),
      pointsPerDollar: Number(row.points_multiplier ?? row.points_per_dollar ?? 0),
      dueDay: Number(row.due_day ?? 1),
    });
  }

  const pointsRowsById = new Map<string, Record<string, any>>();
  const milesRowsById = new Map<string, Record<string, any>>();

  for (const row of pointRows as Array<Record<string, any>>) {
    pointsRowsById.set(row.id, row);
    const client = resolveClient(row);
    if (!client) continue;

    client.pointsPrograms.push({
      id: row.id,
      type: row.type ?? (getNotesText(row.notes, "tipo", "loyalty_points") as PointsProgram["type"]),
      programName: row.name ?? row.program_name ?? "",
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
      originProgramName: row.origin_program_name || origin?.name || origin?.program_name || getNotesText(row.notes, "origem", ""),
      destinationProgramName: row.destination_program_name || destination?.airline || destination?.name || getNotesText(row.notes, "destino", ""),
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

  const id = await upsertWithCompatibility("clients", primaryPayload, primaryPayload);
  return { ...client, id };
}

export async function saveCardToSupabase(userId: string, clientId: string, card: CreditCardRecord) {
  const idPayload = isUuid(card.id) ? { id: card.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    name: card.cardName,
    bank: card.bank,
    limit_value: card.limitValue,
    points_balance: Math.max(0, Math.round(card.pointsBalance)),
    due_day: card.dueDay,
    points_multiplier: card.pointsPerDollar,
    annual_fee: null,
    brand: null,
    last_four: null,
    closing_day: null,
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    bank: card.bank,
    card_name: card.cardName,
    limit_value: card.limitValue,
    points_balance: Math.max(0, Math.round(card.pointsBalance)),
    points_per_dollar: card.pointsPerDollar,
    due_day: card.dueDay,
  };

  return { ...card, id: await upsertWithCompatibility("credit_cards", primaryPayload, fallbackPayload) };
}

export async function savePointsProgramToSupabase(userId: string, clientId: string, program: PointsProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    type: program.type,
    name: program.programName,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    expiration_date: nullIfEmpty(program.expirationDate),
    notes: getPointsNotes(program),
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    type: program.type,
    program_name: program.programName,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    expiration_date: nullIfEmpty(program.expirationDate),
  };

  return { ...program, id: await upsertWithCompatibility("points_programs", primaryPayload, fallbackPayload) };
}

export async function saveMilesProgramToSupabase(userId: string, clientId: string, program: MilesProgram) {
  const idPayload = isUuid(program.id) ? { id: program.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    name: program.airline,
    airline: program.airline,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    bonus_percentage: program.bonusPercentage,
    expiration_date: nullIfEmpty(program.expirationDate),
    notes: getMilesNotes(program),
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    airline: program.airline,
    balance: Math.max(0, Math.round(program.balance)),
    cpm: parseCpmInput(program.cpm),
    bonus_percentage: program.bonusPercentage,
    expiration_date: nullIfEmpty(program.expirationDate),
  };

  return { ...program, id: await upsertWithCompatibility("miles_programs", primaryPayload, fallbackPayload) };
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
    client_id: clientId,
    points_program_id: isUuid(originId ?? "") ? originId : null,
    miles_program_id: isUuid(destinationId ?? "") ? destinationId : null,
    origin_program_name: transfer.originProgramName,
    destination_program_name: transfer.destinationProgramName,
    transferred_points: Math.max(0, Math.round(transfer.sentAmount)),
    bonus_percentage: transfer.bonusPercentage,
    received_miles: getTransferFinalMiles(transfer),
    transfer_date: nullIfEmpty(transfer.date),
    status: "completed",
    notes: getTransferNotes(transfer),
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    origin_program_id: isUuid(originId ?? "") ? originId : null,
    destination_program_id: isUuid(destinationId ?? "") ? destinationId : null,
    origin_program_name: transfer.originProgramName,
    destination_program_name: transfer.destinationProgramName,
    sent_amount: Math.max(0, Math.round(transfer.sentAmount)),
    bonus_percentage: transfer.bonusPercentage,
    transfer_date: nullIfEmpty(transfer.date),
  };

  return { ...transfer, id: await upsertWithCompatibility("bonus_transfers", primaryPayload, fallbackPayload) };
}

export async function saveRedemptionToSupabase(userId: string, clientId: string, redemption: FlightRedemption) {
  const idPayload = isUuid(redemption.id) ? { id: redemption.id } : {};
  const costs = getRedemptionCosts(redemption);
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: isUuid(clientId) ? clientId : null,
    redemption_date: nullIfEmpty(redemption.date),
    origin: redemption.origin,
    destination: redemption.destination,
    airline: redemption.airline,
    departure_date: nullIfEmpty(redemption.date),
    return_date: null,
    miles_used: Math.max(0, Math.round(redemption.milesUsed)),
    cash_cost: costs.totalCost,
    taxes: costs.airportFee,
    sale_price: redemption.regularPrice,
    regular_price: redemption.regularPrice,
    paid_price: costs.totalCost,
    cpm: redemption.cpm ?? null,
    airport_fee: costs.airportFee,
    status: "completed",
    notes: getRedemptionNotes(redemption),
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    redemption_date: nullIfEmpty(redemption.date),
    origin: redemption.origin,
    destination: redemption.destination,
    airline: redemption.airline,
    regular_price: redemption.regularPrice,
    paid_price: costs.totalCost,
    miles_used: Math.max(0, Math.round(redemption.milesUsed)),
    cpm: redemption.cpm ?? null,
    airport_fee: costs.airportFee,
  };

  return { ...redemption, id: await upsertWithCompatibility("flight_redemptions", primaryPayload, fallbackPayload) };
}

export async function saveGoalToSupabase(userId: string, clientId: string, goal: Goal) {
  const idPayload = isUuid(goal.id) ? { id: goal.id } : {};
  const primaryPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    title: goal.title,
    destination: goal.destination,
    description: getGoalDescription(goal),
    target_value: Math.max(0, Math.round(goal.requiredMiles)),
    required_miles: Math.max(0, Math.round(goal.requiredMiles)),
    current_value: 0,
    due_date: nullIfEmpty(goal.deadline),
    deadline: nullIfEmpty(goal.deadline),
    status: "active",
  };
  const fallbackPayload = {
    ...idPayload,
    user_id: userId,
    client_id: clientId,
    title: goal.title,
    destination: goal.destination,
    required_miles: Math.max(0, Math.round(goal.requiredMiles)),
    deadline: nullIfEmpty(goal.deadline),
  };

  return { ...goal, id: await upsertWithCompatibility("goals", primaryPayload, fallbackPayload) };
}

export async function deleteRecordFromSupabase(table: TableName, userId: string, recordId: string) {
  ensureOnline();

  if (!isUuid(recordId)) {
    throw new SupabaseSyncError("Registro sem id real do Supabase. A exclusao nao foi executada.");
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", recordId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
