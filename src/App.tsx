import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  CreditCard,
  Flag,
  LayoutDashboard,
  LogOut,
  Plane,
  Pencil,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  User,
  WalletCards,
} from "lucide-react";
import { supabase } from "./lib/supabase/client";
import { ensureUserProfile } from "./lib/supabase/ensureUserProfile";
import type { Session } from "@supabase/supabase-js";
import {
  deleteRecordFromSupabase,
  handleSupabaseError,
  loadUserDataFromSupabase,
  saveCardToSupabase,
  saveClientToSupabase,
  saveGoalToSupabase,
  saveMilesProgramToSupabase,
  savePointsProgramToSupabase,
  saveRedemptionToSupabase,
  saveTransferToSupabase,
  type AppData,
  type BonusTransfer,
  type CreditCardRecord,
  type FlightRedemption,
  type Goal,
  type MilesProgram,
  type PointsProgram,
  type Profile,
} from "./services/supabaseSync";

type MigrationSummary = {
  cards: number;
  pointsPrograms: number;
  milesPrograms: number;
  transfers: number;
  redemptions: number;
  goals: number;
};

type Section =
  | "dashboard"
  | "cards"
  | "programs"
  | "economies"
  | "goals"
  | "redemptions"
  | "profile";

const rmOrange = "#f97316";
const chartColors = ["#f97316", "#0f766e", "#2563eb", "#7c3aed", "#eab308", "#64748b"];
const mileValue = 0.025;
const appShellClass = "min-h-screen bg-[#071529] text-white";
const panelClass = "rounded-lg border border-[#1E3A5F] bg-[#0F1F38] text-white shadow";
const softPanelClass = "rounded-lg border border-[#1E3A5F] bg-[#233B5D] text-white";
const mutedTextClass = "text-[#CBD5E1]";
const supportTextClass = "text-[#94A3B8]";
const inputClass = "rounded border border-[#3B5B82] bg-[#233B5D] text-white placeholder:text-[#B8C7D9] outline-none transition focus:border-[#A855F7] focus:ring-4 focus:ring-[#A855F7]/20";
const adminEmails = new Set(["ronaldomds10@gmail.com"]);
const supabaseMigrationFlagKey = "rm-miles-hub-supabase-migrated";

const airports = [
  { code: "GRU", city: "São Paulo" },
  { code: "CGH", city: "São Paulo" },
  { code: "VCP", city: "Campinas" },
  { code: "SDU", city: "Rio de Janeiro" },
  { code: "GIG", city: "Rio de Janeiro" },
  { code: "BSB", city: "Brasília" },
  { code: "CNF", city: "Belo Horizonte" },
  { code: "FOR", city: "Fortaleza" },
  { code: "SSA", city: "Salvador" },
  { code: "REC", city: "Recife" },
  { code: "MCO", city: "Orlando" },
  { code: "JFK", city: "Nova York" },
  { code: "MIA", city: "Miami" },
  { code: "LAX", city: "Los Angeles" },
  { code: "LIS", city: "Lisboa" },
  { code: "MAD", city: "Madrid" },
  { code: "CDG", city: "Paris" },
  { code: "LHR", city: "Londres" },
  { code: "AMS", city: "Amsterdã" },
  { code: "FCO", city: "Roma" },
  { code: "POA", city: "Porto Alegre" },
  { code: "CWB", city: "Curitiba" },
  { code: "SCL", city: "Santiago" },
  { code: "EZE", city: "Buenos Aires" },
  { code: "MEX", city: "Cidade do México" },
  { code: "NRT", city: "Tóquio" },
  { code: "SYD", city: "Sydney" },
];

const bankProgramOptions = [
  "Livelo",
  "Esfera",
  "Curtai",
  "Atomos",
  "Iupp",
  "Nubank",
  "Inter Loop",
  "Caixa",
  "Amex Membership Rewards",
  "Chase Ultimate Rewards",
  "Citi ThankYou",
  "Capital One Miles",
  "Outro...",
];

const airlineProgramOptions = [
  "Smiles",
  "Azul Fidelidade",
  "LATAM Pass",
  "TAP Miles&Go",
  "Iberia Plus",
  "British Airways Executive Club",
  "Flying Blue",
  "AAdvantage",
  "MileagePlus",
  "Aeroplan",
  "ConnectMiles",
  "Outro...",
];

const airlineDefaultCpm: Record<string, number> = {
  Smiles: 0.04,
  "Azul Fidelidade": 0.038,
  "LATAM Pass": 0.045,
  "TAP Miles&Go": 0.05,
  "Iberia Plus": 0.052,
  "British Airways Executive Club": 0.052,
  "Flying Blue": 0.05,
  AAdvantage: 0.055,
  MileagePlus: 0.055,
  Aeroplan: 0.052,
  ConnectMiles: 0.045,
};

function getProgramAccent(programName: string) {
  if (programName.includes("Smiles")) return "#FF5A00";
  if (programName.includes("Azul")) return "#38BDF8";
  if (programName.includes("LATAM")) return "#EF4444";
  return "#CBD5E1";
}

function getTransferFinalMiles(transfer: Pick<BonusTransfer, "sentAmount" | "bonusPercentage">) {
  return Math.round(transfer.sentAmount + transfer.sentAmount * (transfer.bonusPercentage / 100));
}

function getTransferBonusMiles(transfer: Pick<BonusTransfer, "sentAmount" | "bonusPercentage">) {
  return Math.max(getTransferFinalMiles(transfer) - transfer.sentAmount, 0);
}

function getGeneratedMilesForProgram(data: AppData, airline: string) {
  return data.transfers
    .filter((transfer) => transfer.destinationProgramName === airline)
    .reduce((sum, transfer) => sum + getTransferFinalMiles(transfer), 0);
}

function getSentPointsForProgram(data: AppData, programName: string) {
  return data.transfers
    .filter((transfer) => transfer.originProgramName === programName)
    .reduce((sum, transfer) => sum + transfer.sentAmount, 0);
}

function getAirlineBalance(data: AppData, program: MilesProgram) {
  return program.balance + getGeneratedMilesForProgram(data, program.airline);
}

function getBankAvailableBalance(data: AppData, program: PointsProgram) {
  return Math.max(program.balance - getSentPointsForProgram(data, program.programName), 0);
}

function getRedemptionCosts(redemption: FlightRedemption) {
  const airportFee = redemption.airportFee ?? 0;
  const hasNewCostFields = redemption.cpm !== undefined;
  const milesCost = hasNewCostFields ? redemption.milesUsed * parseCpmInput(redemption.cpm ?? 0) : Math.max(redemption.paidPrice - airportFee, 0);
  const totalCost = hasNewCostFields ? milesCost + airportFee : redemption.paidPrice;
  const economy = redemption.regularPrice - totalCost;

  return { airportFee, milesCost, totalCost, economy };
}

const initialData: AppData = {
  id: "client-demo-1",
  localId: "client-demo-1",
  profile: {
    name: "Mariana Costa",
    email: "mariana@exemplo.com",
    phone: "(11) 98888-1234",
    joinedAt: "2025-08-12",
    plan: "Gestao Premium RM",
  },
  cards: [
    {
      id: "card-1",
      bank: "Banco BRB",
      cardName: "DUX Visa Infinite",
      limitValue: 85000,
      pointsBalance: 76000,
      pointsPerDollar: 4,
      dueDay: 10,
    },
    {
      id: "card-2",
      bank: "Itau",
      cardName: "Azul Visa Infinite",
      limitValue: 42000,
      pointsBalance: 54000,
      pointsPerDollar: 3.5,
      dueDay: 18,
    },
    {
      id: "card-3",
      bank: "Santander",
      cardName: "Unlimited Black",
      limitValue: 62000,
      pointsBalance: 37000,
      pointsPerDollar: 2.6,
      dueDay: 25,
    },
  ],
  milesPrograms: [
    { id: "miles-1", airline: "Smiles", balance: 145000, cpm: 0.042, bonusPercentage: 0, expirationDate: "2026-12-01" },
    { id: "miles-2", airline: "LATAM Pass", balance: 128000, cpm: 0.048, bonusPercentage: 0, expirationDate: "2027-02-20" },
    { id: "miles-3", airline: "Azul Fidelidade", balance: 116000, cpm: 0.038, bonusPercentage: 0, expirationDate: "2026-10-30" },
  ],
  pointsPrograms: [
    { id: "points-1", type: "loyalty_points", programName: "Livelo", balance: 180000, cpm: 0.025, expirationDate: "2027-05-12" },
    { id: "points-2", type: "loyalty_points", programName: "Esfera", balance: 81000, cpm: 0.028, expirationDate: "2027-08-15" },
  ],
  transfers: [],
  redemptions: [
    { id: "red-1", date: "2026-01-08", origin: "GRU", destination: "MCO", airline: "LATAM", regularPrice: 6400, paidPrice: 1980, milesUsed: 92000 },
    { id: "red-2", date: "2026-01-22", origin: "VCP", destination: "LIS", airline: "Azul", regularPrice: 7200, paidPrice: 2410, milesUsed: 110000 },
    { id: "red-3", date: "2026-02-11", origin: "CGH", destination: "SDU", airline: "GOL", regularPrice: 1320, paidPrice: 380, milesUsed: 14500 },
    { id: "red-4", date: "2026-02-26", origin: "GRU", destination: "SCL", airline: "LATAM", regularPrice: 2880, paidPrice: 820, milesUsed: 36000 },
    { id: "red-5", date: "2026-03-05", origin: "BSB", destination: "FOR", airline: "GOL", regularPrice: 1880, paidPrice: 510, milesUsed: 22000 },
    { id: "red-6", date: "2026-03-18", origin: "GRU", destination: "CDG", airline: "Air France", regularPrice: 8900, paidPrice: 2860, milesUsed: 132000 },
    { id: "red-7", date: "2026-04-03", origin: "CNF", destination: "SSA", airline: "Azul", regularPrice: 1640, paidPrice: 450, milesUsed: 18000 },
    { id: "red-8", date: "2026-04-16", origin: "GRU", destination: "JFK", airline: "American", regularPrice: 7800, paidPrice: 2350, milesUsed: 118000 },
    { id: "red-9", date: "2026-05-04", origin: "POA", destination: "REC", airline: "LATAM", regularPrice: 2150, paidPrice: 690, milesUsed: 26000 },
    { id: "red-10", date: "2026-05-25", origin: "GRU", destination: "MAD", airline: "Iberia", regularPrice: 8350, paidPrice: 2730, milesUsed: 126000 },
  ],
  goals: [
    { id: "goal-1", title: "Ferias em Orlando", destination: "Orlando", requiredMiles: 1000000, deadline: "2026-12-20" },
    { id: "goal-2", title: "Europa em familia", destination: "Lisboa e Paris", requiredMiles: 780000, deadline: "2027-04-15" },
  ],
};

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cards", label: "Cartoes", icon: CreditCard },
  { id: "programs", label: "Programas", icon: WalletCards },
  { id: "economies", label: "Economias", icon: BadgeDollarSign },
  { id: "goals", label: "Metas", icon: Target },
  { id: "redemptions", label: "Emissoes", icon: Plane },
  { id: "profile", label: "Perfil", icon: User },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const cpmNumber = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function formatMiles(value: number) {
  return Number(normalizeSavedMiles(value) || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
}

function formatMileagePoints(value: number) {
  return number.format(Math.trunc(Number(value) || 0));
}

function parseMilesInput(value: string | number) {
  return parseInt(String(value).replace(/\D/g, ""), 10) || 0;
}

function parseCpmInput(value: string | number) {
  const parsedValue = Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsedValue)) return 0;
  return parsedValue > 1 ? parsedValue / 1000 : parsedValue;
}

function formatCpm(value: string | number) {
  return `R$ ${cpmNumber.format(parseCpmInput(value))}`;
}

function normalizeSavedMiles(value: string | number) {
  const str = String(value);

  if (str.includes(".") || str.includes(",")) {
    const onlyDigits = str.replace(/\D/g, "");
    return parseInt(onlyDigits, 10) * 10;
  }

  return parseInt(str.replace(/\D/g, ""), 10) || 0;
}

type LegacyClientData = Partial<AppData> & {
  programs?: Array<{
    id?: string;
    programName?: string;
    balance?: number;
    expirationDate?: string;
  }>;
};

function normalizeClient(rawClient: LegacyClientData, index = 0): AppData {
  const fallback = index === 0 ? initialData : createEmptyClient();

  return {
    ...fallback,
    ...rawClient,
    id: rawClient.id ?? fallback.id ?? crypto.randomUUID(),
    localId: rawClient.localId ?? rawClient.id ?? fallback.localId ?? crypto.randomUUID(),
    profile: {
      ...fallback.profile,
      ...rawClient.profile,
    },
    cards: rawClient.cards ?? fallback.cards ?? [],
    milesPrograms: (
      rawClient.milesPrograms ??
      rawClient.programs?.map((program) => ({
        id: program.id ?? crypto.randomUUID(),
        airline: program.programName ?? "Smiles",
        balance: program.balance ?? 0,
        cpm: 0.04,
        bonusPercentage: 0,
        expirationDate: program.expirationDate ?? "",
      })) ??
      fallback.milesPrograms ??
      []
    ).map((program) => ({
      ...program,
      cpm: parseCpmInput(program.cpm),
    })),
    pointsPrograms: (rawClient.pointsPrograms ?? fallback.pointsPrograms ?? []).map((program) => ({
      ...program,
      cpm: parseCpmInput(program.cpm),
    })),
    transfers: rawClient.transfers ?? fallback.transfers ?? [],
    redemptions: (rawClient.redemptions ?? fallback.redemptions ?? []).map((redemption) => ({
      ...redemption,
      cpm: redemption.cpm === undefined ? undefined : parseCpmInput(redemption.cpm),
    })),
    goals: (rawClient.goals ?? fallback.goals ?? []).map((goal) => ({
      ...goal,
      requiredMiles: normalizeSavedMiles(goal.requiredMiles),
    })),
  };
}

function loadData() {
  const clientsStored = localStorage.getItem("rm-miles-hub-clients");
  if (clientsStored) {
    const parsedClients = JSON.parse(clientsStored) as LegacyClientData[];
    const normalizedClients = parsedClients.map((client, index) => normalizeClient(client, index));
    localStorage.setItem("rm-miles-hub-clients", JSON.stringify(normalizedClients));
    return normalizedClients;
  }

  const legacyStored = localStorage.getItem("rm-miles-hub-data");
  if (legacyStored) {
    const legacy = JSON.parse(legacyStored) as LegacyClientData;
    const migrated = [normalizeClient(legacy)];
    localStorage.setItem("rm-miles-hub-clients", JSON.stringify(migrated));
    return migrated;
  }

  localStorage.setItem("rm-miles-hub-clients", JSON.stringify([initialData]));
  return [initialData];
}

function saveData(clients: AppData[]) {
  localStorage.setItem("rm-miles-hub-clients", JSON.stringify(clients));
}

