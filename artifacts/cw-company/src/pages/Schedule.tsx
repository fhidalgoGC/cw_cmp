import { useEffect, useMemo, useState } from "react";
import {
  useGetCompanyAvailability,
  useUpdateCompanyAvailability,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, CalendarOff, Plus, X, Copy } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";
import { es } from "date-fns/locale";

type Slot = { weekday: number; time: string; enabled: boolean };
type Range = { from: string; to: string };

const DAYS = [
  { idx: 1, long: "Lunes" },
  { idx: 2, long: "Martes" },
  { idx: 3, long: "Miércoles" },
  { idx: 4, long: "Jueves" },
  { idx: 5, long: "Viernes" },
  { idx: 6, long: "Sábado" },
  { idx: 0, long: "Domingo" },
];

const MIN_RANGE_MIN = 120; // 2h minimum

// Time helpers ("HH:MM", with "24:00" allowed as end-of-day marker)
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 00:00, 00:30, ..., 23:30
const FROM_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += 30) out.push(minToTime(m));
  return out;
})();
// 00:30, 01:00, ..., 24:00
const TO_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 30; m <= 1440; m += 30) out.push(m === 1440 ? "24:00" : minToTime(m));
  return out;
})();

// YYYY-MM-DD <-> Date (local time, not UTC)
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ------- range <-> slot conversion -------
function rangesToSlotTimes(ranges: Range[]): string[] {
  const out = new Set<string>();
  for (const r of ranges) {
    const start = timeToMin(r.from);
    const end = r.to === "24:00" ? 1440 : timeToMin(r.to);
    for (let m = start; m < end; m += 30) out.add(minToTime(m));
  }
  return [...out].sort();
}
function slotsToRanges(times: string[]): Range[] {
  const mins = times.map(timeToMin).sort((a, b) => a - b);
  const out: Range[] = [];
  let i = 0;
  while (i < mins.length) {
    let j = i;
    while (j + 1 < mins.length && mins[j + 1] === mins[j] + 30) j++;
    const endMin = mins[j] + 30;
    out.push({ from: minToTime(mins[i]), to: endMin === 1440 ? "24:00" : minToTime(endMin) });
    i = j + 1;
  }
  return out;
}

