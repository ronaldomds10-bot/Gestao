"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AdminDashboardAluno = {
  id: string;
  nome: string;
  email: string;
  grupoMentoria: string | null;
  saldoTotalMilhas: number;
  lucroEconomiaTotal: number;
};

export type AdminDashboardRankingItem = {
  id: string;
  nome: string;
  lucro_economia_total: number;
};

export type AdminDashboardData = {
  alunos: AdminDashboardAluno[];
  patrimonioTotalMilhas: number;
  ranking: AdminDashboardRankingItem[];
};

type AdminDashboardProps = {
  data: AdminDashboardData;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function AdminDashboard({ data }: AdminDashboardProps) {
  const totalAlunos = data.alunos.length;
  const lucroTotal = data.alunos.reduce(
    (total, aluno) => total + aluno.lucroEconomiaTotal,
    0,
  );

  const rankingChartData = data.ranking.map((item) => ({
    nome: item.nome,
    resultado: Number(item.lucro_economia_total),
  }));

  return (
    <main className="min-h-screen bg-[#071529] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 border-b border-[#1E3A5F] pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-[#FF5A00]">
              Painel administrativo
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">
              Gestao de milhas sob mentoria
            </h1>
          </div>
          <div className="text-sm text-[#CBD5E1]">
            {numberFormatter.format(totalAlunos)} alunos monitorados
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Patrimonio total"
            value={`${numberFormatter.format(data.patrimonioTotalMilhas)} mi`}
          />
          <MetricCard label="Alunos ativos" value={numberFormatter.format(totalAlunos)} />
          <MetricCard label="Lucro e economia" value={moneyFormatter.format(lucroTotal)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1F38]">
            <div className="border-b border-[#1E3A5F] px-5 py-4">
              <h2 className="text-lg font-semibold">Alunos e clientes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#314863] text-xs uppercase text-white">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Nome</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Turma</th>
                    <th className="px-5 py-3 text-right font-semibold">Milhas</th>
                    <th className="px-5 py-3 text-right font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]">
                  {data.alunos.map((aluno) => (
                    <tr key={aluno.id} className="bg-[#3F5876] hover:bg-[#4E698A]">
                      <td className="px-5 py-4 font-medium">{aluno.nome}</td>
                      <td className="px-5 py-4 text-[#CBD5E1]">{aluno.email}</td>
                      <td className="px-5 py-4 text-[#CBD5E1]">
                        {aluno.grupoMentoria ?? "Sem turma"}
                      </td>
                      <td className="px-5 py-4 text-right font-medium">
                        {numberFormatter.format(aluno.saldoTotalMilhas)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-[#10B981]">
                        {moneyFormatter.format(aluno.lucroEconomiaTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-[#1E3A5F] bg-[#0F1F38] p-5">
            <h2 className="text-lg font-semibold">Ranking de resultado</h2>
            <div className="mt-4 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingChartData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => moneyFormatter.format(Number(value))} />
                  <YAxis dataKey="nome" type="category" width={110} />
                  <Tooltip formatter={(value) => moneyFormatter.format(Number(value))} />
                  <Bar dataKey="resultado" fill="#047857" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </aside>
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
