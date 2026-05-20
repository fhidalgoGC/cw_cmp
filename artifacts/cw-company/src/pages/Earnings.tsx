import { useMemo, useState } from "react";
import {
  useGetCompanyEarnings,
  useListCompanyEarningServices,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { PaymentBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateShort, todayIso, addDaysIso } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";

const RANGES = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 14, label: "14 días" },
  { value: 30, label: "30 días" },
] as const;

export default function Earnings() {
  const [days, setDays] = useState<number>(30);
  const range = useMemo(() => {
    const dateTo = todayIso();
    const dateFrom = addDaysIso(dateTo, -(days - 1));
    return { dateFrom, dateTo };
  }, [days]);

  const { data, isLoading } = useGetCompanyEarnings(range);
  const { data: services } = useListCompanyEarningServices({
    ...range,
    limit: days === 1 ? 200 : 20,
  });
  const summary = data as any;
  const serviceRows = ((services as any)?.data ?? []) as any[];
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return serviceRows;
    return serviceRows.filter((s) => {
      return (
        String(s.clientName ?? "").toLowerCase().includes(q) ||
        String(s.washType?.name ?? "").toLowerCase().includes(q) ||
        String(s.vehicleSize?.name ?? "").toLowerCase().includes(q) ||
        String(s.date ?? "").toLowerCase().includes(q)
      );
    });
  }, [serviceRows, search]);

  // Cuando el filtro es "Hoy" agrupamos por hora a partir de los servicios
  const hourlySeries = useMemo(() => {
    if (days !== 1) return null;
    const bins = new Map<number, number>();
    for (const s of serviceRows) {
      const h = parseInt(String(s.time ?? "").slice(0, 2), 10);
      if (Number.isNaN(h)) continue;
      bins.set(h, (bins.get(h) ?? 0) + Number(s.amount ?? 0));
    }
    const hoursWithData = [...bins.keys()];
    const lo = Math.min(8, ...(hoursWithData.length ? hoursWithData : [8]));
    const hi = Math.max(18, ...(hoursWithData.length ? hoursWithData : [18]));
    const out: { hour: number; amount: number }[] = [];
    for (let h = lo; h <= hi; h++) out.push({ hour: h, amount: bins.get(h) ?? 0 });
    return out;
  }, [days, serviceRows]);

  return (
    <AppShell>
      <AppHeader title="Ingresos" subtitle="Resumen de tu negocio" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={days === r.value ? "default" : "outline"}
              onClick={() => setDays(r.value)}
              data-testid={`range-${r.value}`}
            >
              {r.label}
            </Button>
          ))}
        </div>

        {isLoading || !summary ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Ingresos totales</p>
              <p className="text-3xl font-bold text-primary" data-testid="total-amount">
                {formatCurrency(summary.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalServices} servicios en el periodo
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Pagado</p>
                <p className="text-lg font-semibold text-emerald-700">
                  {formatCurrency(summary.paid)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Pendiente</p>
                <p className="text-lg font-semibold text-amber-700">
                  {formatCurrency(summary.pending)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Pago directo</p>
                <p className="text-base font-semibold">
                  {formatCurrency(summary.byType?.directo ?? 0)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Membresía</p>
                <p className="text-base font-semibold">
                  {formatCurrency(summary.byType?.membresia ?? 0)}
                </p>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">
                {hourlySeries ? "Ingresos por hora" : "Ingresos por día"}
              </h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  {hourlySeries ? (
                    <BarChart data={hourlySeries}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        labelFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={summary.dailySeries}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => formatDateShort(d)}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        labelFormatter={(d: string) => formatDateShort(d)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>

            <section>
              <div className="flex items-center justify-between mb-2 gap-2">
                <h2 className="text-sm font-semibold">Servicios cobrados</h2>
                <span className="text-[11px] text-muted-foreground">
                  {filteredRows.length} de {serviceRows.length}
                </span>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, servicio o fecha"
                  className="pl-8 h-9"
                  data-testid="input-search-services"
                />
              </div>
              {serviceRows.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  Sin servicios en el periodo
                </Card>
              ) : filteredRows.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  Sin resultados para tu búsqueda
                </Card>
              ) : (
                <div
                  className="max-h-[26rem] overflow-y-auto space-y-2 pr-1 rounded-md border bg-muted/20 p-2"
                  data-testid="services-list-scroll"
                >
                  {filteredRows.map((s) => (
                    <Card key={s.id} className="p-3" data-testid={`earning-${s.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(s.date)} · {s.time}
                          </p>
                          <p className="font-medium truncate">{s.clientName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.washType.name} · {s.vehicleSize.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{formatCurrency(s.amount)}</p>
                          <div className="mt-1">
                            <PaymentBadge type={s.paymentType} status={s.paymentStatus} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
