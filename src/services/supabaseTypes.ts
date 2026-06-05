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
  name: string;
  bank: string;
  brand: string | null;
  last_four: string | null;
  closing_day: number | null;
  due_day: number;
  annual_fee: number | null;
  points_multiplier: number | null;
  created_at: string;
  updated_at: string;
};

export type PointsProgramRow = {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MilesProgramRow = {
  id: string;
  user_id: string;
  name: string;
  airline: string;
  balance: number;
  expiration_date: string | null;
  notes: string | null;
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
