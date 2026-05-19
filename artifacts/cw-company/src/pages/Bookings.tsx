import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListCompanyBookings } from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, CompanyStatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { Search, Car, MapPin } from "lucide-react";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "accepted", label: "Aceptadas" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
] as const;

export default function Bookings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status: status as any } : {}),
      limit: 50,
    }),
    [search, status],
  );
  const { data, isLoading } = useListCompanyBookings(params);
  const bookings = ((data as any)?.data ?? []) as any[];

  return (
    <AppShell>
      <AppHeader title="Reservas" subtitle={`${(data as any)?.pagination?.total ?? 0} resultados`} />
      <div className="px-4 pt-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, dirección o placas"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={status === t.value ? "default" : "outline"}
              onClick={() => setStatus(t.value)}
              data-testid={`filter-${t.value || "all"}`}
              className="shrink-0"
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        {!isLoading && bookings.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No hay reservas que mostrar
          </Card>
        )}
        {bookings.map((b) => (
          <Link key={b.id} href={`/bookings/${b.id}`}>
            <Card className="p-3 hover-elevate active-elevate-2 cursor-pointer" data-testid={`booking-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatDateShort(b.date)} · {b.time}
                    </p>
                    <CompanyStatusBadge status={b.companyStatus} />
                  </div>
                  <p className="font-semibold truncate mt-0.5">{b.clientName}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Car className="h-3 w-3 shrink-0" />
                    {b.vehicleBrand} {b.vehicleModel} · {b.washType.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {b.addressFull}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(b.totalPrice)}</p>
                  <div className="mt-1"><StatusBadge status={b.status} /></div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
