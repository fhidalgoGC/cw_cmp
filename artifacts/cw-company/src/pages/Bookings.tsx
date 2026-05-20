import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListCompanyBookings } from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge, CompanyStatusBadge } from "@/components/StatusBadge";
import {
  formatCurrency,
  formatDateShort,
  todayIso,
  addDaysIso,
} from "@/lib/format";
import { Search, Car, MapPin, CalendarIcon } from "lucide-react";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "accepted", label: "Aceptadas" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
] as const;

const DATE_RANGES = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 14, label: "14 días" },
  { value: 30, label: "30 días" },
] as const;

type DateMode = { kind: "preset"; days: number } | { kind: "custom"; from: string; to: string };

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Bookings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [dateMode, setDateMode] = useState<DateMode>({ kind: "preset", days: 1 });
  const [pickerOpen, setPickerOpen] = useState(false);

  const range = useMemo(() => {
    if (dateMode.kind === "preset") {
      const dateTo = todayIso();
      const dateFrom = addDaysIso(dateTo, -(dateMode.days - 1));
      return { dateFrom, dateTo };
    }
    return { dateFrom: dateMode.from, dateTo: dateMode.to };
  }, [dateMode]);

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status: status as any } : {}),
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      limit: 50,
    }),
    [search, status, range],
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
          {DATE_RANGES.map((r) => {
            const active = dateMode.kind === "preset" && dateMode.days === r.value;
            return (
              <Button
                key={r.value}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setDateMode({ kind: "preset", days: r.value })}
                data-testid={`date-range-${r.value}`}
                className="shrink-0"
              >
                {r.label}
              </Button>
            );
          })}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={dateMode.kind === "custom" ? "default" : "outline"}
                className="shrink-0"
                data-testid="date-range-custom"
              >
                <CalendarIcon className="h-4 w-4 mr-1.5" />
                {dateMode.kind === "custom"
                  ? `${formatDateShort(dateMode.from)} – ${formatDateShort(dateMode.to)}`
                  : "Rango"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                locale={es}
                numberOfMonths={1}
                selected={
                  dateMode.kind === "custom"
                    ? { from: isoToDate(dateMode.from), to: isoToDate(dateMode.to) }
                    : undefined
                }
                onSelect={(r: DateRange | undefined) => {
                  if (r?.from && r?.to) {
                    setDateMode({
                      kind: "custom",
                      from: dateToIso(r.from),
                      to: dateToIso(r.to),
                    });
                    setPickerOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
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
