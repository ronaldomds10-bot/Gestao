export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRow = {
  id: string;
  user_id: string;
  name: string;
  full_name: string | null;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  joined_at: string | null;
  plan: string;
  created_at: string;
  updated_at: string;
};

export type CreditCardRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  local_id: string | null;
  external_id: string | null;
  name: string;
  card_name: string | null;
  bank: string;
  brand: string | null;
  last_four: string | null;
  closing_day: number | null;
  due_day: number;
  annual_fee: number | null;
  limit_value: number | null;
  points_balance: number | null;
  points_multiplier: number | null;
  points_per_dollar: number | null;
  created_at: string;
  updated_at: string;
};

export type PointsProgramRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  local_id: string | null;
  external_id: string | null;
  name: string;
  program_name: string | null;
  type: string | null;
  balance: number;
  cpm: number | null;
  destination_program: string | null;
  bonus_percentage: number | null;
  expiration_date: string | null;
  google_event_id: string | null;
  calendar_synced_at: string | null;
  calendar_sync_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MilesProgramRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  local_id: string | null;
  external_id: string | null;
  name: string;
  airline: string;
  balance: number;
  cpm: number | null;
  bonus_percentage: number | null;
  expiration_date: string | null;
  google_event_id: string | null;
  calendar_synced_at: string | null;
  calendar_sync_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarConnectionRow = {
  id: string;
  user_id: string;
  google_email: string | null;
  refresh_token_encrypted: string;
  access_token_encrypted: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
  created_at: string;
  updated_at: string;
};

export type BonusTransferRow = {
  id: string;
  user_id: string;
  points_program_id: string | null;
  miles_program_id: string | null;
  transferred_points: number;
  bonus_percentage: number;
  received_miles: number;
  transfer_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FlightRedemptionRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  miles_program_id: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  miles_used: number;
  cash_cost: number | null;
  taxes: number | null;
  sale_price: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number | null;
  due_date: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Omit<Row, "id" | "created_at" | "updated_at">> & {
    user_id: string;
  };
  Update: Partial<Omit<Row, "id" | "user_id" | "created_at" | "updated_at">>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<ProfileRow>;
      clients: TableDefinition<ClientRow>;
      credit_cards: TableDefinition<CreditCardRow>;
      points_programs: TableDefinition<PointsProgramRow>;
      miles_programs: TableDefinition<MilesProgramRow>;
      google_calendar_connections: TableDefinition<GoogleCalendarConnectionRow>;
      bonus_transfers: TableDefinition<BonusTransferRow>;
      flight_redemptions: TableDefinition<FlightRedemptionRow>;
      goals: TableDefinition<GoalRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
