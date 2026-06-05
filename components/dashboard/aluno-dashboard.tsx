"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type VencimentoMilhas = {
  bucket: "30 dias" | "60 dias" | "90 dias" | "+90 dias";
  milhas: number;
};

export type SaldoPrograma = {
  programaId: number;
  programaNome: string;
  saldoMilhas: number;
  cpmMedio: number;
};

export type RoiVenda = {
  mes: string;
  receita: number;
  custo: number;
  roi: number | null;
};

export type AlunoDashboardData = {
  vencimentos: VencimentoMilhas[];
  saldos: SaldoPrograma[];
  roiVendas: RoiVenda[];
};

type AlunoDashboardProps = {
  data: AlunoDashboardData;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");
const chartColors = ["#0f766e", "#c2410c", "#1d4ed8", "#7c3aed", "#be123c", "#4d7c0f"];

export function AlunoDashboard({ data }: AlunoDashboardProps) {
  const saldoTotal = data.saldos.reduce(
    (total, programa) => total + programa.saldoMilhas,
    0,
  );
  const milhasExpirando90 = data.vencimentos
    .filter((item) => item.bucket !== "+90 dias")
    .reduce((total, item) => total + item.milhas, 0);
  const lucroVendas = data.roiVendas.reduce(
    (total, item) => total + item.receita - item.custo,
    0,
  );

  return (
    <main className="min-h-screen bg-[#071529] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="border-b border-[#1E3A5F] pb-5">
          <p className="text-sm font-medium text-[#FF5A00]">Painel do aluno</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">
            Carteira de milhas e performance
          </h1>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Saldo total" value={`${numberFormatter.format(saldoTotal)} mi`} />
          <MetricCard
            label="Expiram ate 90 dias"
            value={`${numberFormatter.format(milhasExpirando90)} mi`}
          />
          <MetricCard label="Lucro em vendas" value={moneyFormatter.format(lucroVendas)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <ChartPanel title="Milhas a expirar">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.vencimentos}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" />
                <YAxis tickFormatter={(value) => numberFormatter.format(Number(value))} />
                <Tooltip formatter={(value) => `${numberFormatter.format(Number(value))} milhas`} />
                <Bar dataKey="milhas" fill="#c2410c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Saldo por programa">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.saldos}
                  dataKey="saldoMilhas"
                  nameKey="programaNome"
                  innerRadius={72}
                  outerRadius={118}
                  paddingAngle={2}
                >
                  {data.saldos.map((entry, index) => (
                    <Cell
                      key={entry.programaId}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${numberFormatter.format(Number(value))} milhas`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="ROI mensal das vendas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.roiVendas}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="#1d4ed8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1F38]">
            <div className="border-b border-[#1E3A5F] px-5 py-4">
              <h2 className="text-lg font-semibold">CPM medio por programa</h2>
            </div>
            <div className="divide-y divide-[#1E3A5F]">
              {data.saldos.map((programa) => (
                <div
                  key={programa.programaId}
                  className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-medium">{programa.programaNome}</p>
                    <p className="text-sm text-[#CBD5E1]">
                      {numberFormatter.format(programa.saldoMilhas)} milhas
                    </p>
                  </div>
                  <p className="self-center font-semibold">
                    {moneyFormatter.format(programa.cpmMedio)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1F38] p-5 text-white">
      <p className="text-sm font-medium text-[#CBD5E1]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1F38] p-5 text-white">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 h-[320px]">{children}</div>
    </div>
  );
}
