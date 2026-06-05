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
  joined_at: string | null;
  plan: string;
  created_at: string;
  updated_at: string;
};

export type CreditCardRow = {
  id: string;
  user_id: string;
  client_id: string;
  bank: string;
  card_name: string;
  limit_value: number;
  points_balance: number;
  points_per_dollar: number;
  due_day: number;
  created_at: string;
  updated_at: string;
};

export type PointsProgramRow = {
  id: string;
  user_id: string;
  client_id: string;
  type: "loyalty_points" | "bank_points";
  program_name: string;
  balance: number;
  cpm: number;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
};

export type MilesProgramRow = {
  id: string;
  user_id: string;
  client_id: string;
  airline: string;
  balance: number;
  cpm: number;
  bonus_percentage: number;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
};

export type BonusTransferRow = {
  id: string;
  user_id: string;
  client_id: string;
  origin_program_id: string | null;
  destination_program_id: string | null;
  origin_program_name: string;
  destination_program_name: string;
  sent_amount: number;
  bonus_percentage: number;
  transfer_date: string;
  created_at: string;
  updated_at: string;
};

export type FlightRedemptionRow = {
  id: string;
  user_id: string;
  client_id: string;
  redemption_date: string;
  origin: string;
  destination: string;
  airline: string;
  regular_price: number;
  paid_price: number;
  miles_used: number;
  cpm: number | null;
  airport_fee: number;
  created_at: string;
  updated_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  destination: string;
  required_miles: number;
  deadline: string | null;
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
