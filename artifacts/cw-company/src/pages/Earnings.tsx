import { useMemo, useState } from "react";
import {
  useGetCompanyEarnings,
  useListCompanyEarningServices,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateShort, todayIso, addDaysIso } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";

const RANGES = [
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
  const { data: services } = useListCompanyEarningServices({ ...range, limit: 20 });
  const summary = data as any;
  const serviceRows = ((services as any)?.data ?? []) as any[];

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
              <h3 className="text-sm font-semibold mb-2">Ingresos por día</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
            </Card>

            <section>
              <h2 className="text-sm font-semibold mb-2">Servicios cobrados</h2>
              <div className="space-y-2">
                {serviceRows.length === 0 && (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Sin servicios en el periodo
                  </Card>
                )}
                {serviceRows.map((s) => (
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
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