function totalHours(ranges: Range[]): string {
  let mins = 0;
  for (const r of ranges) {
    const end = r.to === "24:00" ? 1440 : timeToMin(r.to);
    mins += end - timeToMin(r.from);
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Validate a single range and check it doesn't overlap others.
function validateRange(
  r: Range,
  others: Range[],
): string | null {
  const start = timeToMin(r.from);
  const end = r.to === "24:00" ? 1440 : timeToMin(r.to);
  if (end - start < MIN_RANGE_MIN) return "Mínimo 2 horas";
  for (const o of others) {
    const os = timeToMin(o.from);
    const oe = o.to === "24:00" ? 1440 : timeToMin(o.to);
    if (start < oe && os < end) return "Se traslapa con otra franja";
  }
  return null;
}

export default function Schedule() {
  const { data, isLoading, refetch } = useGetCompanyAvailability();
  const update = useUpdateCompanyAvailability({
    mutation: {
      onSuccess: () => {
        toast.success("Horarios actualizados");
        refetch();
      },
      onError: () => toast.error("No se pudieron guardar los horarios"),
    },
  });

  // ranges[weekday] = Range[]
  const [ranges, setRanges] = useState<Range[][]>(() =>
    Array.from({ length: 7 }, () => []),
  );
  const [blocked, setBlocked] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}); // key wd|idx

  useEffect(() => {
    if (!data) return;
    const incoming = ((data as any).slots ?? []) as Slot[];
    const perDay: string[][] = Array.from({ length: 7 }, () => []);
    for (const s of incoming) if (s.enabled) perDay[s.weekday].push(s.time);
    setRanges(perDay.map(slotsToRanges));
    setBlocked(((data as any).blockedDates ?? []) as string[]);
    setDirty(false);
    setErrors({});
  }, [data]);

  function updateDay(wd: number, next: Range[]) {
    setRanges((prev) => {
      const arr = prev.slice();
      arr[wd] = next;
      return arr;
    });
    setDirty(true);

    // re-validate this day
    setErrors((prev) => {
      const out = { ...prev };
      for (const k of Object.keys(out)) if (k.startsWith(`${wd}|`)) delete out[k];
      next.forEach((r, i) => {
        const err = validateRange(
          r,
          next.filter((_, j) => j !== i),
        );
        if (err) out[`${wd}|${i}`] = err;
      });
      return out;
    });
  }

  function addRange(wd: number) {
    const curr = ranges[wd];
    // Find first 2h gap starting from 08:00 onwards
    const sorted = [...curr].sort((a, b) => timeToMin(a.from) - timeToMin(b.from));
    let candidate: Range | null = null;
    let cursor = 480; // 08:00
    for (const r of sorted) {
      const rs = timeToMin(r.from);
      if (rs - cursor >= MIN_RANGE_MIN) {
        candidate = { from: minToTime(cursor), to: minToTime(cursor + MIN_RANGE_MIN) };
        break;
      }
      cursor = Math.max(cursor, r.to === "24:00" ? 1440 : timeToMin(r.to));
    }
    if (!candidate && 1440 - cursor >= MIN_RANGE_MIN) {
      candidate = {
        from: minToTime(cursor),
        to: cursor + MIN_RANGE_MIN === 1440 ? "24:00" : minToTime(cursor + MIN_RANGE_MIN),
      };
    }
    // Fallback: from start of day
    if (!candidate) {
      cursor = 0;
      for (const r of sorted) {
        const rs = timeToMin(r.from);
        if (rs - cursor >= MIN_RANGE_MIN) {
          candidate = { from: minToTime(cursor), to: minToTime(cursor + MIN_RANGE_MIN) };
          break;
        }
        cursor = Math.max(cursor, r.to === "24:00" ? 1440 : timeToMin(r.to));
      }
    }
    if (!candidate) {
      toast.error("No hay espacio para otra franja");
      return;
    }
    updateDay(wd, [...curr, candidate]);
  }

  function removeRange(wd: number, idx: number) {
    updateDay(
      wd,
      ranges[wd].filter((_, i) => i !== idx),
    );
  }

  function setRangeField(wd: number, idx: number, field: "from" | "to", value: string) {
    const next = ranges[wd].map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    updateDay(wd, next);
  }

  function copyToAll(wd: number) {
    const src = ranges[wd];
    setRanges(Array.from({ length: 7 }, () => src.map((r) => ({ ...r }))));
    setDirty(true);
    setErrors({});
    toast.success(`Horario copiado a todos los días`);
  }

  function clearDay(wd: number) {
    updateDay(wd, []);
  }

  function onCalendarSelect(dates: Date[] | undefined) {
    const next = (dates ?? []).map(dateToIso).sort();
    setBlocked(next);
    setDirty(true);
  }

  function removeBlocked(iso: string) {
    setBlocked((b) => b.filter((x) => x !== iso));
    setDirty(true);
  }

  function save() {
    if (Object.keys(errors).length > 0) {
      toast.error("Revisa las franjas con error");
      return;
    }
    const payload: Slot[] = [];
    for (let wd = 0; wd < 7; wd++) {
      for (const t of rangesToSlotTimes(ranges[wd])) {
        payload.push({ weekday: wd, time: t, enabled: true });
      }
    }
    update.mutate({ data: { slots: payload, blockedDates: blocked } });
    setDirty(false);
  }

  const blockedDates = useMemo(() => blocked.map(isoToDate), [blocked]);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <AppShell>
      <AppHeader
        title="Horarios"
        subtitle="Horario de atención de tu negocio"
        right={
          <Button
            size="sm"
            onClick={save}
            disabled={update.isPending || !dirty || hasErrors}
            data-testid="button-save"
          >
            Guardar
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Tabs defaultValue="hours" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="hours" data-testid="tab-hours">
                <Clock className="h-4 w-4 mr-1.5" />
                Horario de atención
              </TabsTrigger>
              <TabsTrigger value="blocked" data-testid="tab-blocked">
                <CalendarOff className="h-4 w-4 mr-1.5" />
                Días no laborables
                {blocked.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5">
                    {blocked.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ---------------- HORARIO DE ATENCIÓN ---------------- */}
            <TabsContent value="hours" className="space-y-3 mt-0">
              <p className="text-xs text-muted-foreground px-1">
                Define los horarios en que tu negocio atiende. Puedes agregar varias
                franjas por día (ej. mañana y tarde). Mínimo 2 horas por franja.
              </p>

              {DAYS.map(({ idx, long }) => {
                const dayRanges = ranges[idx];
                return (
                  <Card key={idx} className="p-4 space-y-3" data-testid={`day-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{long}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {dayRanges.length === 0
                            ? "Cerrado"
                            : `${dayRanges.length} franja${dayRanges.length > 1 ? "s" : ""} · ${totalHours(dayRanges)}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {dayRanges.length > 0 && (
                          <button
                            type="button"
                            onClick={() => copyToAll(idx)}
                            className="text-[11px] px-2 py-1 rounded border hover-elevate flex items-center gap-1"
                            data-testid={`button-copy-all-${idx}`}
                            title="Aplicar este horario a todos los días"
                          >
                            <Copy className="h-3 w-3" />
                            Aplicar a todos
                          </button>
                        )}
                        {dayRanges.length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearDay(idx)}
                            className="text-[11px] px-2 py-1 rounded border hover-elevate text-destructive"
                            data-testid={`button-clear-${idx}`}
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </div>

                    {dayRanges.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        Sin horario asignado
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayRanges.map((r, i) => {
                          const errKey = `${idx}|${i}`;
                          const err = errors[errKey];
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={r.from}
                                  onValueChange={(v) => setRangeField(idx, i, "from", v)}
                                >
                                  <SelectTrigger
                                    className="flex-1 h-9"
                                    data-testid={`from-${idx}-${i}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {FROM_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-muted-foreground text-sm">a</span>
                                <Select
                                  value={r.to}
                                  onValueChange={(v) => setRangeField(idx, i, "to", v)}
                                >
                                  <SelectTrigger
                                    className="flex-1 h-9"
                                    data-testid={`to-${idx}-${i}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {TO_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
                                  onClick={() => removeRange(idx, i)}
                                  className="text-muted-foreground hover-elevate p-2 rounded"
                                  aria-label="Quitar franja"
                                  data-testid={`remove-${idx}-${i}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              {err && (
                                <p className="text-[11px] text-destructive pl-1">{err}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => addRange(idx)}
                      className="w-full text-xs py-2 rounded-md border border-dashed hover-elevate flex items-center justify-center gap-1.5 text-muted-foreground"
                      data-testid={`add-range-${idx}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar franja
                    </button>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ---------------- DÍAS NO LABORABLES ---------------- */}
            <TabsContent value="blocked" className="space-y-4 mt-0">
              <Card className="p-2">
                <Calendar
                  mode="multiple"
                  selected={blockedDates}
                  onSelect={onCalendarSelect}
                  locale={es}
                  weekStartsOn={1}
                  showOutsideDays
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  data-testid="calendar-blocked"
                  className="w-full [--cell-size:2.75rem]"
                  classNames={{ root: "w-full", month: "w-full flex flex-col gap-3" }}
                />
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Seleccionados ({blocked.length})
                  </h3>
                  {blocked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBlocked([]);
                        setDirty(true);
                      }}
                      className="text-[11px] text-destructive hover-elevate px-2 py-1 rounded"
                      data-testid="button-clear-blocked"
                    >
                      Quitar todos
                    </button>
                  )}
                </div>
                {blocked.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Toca un día en el calendario para marcarlo como no laborable
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-[11rem] overflow-y-auto pr-1">
                    {blocked.map((d) => (
                      <li
                        key={d}
                        className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm"
                        data-testid={`blocked-${d}`}
                      >
                        <span>{formatDateLong(d)}</span>
                        <button
                          onClick={() => removeBlocked(d)}
                          className="text-muted-foreground hover-elevate p-1 rounded"
                          aria-label="Quitar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