function createEmptyClient(): AppData {
  const localId = crypto.randomUUID();
  return {
    id: localId,
    localId,
    profile: {
      name: "Novo Cliente",
      email: "",
      phone: "",
      joinedAt: new Date().toISOString().slice(0, 10),
      plan: "Gestao RM",
    },
    cards: [],
    milesPrograms: [],
    pointsPrograms: [],
    transfers: [],
    redemptions: [],
    goals: [],
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueClientsForDisplay(clients: AppData[]) {
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

function getSourceIdFromNotes(notes: string | null | undefined) {
  const match = notes?.match(/^Migrado do localStorage: ([^;]+)/);
  return match?.[1] ?? "";
}

function mapSupabaseClientToAppData(
  client: {
    id: string;
    local_id?: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    plan: string;
    joined_at: string | null;
    notes: string | null;
  },
  fallback: AppData,
): AppData {
  return {
    ...fallback,
    id: client.id,
    localId: client.local_id ?? client.id,
    profile: {
      ...fallback.profile,
      name: client.name || fallback.profile.name,
      email: client.email || fallback.profile.email,
      phone: client.phone || "",
      joinedAt: client.joined_at || fallback.profile.joinedAt,
      plan: client.plan || fallback.profile.plan,
    },
  };
}

async function loadProfileClientsFromSupabase(userId: string) {
  const { data: supabaseClients, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!supabaseClients || supabaseClients.length === 0) {
    return [];
  }

  const profileClients = uniqueClientsForDisplay((supabaseClients as Array<any>).map((client) => mapSupabaseClientToAppData(client, createEmptyClient())));

  return loadMileageAndPointsFromSupabase(userId, profileClients);
}

async function loadMileageAndPointsFromSupabase(userId: string, baseClients: AppData[]) {
  const [pointsResult, milesResult, transfersResult] = await Promise.all([
    supabase
      .from("points_programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("miles_programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("bonus_transfers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (pointsResult.error) throw pointsResult.error;
  if (milesResult.error) throw milesResult.error;
  if (transfersResult.error) throw transfersResult.error;

  const pointsRows = pointsResult.data ?? [];
  const milesRows = milesResult.data ?? [];
  const transferRows = transfersResult.data ?? [];
  const hasSupabaseMileageData = pointsRows.length > 0 || milesRows.length > 0 || transferRows.length > 0;

  if (!hasSupabaseMileageData) {
    return baseClients;
  }

  const pointsById = new Map(pointsRows.map((row) => [row.id, row]));
  const milesById = new Map(milesRows.map((row) => [row.id, row]));

  const pointsPrograms: PointsProgram[] = pointsRows.map((row) => {
    const rawRow = row as typeof row & { type?: PointsProgram["type"]; cpm?: number; program_name?: string };
    return {
      id: row.id,
      type: rawRow.type ?? (getNotesText(row.notes, "tipo", "loyalty_points") as PointsProgram["type"]),
      programName: row.name || rawRow.program_name || "",
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(rawRow.cpm ?? getNotesNumber(row.notes, "cpm", 0.025)),
      expirationDate: row.expiration_date ?? "",
    };
  });

  const milesPrograms: MilesProgram[] = milesRows.map((row) => {
    const rawRow = row as typeof row & { cpm?: number; bonus_percentage?: number };
    const airline = row.airline || row.name;
    return {
      id: row.id,
      airline,
      balance: Number(row.balance ?? 0),
      cpm: parseCpmInput(rawRow.cpm ?? getNotesNumber(row.notes, "cpm", airlineDefaultCpm[airline] ?? 0.04)),
      bonusPercentage: Number(rawRow.bonus_percentage ?? getNotesNumber(row.notes, "bonus", 0)),
      expirationDate: row.expiration_date ?? "",
    };
  });

  const transfers: BonusTransfer[] = transferRows.map((row) => {
    const rawRow = row as typeof row & {
      origin_program_name?: string | null;
      destination_program_name?: string | null;
      origin_program_id?: string | null;
      destination_program_id?: string | null;
      sent_amount?: number | null;
      transfer_date?: string | null;
    };
    const originProgramId = row.points_program_id ?? rawRow.origin_program_id;
    const destinationProgramId = row.miles_program_id ?? rawRow.destination_program_id;
    const originProgram = originProgramId ? pointsById.get(originProgramId) : undefined;
    const destinationProgram = destinationProgramId ? milesById.get(destinationProgramId) : undefined;
    const rawOriginProgram = originProgram as typeof originProgram & { program_name?: string } | undefined;

    return {
      id: row.id,
      originProgramName: rawRow.origin_program_name || originProgram?.name || rawOriginProgram?.program_name || getNotesText(row.notes, "origem", ""),
      destinationProgramName: rawRow.destination_program_name || destinationProgram?.airline || destinationProgram?.name || getNotesText(row.notes, "destino", ""),
      sentAmount: Number(row.transferred_points ?? rawRow.sent_amount ?? 0),
      bonusPercentage: Number(row.bonus_percentage ?? 0),
      date: rawRow.transfer_date ?? row.transfer_date ?? "",
    };
  });

  const [firstClient, ...remainingClients] = baseClients.length > 0 ? baseClients : [createEmptyClient()];
  return [
    {
      ...firstClient,
      pointsPrograms,
      milesPrograms,
      transfers,
    },
    ...remainingClients,
  ];
}

function getLocalStorageClientsForMigration() {
  const clientsStored = localStorage.getItem("rm-miles-hub-clients");
  if (clientsStored) {
    return (JSON.parse(clientsStored) as LegacyClientData[]).map((client, index) => normalizeClient(client, index));
  }

  const legacyStored = localStorage.getItem("rm-miles-hub-data");
  if (legacyStored) {
    return [normalizeClient(JSON.parse(legacyStored) as LegacyClientData)];
  }

  return [] as AppData[];
}

function hasLocalStorageDataForSupabaseMigration() {
  return Boolean(localStorage.getItem("rm-miles-hub-clients") || localStorage.getItem("rm-miles-hub-data"));
}

function hasSupabaseMigrationFlag() {
  return localStorage.getItem(supabaseMigrationFlagKey) === "true";
}

function setSupabaseMigrationFlag() {
  localStorage.setItem(supabaseMigrationFlagKey, "true");
}

function nullIfEmpty(value: string | undefined) {
  return value?.trim() ? value : null;
}

function getMigrationNotes(sourceId: string, details?: string) {
  return `Migrado do localStorage: ${sourceId}${details ? `; ${details}` : ""}`;
}

function getNotesNumber(notes: string | null | undefined, key: string, fallback: number) {
  const match = notes?.match(new RegExp(`${key}:\\s*([^;]+)`));
  return match ? parseCpmInput(match[1]) : fallback;
}

function getNotesText(notes: string | null | undefined, key: string, fallback: string) {
  const match = notes?.match(new RegExp(`${key}:\\s*([^;]+)`));
  return match?.[1]?.trim() || fallback;
}

function getTransferNotes(transfer: BonusTransfer) {
  return getMigrationNotes(
    transfer.id,
    `origem: ${transfer.originProgramName}; destino: ${transfer.destinationProgramName}`,
  );
}

function createLocalId() {
  return crypto.randomUUID();
}

function getPointsProgramSaveKey(program: PointsProgram) {
  return [
    program.type,
    program.programName.trim().toLowerCase(),
    Math.max(0, Math.round(program.balance)),
    parseCpmInput(program.cpm),
    program.expirationDate || "",
  ].join("|");
}

function uniquePointProgramsForSave(programs: PointsProgram[]) {
  const seen = new Set<string>();
  return programs.filter((program) => {
    const key = getPointsProgramSaveKey(program);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMilesProgramSaveKey(program: MilesProgram) {
  return [
    program.airline.trim().toLowerCase(),
    Math.max(0, Math.round(program.balance)),
    parseCpmInput(program.cpm),
    program.expirationDate || "",
  ].join("|");
}

function uniqueMilesProgramsForSave(programs: MilesProgram[]) {
  const seen = new Set<string>();
  return programs.filter((program) => {
    const key = getMilesProgramSaveKey(program);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDuplicateError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function ensureMigratedClient(userId: string, localClient: AppData, index: number) {
  const profile = localClient.profile;
  const name = profile.name || profile.email || "Cliente";
  const email = profile.email || "";
  const joinedAt = profile.joinedAt || new Date().toISOString().slice(0, 10);
  const plan = profile.plan || "free";

  if (index === 0) {
    const { data: existingClient, error: selectError } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingClient) {
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          name,
          email,
          phone: profile.phone || "",
          plan,
          joined_at: joinedAt,
          notes: getMigrationNotes(localClient.id),
        })
        .eq("id", existingClient.id)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      return existingClient.id;
    }
  }

  const notes = getMigrationNotes(localClient.id);
  const { data: existingByNotes, error: notesError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .eq("notes", notes)
    .limit(1)
    .maybeSingle();

  if (notesError) {
    throw notesError;
  }

  if (existingByNotes) {
    return existingByNotes.id;
  }

  const { data: insertedClient, error: insertError } = await supabase
    .from("clients")
    .insert([
      {
        user_id: userId,
        name,
        email,
        phone: profile.phone || "",
        plan,
        joined_at: joinedAt,
        notes,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedClient.id;
}

async function ensureMigratedPointsProgram(userId: string, program: PointsProgram) {
  const notes = getMigrationNotes(program.id, `tipo: ${program.type}; cpm: ${parseCpmInput(program.cpm)}`);
  const { data: existing, error: selectError } = await supabase
    .from("points_programs")
    .select("id")
    .eq("user_id", userId)
    .eq("notes", notes)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return { id: existing.id, inserted: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("points_programs")
    .insert([
      {
        user_id: userId,
        name: program.programName,
        balance: Math.max(0, Math.round(program.balance)),
        expiration_date: nullIfEmpty(program.expirationDate),
        notes,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    if (isDuplicateError(insertError)) {
      return { id: "", inserted: false };
    }
    throw insertError;
  }

  return { id: inserted.id, inserted: true };
}

async function ensureMigratedMilesProgram(userId: string, program: MilesProgram) {
  const notes = getMigrationNotes(program.id, `cpm: ${parseCpmInput(program.cpm)}; bonus: ${program.bonusPercentage}`);
  const { data: existing, error: selectError } = await supabase
    .from("miles_programs")
    .select("id")
    .eq("user_id", userId)
    .eq("notes", notes)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return { id: existing.id, inserted: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("miles_programs")
    .insert([
      {
        user_id: userId,
        name: program.airline,
        airline: program.airline,
        balance: Math.max(0, Math.round(program.balance)),
        expiration_date: nullIfEmpty(program.expirationDate),
        notes,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    if (isDuplicateError(insertError)) {
      return { id: "", inserted: false };
    }
    throw insertError;
  }

  return { id: inserted.id, inserted: true };
}

async function migrateLocalStorageToSupabase() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("Usuario autenticado nao encontrado.");
  }

  const localClients = getLocalStorageClientsForMigration();
  const summary: MigrationSummary = {
    cards: 0,
    pointsPrograms: 0,
    milesPrograms: 0,
    transfers: 0,
    redemptions: 0,
    goals: 0,
  };

  await ensureUserProfile(user);

  for (const [clientIndex, localClient] of localClients.entries()) {
    const profile = localClient.profile;
    const profileName = profile.name || profile.email || user.email || "Usuario";

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        email: profile.email || user.email || "",
        name: profileName,
        full_name: profileName,
        phone: profile.phone || "",
      })
      .eq("user_id", user.id);

    if (profileError) {
      throw profileError;
    }

    const clientId = await ensureMigratedClient(user.id, localClient, clientIndex);
    const pointsProgramIds = new Map<string, string>();
    const milesProgramIds = new Map<string, string>();

    for (const card of localClient.cards) {
      const { data: existingCard, error: cardSelectError } = await supabase
        .from("credit_cards")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", card.cardName)
        .eq("bank", card.bank)
        .eq("due_day", card.dueDay)
        .limit(1)
        .maybeSingle();

      if (cardSelectError) {
        throw cardSelectError;
      }

      if (!existingCard) {
        const { error: cardInsertError } = await supabase.from("credit_cards").insert([
          {
            user_id: user.id,
            name: card.cardName,
            bank: card.bank,
            due_day: card.dueDay,
            annual_fee: null,
            points_multiplier: Number(card.pointsPerDollar) || 0,
            brand: null,
            last_four: null,
            closing_day: null,
          },
        ]);

        if (cardInsertError && !isDuplicateError(cardInsertError)) {
          throw cardInsertError;
        }

        if (!cardInsertError) {
          summary.cards += 1;
        }
      }
    }

    for (const program of localClient.pointsPrograms) {
      const result = await ensureMigratedPointsProgram(user.id, program);
      if (result.id) {
        pointsProgramIds.set(program.programName, result.id);
      }
      if (result.inserted) {
        summary.pointsPrograms += 1;
      }
    }

    for (const program of localClient.milesPrograms) {
      const result = await ensureMigratedMilesProgram(user.id, program);
      if (result.id) {
        milesProgramIds.set(program.airline, result.id);
      }
      if (result.inserted) {
        summary.milesPrograms += 1;
      }
    }

    for (const transfer of localClient.transfers) {
      const receivedMiles = getTransferFinalMiles(transfer);
      const notes = getMigrationNotes(
        transfer.id,
        `origem: ${transfer.originProgramName}; destino: ${transfer.destinationProgramName}`,
      );
      const { data: existingTransfer, error: transferSelectError } = await supabase
        .from("bonus_transfers")
        .select("id")
        .eq("user_id", user.id)
        .eq("notes", notes)
        .limit(1)
        .maybeSingle();

      if (transferSelectError) {
        throw transferSelectError;
      }

      if (!existingTransfer) {
        const { error: transferInsertError } = await supabase.from("bonus_transfers").insert([
          {
            user_id: user.id,
            points_program_id: pointsProgramIds.get(transfer.originProgramName) ?? null,
            miles_program_id: milesProgramIds.get(transfer.destinationProgramName) ?? null,
            transferred_points: Math.max(0, Math.round(transfer.sentAmount)),
            bonus_percentage: transfer.bonusPercentage,
            received_miles: receivedMiles,
            transfer_date: nullIfEmpty(transfer.date),
            status: "completed",
            notes,
          },
        ]);

        if (transferInsertError && !isDuplicateError(transferInsertError)) {
          throw transferInsertError;
        }

        if (!transferInsertError) {
          summary.transfers += 1;
        }
      }
    }

    for (const redemption of localClient.redemptions) {
      const costs = getRedemptionCosts(redemption);
      const notes = getMigrationNotes(redemption.id, `companhia: ${redemption.airline}`);
      const { data: existingRedemption, error: redemptionSelectError } = await supabase
        .from("flight_redemptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("notes", notes)
        .limit(1)
        .maybeSingle();

      if (redemptionSelectError) {
        throw redemptionSelectError;
      }

      if (!existingRedemption) {
        const { error: redemptionInsertError } = await supabase.from("flight_redemptions").insert([
          {
            user_id: user.id,
            client_id: clientId,
            miles_program_id: milesProgramIds.get(redemption.airline) ?? null,
            origin: redemption.origin,
            destination: redemption.destination,
            departure_date: nullIfEmpty(redemption.date),
            return_date: null,
            miles_used: Math.max(0, Math.round(redemption.milesUsed)),
            cash_cost: costs.totalCost,
            taxes: costs.airportFee,
            sale_price: redemption.regularPrice,
            status: "completed",
            notes,
          },
        ]);

        if (redemptionInsertError && !isDuplicateError(redemptionInsertError)) {
          throw redemptionInsertError;
        }

        if (!redemptionInsertError) {
          summary.redemptions += 1;
        }
      }
    }

    for (const goal of localClient.goals) {
      const description = getMigrationNotes(goal.id, `destino: ${goal.destination}`);
      const { data: existingGoal, error: goalSelectError } = await supabase
        .from("goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("description", description)
        .limit(1)
        .maybeSingle();

      if (goalSelectError) {
        throw goalSelectError;
      }

      if (!existingGoal) {
        const { error: goalInsertError } = await supabase.from("goals").insert([
          {
            user_id: user.id,
            title: goal.title,
            description,
            target_value: normalizeSavedMiles(goal.requiredMiles),
            current_value: 0,
            due_date: nullIfEmpty(goal.deadline),
            status: "active",
          },
        ]);

        if (goalInsertError && !isDuplicateError(goalInsertError)) {
          throw goalInsertError;
        }

        if (!goalInsertError) {
          summary.goals += 1;
        }
      }
    }
  }

  return summary;
}

async function migrateLocalMileageAndPointsToSupabase() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("Usuario autenticado nao encontrado.");
  }

  const localClients = getLocalStorageClientsForMigration();
  const summary: MigrationSummary = {
    cards: 0,
    pointsPrograms: 0,
    milesPrograms: 0,
    transfers: 0,
    redemptions: 0,
    goals: 0,
  };

  await ensureUserProfile(user);

  for (const [clientIndex, localClient] of localClients.entries()) {
    await ensureMigratedClient(user.id, localClient, clientIndex);
    const pointsProgramIds = new Map<string, string>();
    const milesProgramIds = new Map<string, string>();

    for (const program of localClient.pointsPrograms) {
      const result = await ensureMigratedPointsProgram(user.id, program);
      if (result.id) {
        pointsProgramIds.set(program.programName, result.id);
      }
      if (result.inserted) {
        summary.pointsPrograms += 1;
      }
    }

    for (const program of localClient.milesPrograms) {
      const result = await ensureMigratedMilesProgram(user.id, program);
      if (result.id) {
        milesProgramIds.set(program.airline, result.id);
      }
      if (result.inserted) {
        summary.milesPrograms += 1;
      }
    }

    for (const transfer of localClient.transfers) {
      const receivedMiles = getTransferFinalMiles(transfer);
      const notes = getTransferNotes(transfer);
      const { data: existingTransfer, error: transferSelectError } = await supabase
        .from("bonus_transfers")
        .select("id")
        .eq("user_id", user.id)
        .eq("notes", notes)
        .limit(1)
        .maybeSingle();

      if (transferSelectError) {
        throw transferSelectError;
      }

      if (!existingTransfer) {
        const { error: transferInsertError } = await supabase.from("bonus_transfers").insert([
          {
            user_id: user.id,
            points_program_id: pointsProgramIds.get(transfer.originProgramName) ?? null,
            miles_program_id: milesProgramIds.get(transfer.destinationProgramName) ?? null,
            transferred_points: Math.max(0, Math.round(transfer.sentAmount)),
            bonus_percentage: transfer.bonusPercentage,
            received_miles: receivedMiles,
            transfer_date: nullIfEmpty(transfer.date),
            status: "completed",
            notes,
          },
        ]);

        if (transferInsertError && !isDuplicateError(transferInsertError)) {
          throw transferInsertError;
        }

        if (!transferInsertError) {
          summary.transfers += 1;
        }
      }
    }
  }

  return summary;
}

async function migrateLocalCacheToSupabase(userId: string, localClients: AppData[]) {
  const summary: MigrationSummary = {
    cards: 0,
    pointsPrograms: 0,
    milesPrograms: 0,
    transfers: 0,
    redemptions: 0,
    goals: 0,
  };

  for (const localClient of localClients) {
    const savedClient = await saveClientToSupabase(userId, localClient);
    const savedPoints: PointsProgram[] = [];
    const savedMiles: MilesProgram[] = [];

    for (const card of localClient.cards) {
      await saveCardToSupabase(userId, savedClient.id, card);
      summary.cards += 1;
    }

    for (const program of localClient.pointsPrograms) {
      savedPoints.push(await savePointsProgramToSupabase(userId, savedClient.id, program));
      summary.pointsPrograms += 1;
    }

    for (const program of localClient.milesPrograms) {
      savedMiles.push(await saveMilesProgramToSupabase(userId, savedClient.id, program));
      summary.milesPrograms += 1;
    }

    for (const transfer of localClient.transfers) {
      await saveTransferToSupabase(userId, savedClient.id, transfer, savedPoints, savedMiles);
      summary.transfers += 1;
    }

    for (const redemption of localClient.redemptions) {
      await saveRedemptionToSupabase(userId, savedClient.id, redemption);
      summary.redemptions += 1;
    }

    for (const goal of localClient.goals) {
      await saveGoalToSupabase(userId, savedClient.id, goal);
      summary.goals += 1;
    }
  }

  return summary;
}

async function hasExistingSupabaseAppData(userId: string) {
  const tables = [
    "credit_cards",
    "points_programs",
    "miles_programs",
    "bonus_transfers",
    "flight_redemptions",
    "goals",
  ] as const;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

async function hasExistingSupabaseMileageData(userId: string) {
  const tables = ["points_programs", "miles_programs", "bonus_transfers"] as const;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [clients, setClients] = useState<AppData[]>([]);
  const [activeClientId, setActiveClientId] = useState("");
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [autoMigrationMessage, setAutoMigrationMessage] = useState("");
  const isSavingDataRef = useRef(false);

  const data = clients.find((client) => client.id === activeClientId) ?? clients[0] ?? initialData;
  const isAdmin = Boolean(session?.user.email && adminEmails.has(session.user.email));

  function setLoadedClients(loadedClients: AppData[]) {
    const uniqueClients = uniqueClientsForDisplay(loadedClients);
    setClients(uniqueClients);
    setActiveClientId((currentClientId) =>
      currentClientId && uniqueClients.some((client) => client.id === currentClientId)
        ? currentClientId
        : uniqueClients[0]?.id ?? initialData.id,
    );
  }

  function hydrateLocalData() {
    setLoadedClients(loadData());
  }

  async function hydrateProfileClients(userId: string) {
    try {
      const remote = await loadUserDataFromSupabase(userId);
      const loadedClients = remote.clients.filter((client) => isUuid(client.id));
      setLoadedClients(loadedClients);
    } catch (error) {
      console.error("Nao foi possivel carregar perfil/clientes do Supabase.", error);
      setLoadedClients([]);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      if (currentSession) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Sessao restaurada, mas nao foi possivel buscar o usuario autenticado.", error);
        }

        if (user) {
          await ensureUserProfile(user);
          await hydrateProfileClients(user.id);
        }

        if (!mounted) return;
      }
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Auth mudou, mas nao foi possivel buscar o usuario autenticado.", error);
        }

        if (user) {
          await ensureUserProfile(user);
          await hydrateProfileClients(user.id);
        }

        if (!mounted) return;
        return;
      }

      setClients([]);
      setActiveClientId("");
      setActiveSection("dashboard");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function updateClients(nextClients: AppData[]) {
    const uniqueClients = uniqueClientsForDisplay(nextClients);
    setClients(uniqueClients);
    saveData(uniqueClients);
  }

  async function getAuthenticatedUserId() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw error ?? new Error("Usuario autenticado nao encontrado.");
    }

    return user.id;
  }

  async function persistAppData(_previousData: AppData, nextData: AppData) {
    return nextData;
  }

  async function runSingleRecordSync<T>(context: string, callback: (userId: string) => Promise<T>) {
    if (isSavingDataRef.current) {
      return null;
    }

    isSavingDataRef.current = true;

    try {
      const userId = await getAuthenticatedUserId();
      return await callback(userId);
    } catch (error) {
      handleSupabaseError(context, error);
      return null;
    } finally {
      isSavingDataRef.current = false;
    }
  }

  async function createCard(card: CreditCardRecord) {
    return runSingleRecordSync("credit_cards.create", (userId) => saveCardToSupabase(userId, data.id, card));
  }

  async function updateCard(card: CreditCardRecord) {
    return runSingleRecordSync("credit_cards.update", (userId) => saveCardToSupabase(userId, data.id, card));
  }

  async function deleteCard(card: CreditCardRecord) {
    if (!isUuid(card.id)) {
      console.warn("Cartao sem id real do Supabase. Removendo apenas do estado/cache.", card.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("credit_cards.delete", (userId) => deleteRecordFromSupabase("credit_cards", userId, card.id).then(() => true)));
  }

  async function createPointsProgram(program: PointsProgram) {
    return runSingleRecordSync("points_programs.create", (userId) => savePointsProgramToSupabase(userId, data.id, program));
  }

  async function updatePointsProgram(program: PointsProgram) {
    return runSingleRecordSync("points_programs.update", (userId) => savePointsProgramToSupabase(userId, data.id, program));
  }

  async function deletePointsProgram(program: PointsProgram) {
    if (!isUuid(program.id)) {
      console.warn("Programa de pontos sem id real do Supabase. Removendo apenas do estado/cache.", program.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("points_programs.delete", (userId) => deleteRecordFromSupabase("points_programs", userId, program.id).then(() => true)));
  }

  async function createMilesProgram(program: MilesProgram) {
    return runSingleRecordSync("miles_programs.create", (userId) => saveMilesProgramToSupabase(userId, data.id, program));
  }

  async function updateMilesProgram(program: MilesProgram) {
    return runSingleRecordSync("miles_programs.update", (userId) => saveMilesProgramToSupabase(userId, data.id, program));
  }

  async function deleteMilesProgram(program: MilesProgram) {
    if (!isUuid(program.id)) {
      console.warn("Programa de milhas sem id real do Supabase. Removendo apenas do estado/cache.", program.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("miles_programs.delete", (userId) => deleteRecordFromSupabase("miles_programs", userId, program.id).then(() => true)));
  }

  async function createTransfer(transfer: BonusTransfer, pointsPrograms = data.pointsPrograms, milesPrograms = data.milesPrograms) {
    return runSingleRecordSync("bonus_transfers.create", (userId) => saveTransferToSupabase(userId, data.id, transfer, pointsPrograms, milesPrograms));
  }

  async function updateTransfer(transfer: BonusTransfer, pointsPrograms = data.pointsPrograms, milesPrograms = data.milesPrograms) {
    return runSingleRecordSync("bonus_transfers.update", (userId) => saveTransferToSupabase(userId, data.id, transfer, pointsPrograms, milesPrograms));
  }

  async function deleteTransfer(transfer: BonusTransfer) {
    if (!isUuid(transfer.id)) {
      console.warn("Transferencia sem id real do Supabase. Removendo apenas do estado/cache.", transfer.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("bonus_transfers.delete", (userId) => deleteRecordFromSupabase("bonus_transfers", userId, transfer.id).then(() => true)));
  }

  async function createRedemption(redemption: FlightRedemption) {
    return runSingleRecordSync("flight_redemptions.create", (userId) => saveRedemptionToSupabase(userId, data.id, redemption));
  }

  async function updateRedemption(redemption: FlightRedemption) {
    return runSingleRecordSync("flight_redemptions.update", (userId) => saveRedemptionToSupabase(userId, data.id, redemption));
  }

  async function deleteRedemption(redemption: FlightRedemption) {
    if (!isUuid(redemption.id)) {
      console.warn("Emissao sem id real do Supabase. Removendo apenas do estado/cache.", redemption.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("flight_redemptions.delete", (userId) => deleteRecordFromSupabase("flight_redemptions", userId, redemption.id).then(() => true)));
  }

  async function createGoal(goal: Goal) {
    return runSingleRecordSync("goals.create", (userId) => saveGoalToSupabase(userId, data.id, goal));
  }

  async function updateGoal(goal: Goal) {
    return runSingleRecordSync("goals.update", (userId) => saveGoalToSupabase(userId, data.id, goal));
  }

  async function deleteGoal(goal: Goal) {
    if (!isUuid(goal.id)) {
      console.warn("Meta sem id real do Supabase. Removendo apenas do estado/cache.", goal.id);
      return true;
    }
    return Boolean(await runSingleRecordSync("goals.delete", (userId) => deleteRecordFromSupabase("goals", userId, goal.id).then(() => true)));
  }

  async function updateData(nextData: AppData) {
    if (isSavingDataRef.current) {
      return false;
    }

    isSavingDataRef.current = true;

    try {
      const previousData = data;
      const syncedData = await persistAppData(previousData, nextData);
      updateClients(clients.map((client) => (client.id === previousData.id ? syncedData : client)));
      return true;
    } catch (error) {
      handleSupabaseError("app.updateData", error, { clientId: nextData.id });
      return false;
    } finally {
      isSavingDataRef.current = false;
    }
  }

  async function addClient() {
    try {
      const userId = await getAuthenticatedUserId();
      const nextClient = createEmptyClient();
      const savedClient = await saveClientToSupabase(userId, nextClient);

      updateClients([...clients, savedClient]);
      setActiveClientId(savedClient.id);
      setActiveSection("profile");
    } catch (error) {
      handleSupabaseError("clients.create", error);
    }
  }

  async function deleteClient(client: AppData) {
    if (client.id === clients[0]?.id) {
      console.warn("Cliente principal protegido: remocao bloqueada.");
      return;
    }

    const removeFromLocalState = () => {
      const remaining = clients.filter((currentClient) => currentClient.id !== client.id);
      updateClients(remaining);
      if (activeClientId === client.id) {
        setActiveClientId(remaining[0]?.id ?? "");
      }
    };

    if (!isUuid(client.id)) {
      console.warn("Cliente sem id real do Supabase. Removendo apenas do cache local.", client.id);
      removeFromLocalState();
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("Usuario autenticado nao encontrado.");
      }

      const { data: deletedRows, error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("Cliente nao encontrado para o usuario autenticado.");
      }

      removeFromLocalState();
    } catch (error) {
      handleSupabaseError("clients.delete", error, { id: client.id });
    }
  }

  async function updateProfileClient(nextData: AppData) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("Usuario autenticado nao encontrado.");
      }

      const profile = nextData.profile;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          full_name: profile.name,
          email: profile.email,
          phone: profile.phone,
        })
        .eq("user_id", user.id);

      if (profileError) {
        throw profileError;
      }

      const savedClient = await saveClientToSupabase(user.id, nextData);
      updateClients(clients.map((client) => (client.id === nextData.id ? savedClient : client)));
      return true;
    } catch (error) {
      handleSupabaseError("clients.updateProfile", error, { id: nextData.id });
      return false;
    }
  }

  async function handleLogin(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Login realizado, mas nao foi possivel buscar o usuario autenticado.", userError);
      return true;
    }

    if (user) {
      await ensureUserProfile(user);
    }

    return true;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleManualMigration() {
    console.warn("Migracao localStorage -> Supabase temporariamente bloqueada para evitar duplicacao automatica.");
    return;

    if (!window.confirm("Migrar dados do localStorage para o Supabase agora? Esta acao pode recriar dados locais no banco.")) {
      return;
    }

    const confirmation = window.prompt('Digite exatamente: "Tenho certeza que desejo migrar dados locais para Supabase"');
    if (confirmation !== "Tenho certeza que desejo migrar dados locais para Supabase") {
      return;
    }

    setMigrationError("");
    setMigrationSummary(null);
    setIsMigrating(true);

    try {
      const userId = await getAuthenticatedUserId();
      const summary = await migrateLocalCacheToSupabase(userId, getLocalStorageClientsForMigration());
      setMigrationSummary(summary);
    } catch (error) {
      console.error("Falha ao migrar dados locais para o Supabase.", error);
      setMigrationError("Nao foi possivel migrar os dados locais para o Supabase. Veja o console.");
    } finally {
      setIsMigrating(false);
    }
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#071529] px-4 py-10 text-white">
        <BrandInline />
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className={appShellClass}>
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-[#1E3A5F] bg-[#0F1F38] xl:flex xl:flex-col">
        <BrandBlock />
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </nav>
        <div className="p-4">
          <div className={softPanelClass + " p-4"}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={18} />
              Gestao RM ativa
            </div>
            <p className={"mt-2 text-xs leading-5 " + mutedTextClass}>
              Seus indicadores sao atualizados automaticamente a cada lancamento.
            </p>
          </div>
        </div>
      </aside>

      <div className="xl:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#1E3A5F] bg-[#0F1F38]/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="xl:hidden">
              <BrandInline />
            </div>
            <div className="hidden xl:block">
              <p className={"text-sm font-medium " + mutedTextClass}>RM Milhas</p>
              <h1 className="text-xl font-semibold text-slate-50">Onde pontos se transformam em patrimonio e viagens inesqueciveis.</h1>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activeClientId}
                onChange={(event) => setActiveClientId(event.currentTarget.value)}
                className={"hidden px-3 py-2 text-sm font-medium md:block " + inputClass}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.profile.name}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-[#FF5A00] bg-transparent px-3 py-2 text-sm font-semibold text-[#FF5A00] shadow-sm transition hover:bg-[#FF5A00]/10"
                onClick={addClient}
              >
                <Plus size={16} />
                Cliente
              </button>
              {false && isAdmin && (
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-[#10B981] bg-transparent px-3 py-2 text-sm font-semibold text-[#10B981] shadow-sm transition hover:bg-[#10B981]/10 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isMigrating}
                  onClick={handleManualMigration}
                >
                  {isMigrating ? "Migrando..." : "Migrar dados locais para Supabase"}
                </button>
              )}
              <button
                className="inline-flex items-center gap-2 rounded-md border border-[#3B5B82] bg-[#233B5D] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#314863]"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 xl:hidden">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                  activeSection === item.id
                    ? "bg-[#A855F7] text-white"
                    : "bg-[#233B5D] text-[#CBD5E1] hover:bg-[#314863]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {autoMigrationMessage && (
            <div className="mx-auto mb-4 max-w-7xl rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-sm font-medium text-[#A7F3D0]">
              {autoMigrationMessage}
            </div>
          )}
          {isAdmin && (migrationSummary || migrationError) && (
            <div className={panelClass + " mx-auto mb-4 max-w-7xl p-4"}>
              {migrationSummary ? (
                <p className="text-sm text-[#CBD5E1]">
                  Migracao concluida: {migrationSummary.cards} cartoes, {migrationSummary.pointsPrograms} pontos,{" "}
                  {migrationSummary.milesPrograms} milhas, {migrationSummary.transfers} transferencias,{" "}
                  {migrationSummary.redemptions} emissoes, {migrationSummary.goals} metas.
                </p>
              ) : (
                <p className="text-sm font-medium text-red-300">{migrationError}</p>
              )}
            </div>
          )}
          {activeSection === "dashboard" && <Dashboard data={data} goTo={setActiveSection} />}
          {activeSection === "cards" && <CardsModule data={data} updateData={updateData} createCard={createCard} updateCard={updateCard} deleteCard={deleteCard} />}
          {activeSection === "programs" && (
            <ProgramsModule
              data={data}
              updateData={updateData}
              createPointsProgram={createPointsProgram}
              updatePointsProgram={updatePointsProgram}
              deletePointsProgramRecord={deletePointsProgram}
              createMilesProgram={createMilesProgram}
              updateMilesProgram={updateMilesProgram}
              deleteMilesProgram={deleteMilesProgram}
              createTransfer={createTransfer}
              updateTransfer={updateTransfer}
              deleteTransferRecord={deleteTransfer}
            />
          )}
          {activeSection === "economies" && <EconomiesModule data={data} />}
          {activeSection === "goals" && <GoalsModule data={data} updateData={updateData} createGoal={createGoal} updateGoal={updateGoal} deleteGoal={deleteGoal} />}
          {activeSection === "redemptions" && <RedemptionsModule data={data} updateData={updateData} createRedemption={createRedemption} updateRedemption={updateRedemption} deleteRedemption={deleteRedemption} />}
          {activeSection === "profile" && (
            <ProfileModule
              addClient={addClient}
              activeClientId={activeClientId}
              clients={clients}
              data={data}
              deleteClient={deleteClient}
              setActiveClientId={setActiveClientId}
              updateData={updateProfileClient}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <div className="grid min-h-screen place-items-center bg-[#071529] px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-8 shadow-2xl shadow-black/30">
        <BrandInline />
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-slate-50">Acesse sua gestao</h1>
          <p className={"mt-2 text-sm leading-6 " + mutedTextClass}>
            Entre para visualizar milhas, economias, cartoes e metas da sua
            jornada RM PARTIU VIAGENS.
          </p>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setErrorMessage("");
            setIsSubmitting(true);
            const authenticated = await onLogin(email, password);
            setIsSubmitting(false);
            if (!authenticated) {
              setErrorMessage("E-mail ou senha inválidos.");
            }
          }}
        >
          <Field label="Email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.currentTarget.value)} />
          <Field label="Senha" type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.currentTarget.value)} />
          {errorMessage && <p className="text-sm font-medium text-red-300">{errorMessage}</p>}
          <button disabled={isSubmitting} className="w-full rounded-md bg-[#A855F7] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A855F7]/20 transition hover:bg-[#9333EA] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
          <button type="button" className="w-full rounded-md px-4 py-3 text-sm font-semibold text-[#CBD5E1] transition hover:bg-[#233B5D]">
            Recuperar senha
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ data, goTo }: { data: AppData; goTo: (section: Section) => void }) {
  const metrics = useMetrics(data);
  const monthly = useMonthlyCharts(data);
  const currentGoal = data.goals[0];
  const availableGoalMiles = metrics.milesBase;
  const currentGoalRequiredMiles = currentGoal ? normalizeSavedMiles(currentGoal.requiredMiles) : 0;
  const goalProgress = currentGoal
    ? Math.min(100, Math.round((availableGoalMiles / currentGoalRequiredMiles) * 100))
    : 0;
  const milesDistribution = data.milesPrograms.map((program) => {
    const balance = getAirlineBalance(data, program);
    return {
      id: program.id,
      airline: program.airline,
      balance,
      percentage: metrics.milesBase > 0 ? Math.round((balance / metrics.milesBase) * 100) : 0,
      patrimony: balance * parseCpmInput(program.cpm),
    };
  });
  const hasMilesDistribution = milesDistribution.some((program) => program.balance > 0);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeader
        eyebrow="Dashboard principal"
        title={`Olá, ${data.profile.name.split(" ")[0]} `}
        description="Acompanhe seu patrimonio em milhas, economias geradas e metas de viagem em uma unica tela."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button onClick={() => goTo("programs")} className="group relative overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-6 text-left transition hover:border-[#A855F7] hover:shadow-lg hover:shadow-[#A855F7]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#A855F7]/0 to-[#A855F7]/0 transition group-hover:from-[#A855F7]/5 group-hover:to-[#A855F7]/10"></div>
          <div className="relative z-10">
            <p className={"text-sm font-medium " + mutedTextClass}>Patrimonio em Milhas</p>
            <p className="mt-3 text-3xl font-bold text-slate-50">{number.format(metrics.totalMiles)}</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className={mutedTextClass}>Milhas aereas: <span className="font-semibold text-[#FF5A00]">{number.format(metrics.milesWithBonus)}</span></p>
              <p className={mutedTextClass}>Pontos: <span className="font-semibold text-[#10B981]">{number.format(metrics.totalPoints)}</span></p>
              <p className={"mt-2 " + mutedTextClass}>Valor est.: <span className="font-bold text-[#A855F7]">{currency.format(metrics.estimatedValue)}</span></p>
            </div>
          </div>
        </button>

        <button onClick={() => goTo("redemptions")} className="group relative overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-6 text-left transition hover:border-[#10B981] hover:shadow-lg hover:shadow-[#10B981]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-teal-500/10 transition"></div>
          <div className="relative z-10">
            <p className={"text-sm font-medium " + mutedTextClass}>Economia Total</p>
            <p className="mt-3 text-3xl font-bold text-slate-50">{currency.format(metrics.totalEconomy)}</p>
            <p className={"mt-4 text-sm " + mutedTextClass}>Somatorio de todas as emissoes</p>
          </div>
        </button>

        <button onClick={() => goTo("programs")} className="group relative overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-6 text-left transition hover:border-[#FF5A00] hover:shadow-lg hover:shadow-[#FF5A00]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/5 group-hover:to-yellow-500/10 transition"></div>
          <div className="relative z-10">
            <p className={"text-sm font-medium " + mutedTextClass}>Milhas Aereas (com bonus)</p>
            <p className="mt-3 text-3xl font-bold text-[#FF5A00]">{number.format(metrics.milesWithBonus)}</p>
            <p className={"mt-4 text-xs " + supportTextClass}>
              Base: {number.format(metrics.milesBase)} + <span className="font-semibold text-[#FF5A00]">{number.format(metrics.milesWithBonus - metrics.milesBase)}</span> de bonus
            </p>
          </div>
        </button>

        <button onClick={() => goTo("goals")} className="group relative overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-6 text-left transition hover:border-[#A855F7] hover:shadow-lg hover:shadow-[#A855F7]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#A855F7]/0 to-[#A855F7]/0 transition group-hover:from-[#A855F7]/5 group-hover:to-[#A855F7]/10"></div>
          <div className="relative z-10">
            <p className={"text-sm font-medium " + mutedTextClass}>Meta Atual</p>
            <p className="mt-3 text-3xl font-bold text-[#A855F7]">{currentGoal ? formatMiles(currentGoal.requiredMiles) : 0}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#233B5D]">
              <div className="h-full rounded-full bg-[#A855F7]" style={{ width: `${goalProgress}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#CBD5E1]">{goalProgress}% concluido</p>
          </div>
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartPanel title="Evolucao patrimonial" onClick={() => goTo("programs")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly.evolution}>
              <defs>
                <linearGradient id="orangeArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={rmOrange} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={rmOrange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => `${number.format(Number(value))} milhas`} />
              <Area type="monotone" dataKey="milhas" stroke={rmOrange} strokeWidth={3} fill="url(#orangeArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Distribuicao das milhas" onClick={() => goTo("programs")}>
          {milesDistribution.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[#CBD5E1]">Nenhuma milha cadastrada ainda</div>
          ) : (
            <div className="grid h-full gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="min-h-0">
                {hasMilesDistribution ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={milesDistribution} dataKey="balance" nameKey="airline" innerRadius={48} outerRadius={88} paddingAngle={2}>
                        {milesDistribution.map((program, index) => (
                          <Cell key={program.id} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${formatMiles(Number(value))} milhas`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#CBD5E1]">Nenhuma milha cadastrada ainda</div>
                )}
              </div>
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                {milesDistribution.map((program, index) => (
                  <div key={program.id} className="rounded-lg border border-[#1E3A5F] bg-[#233B5D] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{program.airline}</p>
                        <p className={"mt-1 text-xs " + mutedTextClass}>{formatMiles(program.balance)} milhas</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: chartColors[index % chartColors.length] }}>
                        {program.percentage}%
                      </span>
                    </div>
                    <p className={"mt-2 text-xs " + mutedTextClass}>{currency.format(program.patrimony)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Economia acumulada" onClick={() => goTo("economies")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly.economies}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => currency.format(Number(value)).replace(",00", "")} />
              <Tooltip formatter={(value) => currency.format(Number(value))} />
              <Bar dataKey="economia" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className={panelClass + " p-5"}>
          <h2 className="text-lg font-semibold">Metas de viagem</h2>
          <div className="mt-5 space-y-4">
            {data.goals.map((goal) => {
              const requiredMiles = normalizeSavedMiles(goal.requiredMiles);
              const progress = Math.min(100, Math.round((availableGoalMiles / requiredMiles) * 100));
              const remainingMiles = Math.max(requiredMiles - availableGoalMiles, 0);
              return (
                <div key={goal.id} className="rounded-lg border border-[#1E3A5F] bg-[#233B5D] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{goal.title}</p>
                      <p className={"text-sm " + mutedTextClass}>{goal.destination}</p>
                      <p className={"mt-1 text-xs " + supportTextClass}>Data: {formatDate(goal.deadline)}</p>
                    </div>
                    <span className="rounded-full bg-[#FF5A00] px-2.5 py-1 text-xs font-semibold text-white">{progress}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0F1F38]">
                    <div className="h-full rounded-full bg-[#FF5A00]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className={"mt-3 grid gap-1 text-xs " + mutedTextClass}>
                    <p>Necessario: <span className="font-semibold text-white">{formatMiles(requiredMiles)} milhas</span></p>
                    <p>Disponivel: <span className="font-semibold text-white">{formatMiles(availableGoalMiles)} milhas</span></p>
                    <p>Restam: <span className="font-semibold text-white">{formatMiles(remainingMiles)} milhas</span></p>
                    <p><span className="font-semibold text-white">{progress}%</span> concluido</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function CardsModule({
  data,
  updateData,
  createCard,
  updateCard,
  deleteCard,
}: {
  data: AppData;
  updateData: (data: AppData) => Promise<boolean>;
  createCard: (card: CreditCardRecord) => Promise<CreditCardRecord | null>;
  updateCard: (card: CreditCardRecord) => Promise<CreditCardRecord | null>;
  deleteCard: (card: CreditCardRecord) => Promise<boolean>;
}) {
  const total = data.cards.reduce((sum, card) => sum + card.pointsBalance, 0);
  const [draft, setDraft] = useState({ bank: "", cardName: "", limitValue: "", pointsBalance: "", pointsPerDollar: "", dueDay: "" });
  void updateCard;

  async function addCard() {
    if (!draft.bank || !draft.cardName) return;
    const card: CreditCardRecord = {
      id: crypto.randomUUID(),
      localId: createLocalId(),
      bank: draft.bank,
      cardName: draft.cardName,
      limitValue: Number(draft.limitValue),
      pointsBalance: Number(draft.pointsBalance),
      pointsPerDollar: Number(draft.pointsPerDollar),
      dueDay: Number(draft.dueDay),
    };
    const savedCard = await createCard(card);
    if (!savedCard) return;
    const saved = await updateData({
      ...data,
      cards: [...data.cards, savedCard],
    });
    if (saved) {
      setDraft({ bank: "", cardName: "", limitValue: "", pointsBalance: "", pointsPerDollar: "", dueDay: "" });
    }
  }

  async function removeCard(card: CreditCardRecord) {
    const deleted = await deleteCard(card);
    if (deleted) {
      await updateData({ ...data, cards: data.cards.filter((item) => item.id !== card.id) });
    }
  }

  return (
    <CrudShell title="Cartoes" description="Controle bancos, limites, pontos acumulados e regras de pontuacao." totalLabel="Total de pontos" totalValue={number.format(total)}>
      <div className="grid gap-3 md:grid-cols-7">
        <Input placeholder="Banco" value={draft.bank} onChange={(value) => setDraft({ ...draft, bank: value })} />
        <Input placeholder="Cartao" value={draft.cardName} onChange={(value) => setDraft({ ...draft, cardName: value })} />
        <Input placeholder="Limite" type="number" value={draft.limitValue} onChange={(value) => setDraft({ ...draft, limitValue: value })} />
        <Input placeholder="Pontos" type="number" value={draft.pointsBalance} onChange={(value) => setDraft({ ...draft, pointsBalance: value })} />
        <Input placeholder="Pts/USD" type="number" value={draft.pointsPerDollar} onChange={(value) => setDraft({ ...draft, pointsPerDollar: value })} />
        <Input placeholder="Dia vencimento" type="number" min="1" max="31" value={draft.dueDay} onChange={(value) => setDraft({ ...draft, dueDay: value })} />
        <button onClick={addCard} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#A855F7] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#A855F7]/20 transition hover:bg-[#9333EA]"><Plus size={16} /> Criar</button>
      </div>
      <DataTable headers={["Banco", "Cartao", "Limite", "Pontos", "Pts/USD", "Vencimento", ""]}>
        {data.cards.map((card) => (
          <tr key={card.id}>
            <Td>{card.bank}</Td>
            <Td>{card.cardName}</Td>
            <Td>{currency.format(card.limitValue)}</Td>
            <Td>{number.format(card.pointsBalance)}</Td>
            <Td>{card.pointsPerDollar}</Td>
            <Td>Dia {card.dueDay}</Td>
            <Td align="right"><DeleteButton onClick={() => removeCard(card)} /></Td>
          </tr>
        ))}
      </DataTable>
    </CrudShell>
  );
}

function ProgramsModule({
  data,
  updateData,
  createPointsProgram,
  updatePointsProgram,
  deletePointsProgramRecord,
  createMilesProgram,
  updateMilesProgram,
  deleteMilesProgram,
  createTransfer,
  updateTransfer,
  deleteTransferRecord,
}: {
  data: AppData;
  updateData: (data: AppData) => Promise<boolean>;
  createPointsProgram: (program: PointsProgram) => Promise<PointsProgram | null>;
  updatePointsProgram: (program: PointsProgram) => Promise<PointsProgram | null>;
  deletePointsProgramRecord: (program: PointsProgram) => Promise<boolean>;
  createMilesProgram: (program: MilesProgram) => Promise<MilesProgram | null>;
  updateMilesProgram: (program: MilesProgram) => Promise<MilesProgram | null>;
  deleteMilesProgram: (program: MilesProgram) => Promise<boolean>;
  createTransfer: (transfer: BonusTransfer, pointsPrograms?: PointsProgram[], milesPrograms?: MilesProgram[]) => Promise<BonusTransfer | null>;
  updateTransfer: (transfer: BonusTransfer, pointsPrograms?: PointsProgram[], milesPrograms?: MilesProgram[]) => Promise<BonusTransfer | null>;
  deleteTransferRecord: (transfer: BonusTransfer) => Promise<boolean>;
}) {
  const [draftMiles, setDraftMiles] = useState({
    airline: "Smiles",
    customAirline: "",
    balance: "",
    cpm: "0.04",
    expirationDate: "",
    editingMilesId: "",
  });
  const [draftPoints, setDraftPoints] = useState<{
    type: PointsProgram["type"];
    programName: string;
    balance: string;
    cpm: string;
    expirationDate: string;
    customProgramName: string;
    destinationProgramName: string;
    customDestinationProgramName: string;
    transferBonusPercentage: string;
    editingTransferId: string;
    editingPointId: string;
    editingTransferOnly: boolean;
  }>({
    type: "loyalty_points",
    programName: "Livelo",
    balance: "",
    cpm: "0.025",
    expirationDate: "",
    customProgramName: "",
    destinationProgramName: "Smiles",
    customDestinationProgramName: "",
    transferBonusPercentage: "100",
    editingTransferId: "",
    editingPointId: "",
    editingTransferOnly: false,
  });

  const currentBankValue = data.pointsPrograms.reduce((sum, program) => sum + getBankAvailableBalance(data, program) * parseCpmInput(program.cpm), 0);
  const currentAirlineValue = data.milesPrograms.reduce((sum, program) => {
    return sum + getAirlineBalance(data, program) * parseCpmInput(program.cpm);
  }, 0);
  const currentPatrimony = currentBankValue + currentAirlineValue;
  const totalBankPoints = data.pointsPrograms.reduce((sum, program) => sum + getBankAvailableBalance(data, program), 0);
  const totalAirlineMiles = data.milesPrograms.reduce((sum, program) => sum + getAirlineBalance(data, program), 0);
  const resolvedDestinationName = draftPoints.destinationProgramName === "Outro..."
    ? draftPoints.customDestinationProgramName.trim()
    : draftPoints.destinationProgramName;
  const selectedDestination = data.milesPrograms.find((program) => program.airline === resolvedDestinationName);
  const selectedOrigin = data.pointsPrograms.find((program) => program.programName === (draftPoints.programName === "Outro..." ? draftPoints.customProgramName.trim() : draftPoints.programName));
  const previousEditingTransfer = data.transfers.find((transfer) => transfer.id === draftPoints.editingTransferId);
  const availableOriginBalance = selectedOrigin
    ? getBankAvailableBalance(data, selectedOrigin) + (previousEditingTransfer?.originProgramName === selectedOrigin.programName ? previousEditingTransfer.sentAmount : 0)
    : Number(draftPoints.balance || 0);
  const sentAmount = Number(draftPoints.balance || 0);
  const bonusPercentage = Number(draftPoints.transferBonusPercentage || 0);
  const finalMiles = getTransferFinalMiles({ sentAmount, bonusPercentage });
  const bonusMiles = getTransferBonusMiles({ sentAmount, bonusPercentage });
  const destinationCpm = selectedDestination ? parseCpmInput(selectedDestination.cpm) : airlineDefaultCpm[resolvedDestinationName] ?? 0.04;
  const originCpm = parseCpmInput(draftPoints.cpm);
  const finalFinancialValue = finalMiles * destinationCpm;
  const currentOriginValue = Math.min(sentAmount, availableOriginBalance) * originCpm;
  const promotionGain = bonusMiles * destinationCpm;
  const potentialPatrimony = currentPatrimony - currentOriginValue + finalFinancialValue;

  async function addMilesProgram() {
    const airlineName = draftMiles.airline === "Outro..." ? draftMiles.customAirline.trim() : draftMiles.airline;
    if (!airlineName || !draftMiles.balance) return;
    const previousMilesProgram = data.milesPrograms.find((program) => program.id === draftMiles.editingMilesId);
    const milesProgram: MilesProgram = {
      id: draftMiles.editingMilesId || crypto.randomUUID(),
      localId: previousMilesProgram?.localId ?? createLocalId(),
      airline: airlineName,
      balance: Number(draftMiles.balance),
      cpm: parseCpmInput(draftMiles.cpm),
      bonusPercentage: 0,
      expirationDate: draftMiles.expirationDate,
    };
    const savedMilesProgram = draftMiles.editingMilesId
      ? await updateMilesProgram(milesProgram)
      : await createMilesProgram(milesProgram);
    if (!savedMilesProgram) return;

    const nextTransfers = previousMilesProgram && previousMilesProgram.airline !== airlineName
      ? data.transfers.map((transfer) => (
          transfer.destinationProgramName === previousMilesProgram.airline
            ? { ...transfer, destinationProgramName: airlineName }
            : transfer
        ))
      : data.transfers;

    const syncedTransfers: BonusTransfer[] = [];
    for (const transfer of nextTransfers) {
      const previousTransfer = data.transfers.find((item) => item.id === transfer.id);
      if (previousTransfer && previousTransfer.destinationProgramName !== transfer.destinationProgramName) {
        const savedTransfer = await updateTransfer(transfer, data.pointsPrograms, draftMiles.editingMilesId
          ? data.milesPrograms.map((program) => (program.id === draftMiles.editingMilesId ? savedMilesProgram : program))
          : [...data.milesPrograms, savedMilesProgram]);
        if (!savedTransfer) return;
        syncedTransfers.push(savedTransfer);
      } else {
        syncedTransfers.push(transfer);
      }
    }

    const saved = await updateData({
      ...data,
      milesPrograms: draftMiles.editingMilesId
        ? data.milesPrograms.map((program) => (program.id === draftMiles.editingMilesId ? savedMilesProgram : program))
        : [...data.milesPrograms, savedMilesProgram],
      transfers: syncedTransfers,
    });
    if (saved) {
      resetMilesDraft();
    }
  }

  function resetMilesDraft() {
    setDraftMiles({ airline: "Smiles", customAirline: "", balance: "", cpm: "0.04", expirationDate: "", editingMilesId: "" });
  }

  function editMilesProgram(program: MilesProgram) {
    const isCustomAirline = !airlineProgramOptions.includes(program.airline);
    setDraftMiles({
      airline: isCustomAirline ? "Outro..." : program.airline,
      customAirline: isCustomAirline ? program.airline : "",
      balance: String(program.balance),
      cpm: String(program.cpm),
      expirationDate: program.expirationDate,
      editingMilesId: program.id,
    });
  }

  async function addPointsProgram() {
    const programName = draftPoints.programName === "Outro..." ? draftPoints.customProgramName.trim() : draftPoints.programName;
    const destinationProgramName = draftPoints.destinationProgramName === "Outro..."
      ? draftPoints.customDestinationProgramName.trim()
      : draftPoints.destinationProgramName;
    const sentPoints = Number(draftPoints.balance || 0);
    if (!programName || !destinationProgramName || !sentPoints) return;
    const previousTransfer = data.transfers.find((transfer) => transfer.id === draftPoints.editingTransferId);
    const originIndex = draftPoints.editingPointId && !draftPoints.editingTransferOnly
      ? data.pointsPrograms.findIndex((program) => program.id === draftPoints.editingPointId)
      : data.pointsPrograms.findIndex((program) => program.programName === programName);
    const originProgram = originIndex >= 0 ? data.pointsPrograms[originIndex] : undefined;
    const currentProgramName = originProgram?.programName ?? programName;
    const availableBalance = originProgram
      ? getBankAvailableBalance(data, originProgram) + (previousTransfer?.originProgramName === currentProgramName ? previousTransfer.sentAmount : 0)
      : sentPoints;

    if ((draftPoints.editingTransferId || !draftPoints.editingPointId) && originProgram && sentPoints > availableBalance) {
      window.alert(`Saldo insuficiente. Disponivel em ${programName}: ${number.format(availableBalance)} pontos.`);
      return;
    }

    const pointRecord: PointsProgram = {
      id: crypto.randomUUID(),
      localId: createLocalId(),
      type: draftPoints.type,
      programName,
      balance: sentPoints,
      cpm: parseCpmInput(draftPoints.cpm),
      expirationDate: draftPoints.expirationDate,
    };
    const transferRecord: BonusTransfer = {
      id: draftPoints.editingTransferId || crypto.randomUUID(),
      localId: previousTransfer?.localId ?? createLocalId(),
      originProgramName: programName,
      destinationProgramName,
      sentAmount: sentPoints,
      bonusPercentage: Number(draftPoints.transferBonusPercentage || 0),
      date: new Date().toISOString().slice(0, 10),
    };
    const shouldSaveTransfer = Boolean(draftPoints.editingTransferId) || !draftPoints.editingPointId;
    const pointDrafts = originProgram
      ? data.pointsPrograms.map((program, index) => (
          index === originIndex
            ? { ...program, type: draftPoints.type, programName, balance: draftPoints.editingTransferId ? program.balance : sentPoints, cpm: parseCpmInput(draftPoints.cpm), expirationDate: draftPoints.expirationDate }
            : program
        ))
      : [...data.pointsPrograms, pointRecord];
    const pointToSave = originProgram ? pointDrafts[originIndex] : pointRecord;
    const savedPoint = originProgram
      ? await updatePointsProgram(pointToSave)
      : await createPointsProgram(pointToSave);
    if (!savedPoint) return;

    const pointsPrograms = originProgram
      ? pointDrafts.map((program) => (program.id === savedPoint.id || program.localId === savedPoint.localId ? savedPoint : program))
      : [...data.pointsPrograms, savedPoint];

    const destinationExists = data.milesPrograms.some((program) => program.airline === destinationProgramName);
    const destinationDraft: MilesProgram | null = !shouldSaveTransfer || destinationExists
      ? null
      : {
          id: crypto.randomUUID(),
          localId: createLocalId(),
          airline: destinationProgramName,
          balance: 0,
          cpm: airlineDefaultCpm[destinationProgramName] ?? 0.04,
          bonusPercentage: 0,
          expirationDate: draftPoints.expirationDate,
        };
    const savedDestination = destinationDraft ? await createMilesProgram(destinationDraft) : null;
    if (destinationDraft && !savedDestination) return;

    const milesPrograms = !shouldSaveTransfer
      ? data.milesPrograms
      : destinationExists
      ? data.milesPrograms
      : [...data.milesPrograms, savedDestination as MilesProgram];

    const savedTransfer = shouldSaveTransfer
      ? draftPoints.editingTransferId
        ? await updateTransfer(transferRecord, pointsPrograms, milesPrograms)
        : await createTransfer(transferRecord, pointsPrograms, milesPrograms)
      : null;
    if (shouldSaveTransfer && !savedTransfer) return;

    const transfers = !shouldSaveTransfer
      ? data.transfers
      : draftPoints.editingTransferId
      ? data.transfers.map((transfer) => (transfer.id === transferRecord.id ? savedTransfer as BonusTransfer : transfer))
      : [...data.transfers, savedTransfer as BonusTransfer];

    const saved = await updateData({ ...data, pointsPrograms, milesPrograms, transfers });
    if (saved) {
      resetPointsDraft();
    }
  }

  function resetPointsDraft() {
    setDraftPoints({
      type: "loyalty_points",
      programName: "Livelo",
      balance: "",
      cpm: "0.025",
      expirationDate: "",
      customProgramName: "",
      destinationProgramName: "Smiles",
      customDestinationProgramName: "",
      transferBonusPercentage: "100",
      editingTransferId: "",
      editingPointId: "",
      editingTransferOnly: false,
    });
  }

  function editPointsProgram(program: PointsProgram) {
    const relatedTransfer = data.transfers.find((transfer) => transfer.originProgramName === program.programName);
    const isCustomProgram = !bankProgramOptions.includes(program.programName);
    const destinationName = relatedTransfer?.destinationProgramName ?? "Smiles";
    const isCustomDestination = !airlineProgramOptions.includes(destinationName);
    setDraftPoints({
      type: program.type,
      programName: isCustomProgram ? "Outro..." : program.programName,
      balance: String(relatedTransfer ? relatedTransfer.sentAmount : program.balance),
      cpm: String(program.cpm),
      expirationDate: program.expirationDate,
      customProgramName: isCustomProgram ? program.programName : "",
      destinationProgramName: isCustomDestination ? "Outro..." : destinationName,
      customDestinationProgramName: isCustomDestination ? destinationName : "",
      transferBonusPercentage: String(relatedTransfer?.bonusPercentage ?? 100),
      editingTransferId: relatedTransfer?.id ?? "",
      editingPointId: program.id,
      editingTransferOnly: false,
    });
  }

  function editTransfer(transfer: BonusTransfer) {
    const origin = data.pointsPrograms.find((program) => program.programName === transfer.originProgramName);
    const isCustomOrigin = !bankProgramOptions.includes(transfer.originProgramName);
    const isCustomDestination = !airlineProgramOptions.includes(transfer.destinationProgramName);
    setDraftPoints({
      type: origin?.type ?? "loyalty_points",
      programName: isCustomOrigin ? "Outro..." : transfer.originProgramName,
      balance: String(transfer.sentAmount),
      cpm: String(origin?.cpm ?? 0.025),
      expirationDate: origin?.expirationDate ?? transfer.date,
      customProgramName: isCustomOrigin ? transfer.originProgramName : "",
      destinationProgramName: isCustomDestination ? "Outro..." : transfer.destinationProgramName,
      customDestinationProgramName: isCustomDestination ? transfer.destinationProgramName : "",
      transferBonusPercentage: String(transfer.bonusPercentage),
      editingTransferId: transfer.id,
      editingPointId: origin?.id ?? "",
      editingTransferOnly: true,
    });
  }

  async function deleteTransfer(transferId: string) {
    const transfer = data.transfers.find((item) => item.id === transferId);
    if (!transfer) return;
    const deleted = await deleteTransferRecord(transfer);
    if (deleted) {
      await updateData({ ...data, transfers: data.transfers.filter((item) => item.id !== transferId) });
    }
  }

  async function deletePointsProgram(programId: string, programName: string) {
    const program = data.pointsPrograms.find((item) => item.id === programId);
    if (!program) return;
    const relatedTransfers = data.transfers.filter((transfer) => transfer.originProgramName === programName);
    for (const transfer of relatedTransfers) {
      const deletedTransfer = await deleteTransferRecord(transfer);
      if (!deletedTransfer) return;
    }
    const deletedProgram = await deletePointsProgramRecord(program);
    if (!deletedProgram) return;
    await updateData({
      ...data,
      pointsPrograms: data.pointsPrograms.filter((item) => item.id !== programId),
      transfers: data.transfers.filter((transfer) => transfer.originProgramName !== programName),
    });
  }

  async function removeMilesProgram(program: MilesProgram) {
    const deleted = await deleteMilesProgram(program);
    if (deleted) {
      await updateData({ ...data, milesPrograms: data.milesPrograms.filter((item) => item.id !== program.id) });
    }
  }

  const transferDestinationOptions = Array.from(
    new Set([
      ...airlineProgramOptions,
      ...data.milesPrograms.map((program) => program.airline),
    ]),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SectionHeader
        eyebrow="Gestao de patrimonio"
        title="Milhas e Pontos"
        description="Acompanhe bancos, companhias e o potencial financeiro das transferencias bonificadas."
      />

      <section className={panelClass + " p-6"}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#10B981]">Patrimonio Atual</p>
            <h2 className="mt-1 text-3xl font-bold text-white">{currency.format(currentPatrimony)}</h2>
            <p className={"mt-2 text-sm " + mutedTextClass}>Valor consolidado entre pontos, milhas e transferencias ja cadastradas.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <IndicatorCard color="#3B82F6" label="Bancos" value={`${number.format(totalBankPoints)} pts`} detail={currency.format(currentBankValue)} />
            <IndicatorCard color="#FF5A00" label="Companhias" value={`${number.format(totalAirlineMiles)} mi`} detail={currency.format(currentAirlineValue)} />
            <IndicatorCard color="#10B981" label="Potencial" value={currency.format(potentialPatrimony)} detail={`+ ${currency.format(promotionGain)}`} />
          </div>
        </div>
      </section>

      <section className={panelClass + " flex flex-col gap-4 p-6"}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#3B82F6]">Programas Bancarios</p>
            <h2 className="text-xl font-bold text-white">Pontos nacionais e internacionais</h2>
          </div>
          <span className="rounded-full bg-[#3B82F6]/20 px-3 py-1 text-xs font-semibold text-[#CBD5E1]">Azul = bancos e pontos</span>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1.4fr_1fr_auto]">
          <Select value={draftPoints.type} onChange={(value) => setDraftPoints({ ...draftPoints, type: value as "loyalty_points" | "bank_points" })} options={["loyalty_points", "bank_points"]} labels={{ loyalty_points: "Clube ou fidelidade", bank_points: "Banco ou cartao" }} />
          <Select value={draftPoints.programName} onChange={(value) => setDraftPoints({ ...draftPoints, programName: value })} options={bankProgramOptions} />
          <Input placeholder="Saldo de pontos" type="number" value={draftPoints.balance} onChange={(value) => setDraftPoints({ ...draftPoints, balance: value })} />
          <Input placeholder="CPM do ponto" type="text" inputMode="decimal" value={draftPoints.cpm} onChange={(value) => setDraftPoints({ ...draftPoints, cpm: value })} />
          <Input placeholder="Validade" type="date" value={draftPoints.expirationDate} onChange={(value) => setDraftPoints({ ...draftPoints, expirationDate: value })} />
          <Select value={draftPoints.destinationProgramName} onChange={(value) => setDraftPoints({ ...draftPoints, destinationProgramName: value })} options={transferDestinationOptions} />
          <Input placeholder="% bonus" type="number" value={draftPoints.transferBonusPercentage} onChange={(value) => setDraftPoints({ ...draftPoints, transferBonusPercentage: value })} />
          <div className="flex gap-2">
            <button onClick={addPointsProgram} className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#3B82F6] px-4 text-sm font-semibold text-white transition hover:bg-[#2563EB]">
              {draftPoints.editingPointId || draftPoints.editingTransferId ? "Salvar edicao" : <Plus size={18} />}
            </button>
            {(draftPoints.editingPointId || draftPoints.editingTransferId) && (
              <button onClick={resetPointsDraft} className="inline-flex h-10 items-center justify-center rounded border border-[#3B5B82] px-3 text-sm font-semibold text-[#CBD5E1] transition hover:bg-[#233B5D]">Cancelar</button>
            )}
          </div>
        </div>
        {draftPoints.programName === "Outro..." && (
          <Input placeholder="Nome do programa de pontos" value={draftPoints.customProgramName} onChange={(value) => setDraftPoints({ ...draftPoints, customProgramName: value })} />
        )}
        {draftPoints.destinationProgramName === "Outro..." && (
          <Input placeholder="Nome da companhia de destino" value={draftPoints.customDestinationProgramName} onChange={(value) => setDraftPoints({ ...draftPoints, customDestinationProgramName: value })} />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <SimulatorMetric color="#3B82F6" label="Pontos enviados" value={`${number.format(sentAmount)} pts`} />
          <SimulatorMetric color={getProgramAccent(resolvedDestinationName)} label="Milhas finais" value={`${number.format(finalMiles)} mi`} />
          <SimulatorMetric color="#10B981" label="Patrimonio gerado" value={currency.format(finalFinancialValue)} />
        </div>
        <DataTable headers={["TIPO", "PROGRAMA", "SALDO DE PONTOS", "CPM", "PATRIMONIO", "DESTINO", "BONUS", "VALIDADE", ""]}>
          {data.pointsPrograms.map((program) => {
            const relatedTransfer = data.transfers.find((transfer) => transfer.originProgramName === program.programName);
            const availableBalance = getBankAvailableBalance(data, program);
            const value = availableBalance * parseCpmInput(program.cpm);
            return (
              <tr key={program.id} className="bg-[#3F5876] text-sm text-white hover:bg-[#4E698A]">
                <Td><ProgramBadge color="#3B82F6" label={program.type === "loyalty_points" ? "Fidelidade" : "Banco"} /></Td>
                <Td>{program.programName}</Td>
                <Td>{number.format(availableBalance)}</Td>
                <Td>{formatCpm(program.cpm)}</Td>
                <Td>{currency.format(value)}</Td>
                <Td>{relatedTransfer?.destinationProgramName ?? "-"}</Td>
                <Td>{relatedTransfer ? `${relatedTransfer.bonusPercentage.toFixed(0)}%` : "-"}</Td>
                <Td>{formatDate(program.expirationDate)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => editPointsProgram(program)} className="inline-flex h-9 w-9 items-center justify-center rounded text-[#CBD5E1] transition hover:bg-[#233B5D]" title="Editar pontos">
                      <Pencil size={16} />
                    </button>
                    <DeleteButton onClick={() => deletePointsProgram(program.id, program.programName)} />
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      <section className={panelClass + " flex flex-col gap-4 p-6"}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#FF5A00]">Companhias Aereas</p>
            <h2 className="text-xl font-bold text-white">Milhas nacionais e internacionais</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#FF5A00]/20 px-3 py-1 text-[#CBD5E1]">Smiles</span>
            <span className="rounded-full bg-[#38BDF8]/20 px-3 py-1 text-[#CBD5E1]">Azul Fidelidade</span>
            <span className="rounded-full bg-[#EF4444]/20 px-3 py-1 text-[#CBD5E1]">LATAM</span>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Select value={draftMiles.airline} onChange={(value) => setDraftMiles({ ...draftMiles, airline: value })} options={airlineProgramOptions} />
          <Input placeholder="Saldo de milhas" type="number" value={draftMiles.balance} onChange={(value) => setDraftMiles({ ...draftMiles, balance: value })} />
          <Input placeholder="CPM" type="text" inputMode="decimal" value={draftMiles.cpm} onChange={(value) => setDraftMiles({ ...draftMiles, cpm: value })} />
          <Input placeholder="Validade" type="date" value={draftMiles.expirationDate} onChange={(value) => setDraftMiles({ ...draftMiles, expirationDate: value })} />
          <div className="flex gap-2">
            <button onClick={addMilesProgram} className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#FF5A00] px-4 text-sm font-semibold text-white transition hover:bg-[#E65000]">
              {draftMiles.editingMilesId ? "Salvar edicao" : <Plus size={18} />}
            </button>
            {draftMiles.editingMilesId && (
              <button onClick={resetMilesDraft} className="inline-flex h-10 items-center justify-center rounded border border-[#3B5B82] px-3 text-sm font-semibold text-[#CBD5E1] transition hover:bg-[#233B5D]">Cancelar</button>
            )}
          </div>
        </div>
        {draftMiles.airline === "Outro..." && (
          <Input placeholder="Nome da companhia ou programa aereo" value={draftMiles.customAirline} onChange={(value) => setDraftMiles({ ...draftMiles, customAirline: value })} />
        )}
        <DataTable headers={["COMPANHIA", "SALDO DE MILHAS", "CPM", "PATRIMONIO", "VALIDADE", ""]}>
          {data.milesPrograms.map((program) => {
            const accent = getProgramAccent(program.airline);
            const totalBalance = getAirlineBalance(data, program);
            const patrimonyValue = totalBalance * parseCpmInput(program.cpm);
            return (
              <tr key={program.id} className="bg-[#3F5876] text-sm text-white hover:bg-[#4E698A]">
                <Td><ProgramBadge color={accent} label={program.airline} /></Td>
                <Td>{number.format(totalBalance)}</Td>
                <Td>{formatCpm(program.cpm)}</Td>
                <Td>{currency.format(patrimonyValue)}</Td>
                <Td>{formatDate(program.expirationDate)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => editMilesProgram(program)} className="inline-flex h-9 w-9 items-center justify-center rounded text-[#CBD5E1] transition hover:bg-[#233B5D]" title="Editar milhas">
                      <Pencil size={16} />
                    </button>
                    <DeleteButton onClick={() => removeMilesProgram(program)} />
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      <section className={panelClass + " p-6"}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#A855F7]">Transferencias Bonificadas</p>
            <h2 className="text-xl font-bold text-white">Historico de transferencias</h2>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <span className="rounded-md bg-[#233B5D] px-3 py-2 text-[#CBD5E1]">Bonus: {number.format(bonusMiles)} mi</span>
            <span className="rounded-md bg-[#233B5D] px-3 py-2 text-[#CBD5E1]">Total: {number.format(finalMiles)} mi</span>
            <span className="rounded-md bg-[#233B5D] px-3 py-2 text-[#10B981]">Ganho: {currency.format(promotionGain)}</span>
          </div>
        </div>
        <div className="mt-6">
          <DataTable headers={["ORIGEM", "DESTINO", "PONTOS ENVIADOS", "% BONUS", "MILHAS BONUS", "MILHAS CREDITADAS", "DATA", "PATRIMONIO GERADO", ""]}>
            {data.transfers.map((transfer) => {
              const destination = data.milesPrograms.find((program) => program.airline === transfer.destinationProgramName);
              const transferFinalMiles = getTransferFinalMiles(transfer);
              const transferBonusMiles = getTransferBonusMiles(transfer);
              const transferPatrimony = transferFinalMiles * (destination ? parseCpmInput(destination.cpm) : airlineDefaultCpm[transfer.destinationProgramName] ?? 0.04);
              return (
                <tr key={transfer.id} className="bg-[#3F5876] text-sm text-white hover:bg-[#4E698A]">
                  <Td>{transfer.originProgramName}</Td>
                  <Td><ProgramBadge color={getProgramAccent(transfer.destinationProgramName)} label={transfer.destinationProgramName} /></Td>
                  <Td>{number.format(transfer.sentAmount)}</Td>
                  <Td>{transfer.bonusPercentage.toFixed(0)}%</Td>
                  <Td>{number.format(transferBonusMiles)}</Td>
                  <Td>{number.format(transferFinalMiles)}</Td>
                  <Td>{formatDate(transfer.date)}</Td>
                  <Td>{currency.format(transferPatrimony)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => editTransfer(transfer)} className="inline-flex h-9 w-9 items-center justify-center rounded text-[#CBD5E1] transition hover:bg-[#233B5D]" title="Editar transferencia">
                        <Pencil size={16} />
                      </button>
                      <DeleteButton onClick={() => deleteTransfer(transfer.id)} />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      </section>
    </div>
  );
}

function LegacyProgramsModule({ data, updateData }: { data: AppData; updateData: (data: AppData) => void }) {
  const totalMiles = data.milesPrograms.reduce((sum, program) => sum + program.balance, 0);
  const totalPoints = data.pointsPrograms.reduce((sum, program) => sum + program.balance, 0);
  const [draftMiles, setDraftMiles] = useState({ airline: "Smiles", balance: "", cpm: "0.04", bonusPercentage: "", expirationDate: "" });
  const [draftPoints, setDraftPoints] = useState<{
    type: PointsProgram["type"];
    programName: string;
    balance: string;
    cpm: string;
    expirationDate: string;
  }>({
    type: "loyalty_points",
    programName: "Livelo",
    balance: "",
    cpm: "0.025",
    expirationDate: "",
  });

  function addMilesProgram() {
    if (!draftMiles.airline || !draftMiles.balance) return;
    updateData({
      ...data,
      milesPrograms: [...data.milesPrograms, {
        id: crypto.randomUUID(),
        localId: createLocalId(),
        airline: draftMiles.airline,
        balance: Number(draftMiles.balance),
        cpm: parseCpmInput(draftMiles.cpm),
        bonusPercentage: Number(draftMiles.bonusPercentage) || 0,
        expirationDate: draftMiles.expirationDate,
      }],
    });
    setDraftMiles({ airline: "Smiles", balance: "", cpm: "0.04", bonusPercentage: "", expirationDate: "" });
  }

  function addPointsProgram() {
    if (!draftPoints.programName || !draftPoints.balance) return;
    updateData({
      ...data,
      pointsPrograms: [...data.pointsPrograms, {
        id: crypto.randomUUID(),
        localId: createLocalId(),
        type: draftPoints.type,
        programName: draftPoints.programName,
        balance: Number(draftPoints.balance),
        cpm: parseCpmInput(draftPoints.cpm),
        expirationDate: draftPoints.expirationDate,
      }],
    });
    setDraftPoints({ type: "loyalty_points", programName: "Livelo", balance: "", cpm: "0.025", expirationDate: "" });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeader eyebrow="Gestao de patrimonio" title="Milhas e Pontos" description="Separe milhas de companhias aéreas e pontos de programas de fidelização." />

      <div className={panelClass + " mt-6 flex flex-col gap-4 p-6"}>
        <h2 className="text-lg font-semibold mb-4">Milhas de Companhias Aéreas</h2>
        <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
          <Select value={draftMiles.airline} onChange={(value) => setDraftMiles({ ...draftMiles, airline: value })} options={["Smiles", "LATAM Pass", "Azul Fidelidade", "TAP Miles", "United MileagePlus"]} />
          <Input placeholder="Saldo" type="number" value={draftMiles.balance} onChange={(value) => setDraftMiles({ ...draftMiles, balance: value })} />
          <Input placeholder="CPM/Valor" type="text" inputMode="decimal" value={draftMiles.cpm} onChange={(value) => setDraftMiles({ ...draftMiles, cpm: value })} />
          <Input placeholder="% Bonus" type="number" value={draftMiles.bonusPercentage} onChange={(value) => setDraftMiles({ ...draftMiles, bonusPercentage: value })} />
          <Input placeholder="Data" type="date" value={draftMiles.expirationDate} onChange={(value) => setDraftMiles({ ...draftMiles, expirationDate: value })} />
          <button onClick={addMilesProgram} className="inline-flex h-10 items-center justify-center rounded bg-[#FF5A00] px-4 text-white transition hover:bg-[#E65000]"><Plus size={18} /></button>
        </div>
        <DataTable headers={["COMPANHIA", "SALDO", "CPM", "%BONUS", "BONUS", "VALIDADE", ""]}>
          {data.milesPrograms.map((program) => {
            const bonusValue = program.balance * (program.bonusPercentage / 100);
            return (
              <tr key={program.id} className="bg-[#3F5876] text-sm text-white hover:bg-[#4E698A]">
                <Td>{program.airline}</Td>
                <Td>{number.format(program.balance)}</Td>
                <Td>{formatCpm(program.cpm)}</Td>
                <Td>{program.bonusPercentage.toFixed(1)}%</Td>
                <Td>
                  <span className="font-semibold text-white">{number.format(Math.round(bonusValue))}</span>
                </Td>
                <Td>{formatDate(program.expirationDate)}</Td>
                <Td align="right"><DeleteButton onClick={() => updateData({ ...data, milesPrograms: data.milesPrograms.filter((item) => item.id !== program.id) })} /></Td>
              </tr>
            );
          })}
        </DataTable>
      </div>

      <div className={panelClass + " mt-6 flex flex-col gap-4 p-6"}>
        <h2 className="text-lg font-semibold mb-4">Pontos (Clubes de Pontos e Bancos)</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_auto]">
          <Select value={draftPoints.type} onChange={(value) => setDraftPoints({ ...draftPoints, type: value as "loyalty_points" | "bank_points" })} options={["loyalty_points", "bank_points"]} />
          <Select value={draftPoints.programName} onChange={(value) => setDraftPoints({ ...draftPoints, programName: value })} options={["Livelo", "Esfera", "Bradesco", "Itau", "Nubank"]} />
          <Input placeholder="Saldo" type="number" value={draftPoints.balance} onChange={(value) => setDraftPoints({ ...draftPoints, balance: value })} />
          <Input placeholder="Valor" type="text" inputMode="decimal" value={draftPoints.cpm} onChange={(value) => setDraftPoints({ ...draftPoints, cpm: value })} />
          <Input placeholder="Data" type="date" value={draftPoints.expirationDate} onChange={(value) => setDraftPoints({ ...draftPoints, expirationDate: value })} />
          <button onClick={addPointsProgram} className="inline-flex h-10 items-center justify-center rounded bg-[#10B981] px-4 text-white transition hover:bg-[#059669]"><Plus size={18} /></button>
        </div>
        <DataTable headers={["TIPO", "PROG", "SALDO", "CPM", "VALOR", "VALIDADE", ""]}>
          {data.pointsPrograms.map((program) => {
            const value = program.balance * program.cpm;
            return (
              <tr key={program.id} className="bg-[#3F5876] text-sm text-white hover:bg-[#4E698A]">
                <Td>{program.type === "loyalty_points" ? "Fidelização" : "Banco"}</Td>
                <Td>{program.programName}</Td>
                <Td>{number.format(program.balance)}</Td>
                <Td>{formatCpm(program.cpm)}</Td>
                <Td>
                  <span className="font-semibold">{currency.format(value)}</span>
                </Td>
                <Td>{formatDate(program.expirationDate)}</Td>
                <Td align="right"><DeleteButton onClick={() => updateData({ ...data, pointsPrograms: data.pointsPrograms.filter((item) => item.id !== program.id) })} /></Td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}

function RedemptionsModule({
  data,
  updateData,
  createRedemption,
  updateRedemption,
  deleteRedemption,
}: {
  data: AppData;
  updateData: (data: AppData) => Promise<boolean>;
  createRedemption: (redemption: FlightRedemption) => Promise<FlightRedemption | null>;
  updateRedemption: (redemption: FlightRedemption) => Promise<FlightRedemption | null>;
  deleteRedemption: (redemption: FlightRedemption) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({ date: "", origin: "", destination: "", airline: "", regularPrice: "", milesUsed: "", cpm: "", airportFee: "", editingRedemptionId: "" });
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  const filteredOrigins = draft.origin ? airports.filter((a) => a.code.includes(draft.origin.toUpperCase()) || a.city.toLowerCase().includes(draft.origin.toLowerCase())) : [];
  const filteredDestinations = draft.destination ? airports.filter((a) => a.code.includes(draft.destination.toUpperCase()) || a.city.toLowerCase().includes(draft.destination.toLowerCase())) : [];

  async function addRedemption() {
    if (!draft.date || !draft.origin || !draft.destination) return;
    const milesUsed = Number(draft.milesUsed);
    const cpm = parseCpmInput(draft.cpm);
    const airportFee = Number(draft.airportFee);
    const totalCost = milesUsed * cpm + airportFee;
    const redemption: FlightRedemption = {
      id: draft.editingRedemptionId || crypto.randomUUID(),
      localId: data.redemptions.find((item) => item.id === draft.editingRedemptionId)?.localId ?? createLocalId(),
      date: draft.date,
      origin: draft.origin,
      destination: draft.destination,
      airline: draft.airline,
      regularPrice: Number(draft.regularPrice),
      paidPrice: totalCost,
      milesUsed,
      cpm,
      airportFee,
    };
    const savedRedemption = draft.editingRedemptionId
      ? await updateRedemption(redemption)
      : await createRedemption(redemption);
    if (!savedRedemption) return;
    const saved = await updateData({
      ...data,
      redemptions: draft.editingRedemptionId
        ? data.redemptions.map((item) => (item.id === draft.editingRedemptionId ? savedRedemption : item))
        : [...data.redemptions, savedRedemption],
    });
    if (saved) {
      resetRedemptionDraft();
    }
  }

  function resetRedemptionDraft() {
    setDraft({ date: "", origin: "", destination: "", airline: "", regularPrice: "", milesUsed: "", cpm: "", airportFee: "", editingRedemptionId: "" });
  }

  function editRedemption(redemption: FlightRedemption) {
    const costs = getRedemptionCosts(redemption);
    setDraft({
      date: redemption.date,
      origin: redemption.origin,
      destination: redemption.destination,
      airline: redemption.airline,
      regularPrice: String(redemption.regularPrice),
      milesUsed: String(redemption.milesUsed),
      cpm: redemption.cpm !== undefined ? String(redemption.cpm) : "",
      airportFee: String(costs.airportFee),
      editingRedemptionId: redemption.id,
    });
  }

  async function removeRedemption(redemption: FlightRedemption) {
    const deleted = await deleteRedemption(redemption);
    if (deleted) {
      await updateData({ ...data, redemptions: data.redemptions.filter((item) => item.id !== redemption.id) });
    }
  }

  return (
    <CrudShell title="Emissoes" description="Registre passagens emitidas e calcule a economia automaticamente." totalLabel="Economia total" totalValue={currency.format(useMetrics(data).totalEconomy)}>
      <div className="grid gap-3 md:grid-cols-9">
        <Input type="date" value={draft.date} onChange={(value) => setDraft({ ...draft, date: value })} />
        <div className="relative">
          <Input placeholder="Origem (IATA)" value={draft.origin} onChange={(value) => { setDraft({ ...draft, origin: value }); setShowOriginSuggestions(true); }} onFocus={() => setShowOriginSuggestions(true)} />
          {showOriginSuggestions && filteredOrigins.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-y-auto rounded-md border border-[#1E3A5F] bg-[#0F1F38] shadow-lg">
              {filteredOrigins.map((airport) => (
                <button key={airport.code} onClick={() => { setDraft({ ...draft, origin: airport.code }); setShowOriginSuggestions(false); }} className="w-full border-b border-[#1E3A5F] px-3 py-2 text-left text-white last:border-b-0 hover:bg-[#4E698A]">
                  <div className="font-semibold">{airport.code}</div>
                  <div className={"text-xs " + mutedTextClass}>{airport.city}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <Input placeholder="Destino (IATA)" value={draft.destination} onChange={(value) => { setDraft({ ...draft, destination: value }); setShowDestinationSuggestions(true); }} onFocus={() => setShowDestinationSuggestions(true)} />
          {showDestinationSuggestions && filteredDestinations.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-y-auto rounded-md border border-[#1E3A5F] bg-[#0F1F38] shadow-lg">
              {filteredDestinations.map((airport) => (
                <button key={airport.code} onClick={() => { setDraft({ ...draft, destination: airport.code }); setShowDestinationSuggestions(false); }} className="w-full border-b border-[#1E3A5F] px-3 py-2 text-left text-white last:border-b-0 hover:bg-[#4E698A]">
                  <div className="font-semibold">{airport.code}</div>
                  <div className={"text-xs " + mutedTextClass}>{airport.city}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Input placeholder="Companhia" value={draft.airline} onChange={(value) => setDraft({ ...draft, airline: value })} />
        <Input placeholder="Valor dinheiro" type="number" value={draft.regularPrice} onChange={(value) => setDraft({ ...draft, regularPrice: value })} />
        <Input placeholder="Milhas" type="number" value={draft.milesUsed} onChange={(value) => setDraft({ ...draft, milesUsed: value })} />
        <Input placeholder="CPM" type="text" inputMode="decimal" value={draft.cpm} onChange={(value) => setDraft({ ...draft, cpm: value })} />
        <Input placeholder="Taxa aeroportuaria" type="number" value={draft.airportFee} onChange={(value) => setDraft({ ...draft, airportFee: value })} />
        <div className="flex gap-2">
          <button onClick={addRedemption} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#A855F7] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#A855F7]/20 transition hover:bg-[#9333EA]">
            {!draft.editingRedemptionId && <Plus size={16} />}
            {draft.editingRedemptionId ? "Salvar edição" : "Registrar"}
          </button>
          {draft.editingRedemptionId && (
            <button onClick={resetRedemptionDraft} className="inline-flex items-center justify-center rounded-md border border-[#3B5B82] px-3 py-2.5 text-sm font-semibold text-[#CBD5E1] transition hover:bg-[#233B5D]">
              Cancelar edição
            </button>
          )}
        </div>
      </div>
      <DataTable headers={["Data", "Viagem", "Companhia", "Valor dinheiro", "Milhas Utilizadas", "CPM", "Taxa Aeroportuaria", "Custo Total", "Economia", ""]}>
        {data.redemptions.map((redemption) => {
          const costs = getRedemptionCosts(redemption);
          return (
            <tr key={redemption.id}>
              <Td>{formatDate(redemption.date)}</Td>
              <Td>{redemption.origin} - {redemption.destination}</Td>
              <Td>{redemption.airline}</Td>
              <Td>{currency.format(redemption.regularPrice)}</Td>
              <Td>{formatMileagePoints(redemption.milesUsed)}</Td>
              <Td>{redemption.cpm !== undefined ? formatCpm(redemption.cpm) : "-"}</Td>
              <Td>{currency.format(costs.airportFee)}</Td>
              <Td>{currency.format(costs.totalCost)}</Td>
              <Td>{currency.format(costs.economy)}</Td>
              <Td align="right">
                <div className="flex justify-end gap-1">
                  <button onClick={() => editRedemption(redemption)} className="inline-flex h-9 w-9 items-center justify-center rounded text-[#CBD5E1] transition hover:bg-[#233B5D]" title="Editar emissão">
                    <Pencil size={16} />
                  </button>
                  <DeleteButton onClick={() => removeRedemption(redemption)} />
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>
    </CrudShell>
  );
}

function EconomiesModule({ data }: { data: AppData }) {
  const economies = data.redemptions.map((item) => getRedemptionCosts(item).economy);
  const total = economies.reduce((sum, value) => sum + value, 0);
  const average = total / Math.max(economies.length, 1);
  const highest = Math.max(...economies);

  return (
    <CrudShell title="Economias" description="Historico financeiro gerado pela gestao RM." totalLabel="Economia Total" totalValue={currency.format(total)}>
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Economia Total" value={currency.format(total)} detail="Todas as emissoes" />
        <KpiCard title="Economia Media" value={currency.format(average)} detail="Por passagem emitida" />
        <KpiCard title="Maior Economia" value={currency.format(highest)} detail="Melhor operacao registrada" />
      </section>
      <DataTable headers={["Data", "Viagem", "Economia"]}>
        {data.redemptions.map((redemption) => (
          <tr key={redemption.id}>
            <Td>{formatDate(redemption.date)}</Td>
            <Td>{redemption.origin} - {redemption.destination}</Td>
            <Td>{currency.format(getRedemptionCosts(redemption).economy)}</Td>
          </tr>
        ))}
      </DataTable>
    </CrudShell>
  );
}

function GoalsModule({
  data,
  updateData,
  createGoal,
  updateGoal,
  deleteGoal,
}: {
  data: AppData;
  updateData: (data: AppData) => Promise<boolean>;
  createGoal: (goal: Goal) => Promise<Goal | null>;
  updateGoal: (goal: Goal) => Promise<Goal | null>;
  deleteGoal: (goal: Goal) => Promise<boolean>;
}) {
  const totalMiles = useMetrics(data).milesBase;
  const [draft, setDraft] = useState({ title: "", destination: "", requiredMiles: "", deadline: "" });
  void updateGoal;

  async function addGoal() {
    if (!draft.title || !draft.destination || !draft.requiredMiles || !draft.deadline) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      localId: createLocalId(),
      title: draft.title,
      destination: draft.destination,
      requiredMiles: parseMilesInput(draft.requiredMiles),
      deadline: draft.deadline,
    };
    const savedGoal = await createGoal(goal);
    if (!savedGoal) return;
    const saved = await updateData({
      ...data,
      goals: [...data.goals, savedGoal],
    });
    if (saved) {
      setDraft({ title: "", destination: "", requiredMiles: "", deadline: "" });
    }
  }

  async function removeGoal(goal: Goal) {
    const deleted = await deleteGoal(goal);
    if (deleted) {
      await updateData({ ...data, goals: data.goals.filter((item) => item.id !== goal.id) });
    }
  }

  return (
    <CrudShell title="Metas" description="Planeje viagens e acompanhe as milhas restantes." totalLabel="Milhas atuais" totalValue={formatMiles(totalMiles)}>
      <div className="grid gap-3 md:grid-cols-5">
        <Input placeholder="Nome da meta" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
        <Input placeholder="Destino" value={draft.destination} onChange={(value) => setDraft({ ...draft, destination: value })} />
        <Input placeholder="Milhas necessarias" type="text" inputMode="numeric" value={draft.requiredMiles} onChange={(value) => setDraft({ ...draft, requiredMiles: value })} />
        <Input type="date" value={draft.deadline} onChange={(value) => setDraft({ ...draft, deadline: value })} />
        <button onClick={addGoal} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#A855F7] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#A855F7]/20 transition hover:bg-[#9333EA]"><Plus size={16} /> Criar</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.goals.map((goal) => {
          const requiredMiles = normalizeSavedMiles(goal.requiredMiles);
          const progress = Math.min(100, Math.round((totalMiles / requiredMiles) * 100));
          const remainingMiles = Math.max(requiredMiles - totalMiles, 0);
          return (
            <div key={goal.id} className={panelClass + " p-5"}>
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{goal.title}</h3>
                  <p className={"text-sm " + mutedTextClass}>{goal.destination}</p>
                  <p className={"mt-1 text-xs " + supportTextClass}>Data da viagem: {formatDate(goal.deadline)}</p>
                </div>
                <DeleteButton onClick={() => removeGoal(goal)} />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#233B5D]">
                <div className="h-full rounded-full bg-[#FF5A00]" style={{ width: `${progress}%` }} />
              </div>
              <div className={"mt-3 grid gap-1 text-sm " + mutedTextClass}>
                <p>Necessario: <span className="font-semibold text-white">{formatMiles(requiredMiles)} milhas</span></p>
                <p>Disponivel: <span className="font-semibold text-white">{formatMiles(totalMiles)} milhas</span></p>
                <p>Restam: <span className="font-semibold text-white">{formatMiles(remainingMiles)} milhas</span></p>
                <p><span className="font-semibold text-white">{progress}%</span> concluido</p>
              </div>
            </div>
          );
        })}
      </div>
    </CrudShell>
  );
}

function ProfileModule({
  addClient,
  activeClientId,
  clients,
  data,
  deleteClient,
  setActiveClientId,
  updateData,
}: {
  addClient: () => void | Promise<void>;
  activeClientId: string;
  clients: AppData[];
  data: AppData;
  deleteClient: (client: AppData) => void | Promise<void>;
  setActiveClientId: (clientId: string) => void;
  updateData: (data: AppData) => Promise<boolean>;
}) {
  const [profile, setProfile] = useState(data.profile);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const visibleClients = clients.filter((client) => isUuid(client.id));
  const primaryClientId = visibleClients[0]?.id;
  const canRemoveActiveClient = visibleClients.length > 1 && activeClientId !== primaryClientId;

  useEffect(() => {
    setProfile(data.profile);
  }, [data.id, data.profile]);

  function updateProfileField(field: keyof Profile, value: string) {
    const nextProfile = { ...profile, [field]: value };
    setProfile(nextProfile);
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await updateData({ ...data, profile });
      if (saved) {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Configuracoes" title="Perfil e Clientes" description="Gerencie os dados do cliente e cadastre novos clientes." />

      <div className={panelClass + " p-6"}>
        <div className="flex justify-end">
          <button
            onClick={addClient}
            className="inline-flex items-center justify-center gap-2 rounded border border-[#FF5A00] bg-transparent px-4 py-2 text-sm font-semibold text-[#FF5A00] transition hover:bg-[#FF5A00]/10"
          >
            <Plus size={16} />
            Novo cliente
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nome" value={profile.name} onChange={(event) => updateProfileField("name", event.currentTarget.value)} />
          <Field label="Email" type="email" value={profile.email} onChange={(event) => updateProfileField("email", event.currentTarget.value)} />
          <Field label="Telefone" value={profile.phone} onChange={(event) => updateProfileField("phone", event.currentTarget.value)} />
          <Field label="Data de entrada" type="date" value={profile.joinedAt} onChange={(event) => updateProfileField("joinedAt", event.currentTarget.value)} />
          <Field label="Plano contratado" value={profile.plan} onChange={(event) => updateProfileField("plan", event.currentTarget.value)} />
          <div></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded bg-[#A855F7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9333EA] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savedMessage && <span>✓</span>}
            {isSaving ? "Salvando..." : savedMessage ? "Salvo com sucesso!" : "Salvar"}
          </button>
          {canRemoveActiveClient && (
            <button
              onClick={() => {
                if (confirm(`Tem certeza que deseja remover ${profile.name}?`)) {
                  deleteClient(data);
                }
              }}
              className="inline-flex items-center gap-2 rounded border border-red-400 bg-transparent px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              <Trash2 size={16} />
              Remover
            </button>
          )}
        </div>
      </div>

      <div className={panelClass + " p-5"}>
        <h2 className="text-lg font-semibold mb-4">Seus Clientes ({visibleClients.length})</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {visibleClients.map((client) => (
            <div
              key={client.id}
              className={`flex items-center justify-between gap-2 px-4 py-3 rounded-md border transition ${
                activeClientId === client.id
                  ? "border-[#FF5A00] bg-[#233B5D] text-white"
                  : "border-[#1E3A5F] bg-[#0F1F38] text-white hover:bg-[#233B5D]"
              }`}
            >
              <button onClick={() => setActiveClientId(client.id)} className="flex-1 text-left">
                <p className="font-semibold">{client.profile.name}</p>
                <p className={"text-sm " + mutedTextClass}>{client.profile.email}</p>
              </button>
              {visibleClients.length > 1 && (
                <button
                  disabled={client.id === primaryClientId}
                  onClick={() => {
                    if (client.id === primaryClientId) {
                      return;
                    }
                    if (confirm(`Tem certeza que deseja remover ${client.profile.name}?`)) {
                      deleteClient(client);
                    }
                  }}
                  className="rounded-md border border-red-400 bg-transparent p-2 text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title={client.id === primaryClientId ? "Cliente principal protegido" : "Remover cliente"}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useMetrics(data: AppData) {
  return useMemo(() => {
    // Calcular milhas com bônus
    const totalMilesBase = data.milesPrograms.reduce((sum, program) => sum + getAirlineBalance(data, program), 0);
    const milesWithBonus = totalMilesBase;

    // Calcular pontos
    const cardPoints = data.cards.reduce((sum, card) => sum + card.pointsBalance, 0);
    const pointsProgramsBalance = data.pointsPrograms.reduce((sum, program) => sum + getBankAvailableBalance(data, program), 0);
    const totalPoints = cardPoints + pointsProgramsBalance;

    const totalMiles = milesWithBonus + totalPoints;
    const totalEconomy = data.redemptions.reduce((sum, redemption) => sum + getRedemptionCosts(redemption).economy, 0);

    return {
      totalMiles,
      milesBase: totalMilesBase,
      milesWithBonus,
      totalPoints,
      estimatedValue: totalMiles * mileValue,
      totalEconomy,
      yearMiles: milesWithBonus,
    };
  }, [data]);
}

function useMonthlyCharts(data: AppData) {
  return useMemo(() => {
    const months = ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai"];
    const milesWithBonus = data.milesPrograms.reduce((sum, program) => sum + getAirlineBalance(data, program), 0);
    const pointsTotal = data.cards.reduce((sum, card) => sum + card.pointsBalance, 0) + data.pointsPrograms.reduce((sum, program) => sum + getBankAvailableBalance(data, program), 0);
    const totalMiles = milesWithBonus + pointsTotal;
    return {
      evolution: months.map((month, index) => ({ month, milhas: Math.round(totalMiles * (0.48 + index * 0.047)) })),
      economies: months.slice(6).map((month, index) => {
        const economy = data.redemptions
          .filter((_, redemptionIndex) => redemptionIndex % 6 === index)
          .reduce((sum, redemption) => sum + getRedemptionCosts(redemption).economy, 0);
        return { month, economia: economy };
      }),
    };
  }, [data]);
}

function BrandBlock() {
  return (
    <div className="border-b border-[#1E3A5F] px-6 py-5">
      <BrandInline />
    </div>
  );
}

function BrandInline() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#FF5A00] text-sm font-bold text-white shadow-lg shadow-[#FF5A00]/20">RM</span>
      <span>
        <span className="block text-lg font-semibold text-slate-50">RM Milhas</span>
        <span className={"block text-xs font-medium " + mutedTextClass}>Estrategia • Patrimonio • Viagens</span>
      </span>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { label: string; icon: React.ElementType }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
      active 
        ? "bg-[#A855F7] text-white shadow-lg shadow-[#A855F7]/20" 
        : "text-[#CBD5E1] hover:bg-[#233B5D] hover:text-white"
    }`}>
      <Icon size={18} />
      {item.label}
    </button>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header>
      <p className="text-sm font-semibold text-[#FF5A00]">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-normal md:text-4xl text-slate-50">{title}</h1>
      <p className={"mt-3 max-w-3xl text-sm leading-6 " + mutedTextClass}>{description}</p>
    </header>
  );
}

function KpiCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className={panelClass + " p-5"}>
      <p className={"text-sm font-medium " + mutedTextClass}>{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-50">{value}</p>
      <p className={"mt-2 text-sm " + mutedTextClass}>{detail}</p>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border border-[#1E3A5F] bg-[#0F1F38] p-6 text-white shadow-sm transition ${
        onClick ? "cursor-pointer hover:border-[#A855F7] hover:shadow-lg hover:shadow-[#A855F7]/10" : ""
      }`}
      onClick={onClick}
    >
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4 h-[330px]">{children}</div>
    </div>
  );
}

function CrudShell({ title, description, totalLabel, totalValue, children }: { title: string; description: string; totalLabel: string; totalValue: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#1E3A5F] pb-5 md:flex-row md:items-end">
        <SectionHeader eyebrow="Modulo" title={title} description={description} />
        <div className="rounded-lg border border-[#1E3A5F] bg-[#233B5D] px-5 py-4">
          <p className="text-xs font-semibold uppercase text-[#CBD5E1]">{totalLabel}</p>
          <p className="mt-1 text-xl font-semibold text-white">{totalValue}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-[#1E3A5F]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#314863] text-xs uppercase text-white">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#1E3A5F]">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded text-red-300 transition hover:bg-red-500/10">
      <Trash2 size={16} />
    </button>
  );
}

function IndicatorCard({
  color,
  label,
  value,
  detail,
}: {
  color: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-[160px] rounded-lg border border-[#1E3A5F] bg-[#233B5D] p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold uppercase text-[#CBD5E1]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-[#94A3B8]">{detail}</p>
    </div>
  );
}

function ProgramBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SimulatorMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#233B5D] p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold uppercase text-[#CBD5E1]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className={"text-sm " + mutedTextClass}>{label}</span>
      <input {...inputProps} className={"mt-2 w-full px-3 py-2.5 text-sm " + inputClass} />
    </label>
  );
}

function Input({ value, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & { onChange: (value: string) => void }) {
  return <input {...props} value={value} onChange={(event) => onChange(event.currentTarget.value)} className={"w-full px-3 py-2.5 text-sm " + inputClass} />;
}

function Select({
  value,
  options,
  labels,
  onChange,
}: {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value)} className={"w-full px-3 py-2.5 text-sm " + inputClass}>
      {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
    </select>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}
