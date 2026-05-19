import { Link } from "wouter";
import { useGetCompanyDashboard, useGetCompanyProfile } from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateLong, todayIso } from "@/lib/format";
import { Calendar, CheckCircle2, Clock, MapPin, Car, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const today = todayIso();
  const { data: profile } = useGetCompanyProfile();
  const { data, isLoading } = useGetCompanyDashboard({ date: today });

  return (
    <AppShell>
      <AppHeader
        title={`Hola, ${(profile as any)?.name ?? "Empresa"}`}
        subtitle={formatDateLong(today)}
      />

      <div className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Calendar className="h-4 w-4" />}
                label="Reservas hoy"
                value={String((data as any)?.summary?.total ?? 0)}
                testId="stat-total"
              />
              <StatCard
                icon={<AlertCircle className="h-4 w-4" />}
                label="Por aceptar"
                value={String((data as any)?.summary?.pendingAcceptance ?? 0)}
                accent="amber"
                testId="stat-pending"
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="En curso"
                value={String((data as any)?.summary?.inProgress ?? 0)}
                accent="violet"
                testId="stat-inprogress"
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Ingresos hoy"
                value={formatCurrency((data as any)?.summary?.revenueToday ?? 0)}
                accent="emerald"
                testId="stat-revenue"
              />
            </div>

            <section>
              <h2 className="text-sm font-semibold mb-2">Siguiente reserva</h2>
              {(data as any)?.nextBooking ? (
                <NextBookingCard booking={(data as any).nextBooking} />
              ) : (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  No hay reservas próximas
                </Card>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Agenda de hoy</h2>
                <Link href="/bookings">
                  <Button variant="ghost" size="sm" data-testid="link-all-bookings">Ver todas</Button>
                </Link>
              </div>
              <div className="space-y-2">
                {((data as any)?.upcoming ?? []).length === 0 && (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Sin reservas pendientes hoy
                  </Card>
                )}
                {((data as any)?.upcoming ?? []).map((b: any) => (
                  <BookingRow key={b.id} booking={b} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "amber" | "violet" | "emerald";
  testId?: string;
}) {
  const accentCls =
    accent === "amber"
      ? "text-amber-700 bg-amber-50"
      : accent === "violet"
      ? "text-violet-700 bg-violet-50"
      : accent === "emerald"
      ? "text-emerald-700 bg-emerald-50"
      : "text-primary bg-primary/10";
  return (
    <Card className="p-3" data-testid={testId}>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accentCls}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </Card>
  );
}

function NextBookingCard({ booking }: { booking: any }) {
  return (
    <Link href={`/bookings/${booking.id}`}>
      <Card className="p-4 hover-elevate active-elevate-2 cursor-pointer" data-testid={`next-booking-${booking.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{booking.time} hrs</p>
            <p className="font-semibold truncate">{booking.clientName}</p>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Car className="h-3 w-3 shrink-0" />
              {booking.vehicleBrand} {booking.vehicleModel} · {booking.washType.name}
            </p>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              {booking.addressFull}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold">{formatCurrency(booking.totalPrice)}</p>
            <div className="mt-1"><StatusBadge status={booking.status} /></div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function BookingRow({ booking }: { booking: any }) {
  return (
    <Link href={`/bookings/${booking.id}`}>
      <Card className="p-3 hover-elevate active-elevate-2 cursor-pointer" data-testid={`booking-row-${booking.id}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 text-center">
            <p className="text-sm font-semibold">{booking.time}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{booking.clientName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {booking.washType.name} · {booking.vehicleSize.name}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </Card>
    </Link>
  );
}
