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
import { Clock, CalendarOff, X, Plus } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";
import { es } from "date-fns/locale";

type Slot = { weekday: number; time: string; enabled: boolean };
type Scope = "all" | "weekdays" | "weekends" | "custom";
type Range = { from: string; to: string };

const MIN_RANGE_MIN = 120; // 2h minimum

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const FROM_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += 30) out.push(minToTime(m));
  return out;
})();
const TO_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 30; m <= 1440; m += 30) out.push(m === 1440 ? "24:00" : minToTime(m));
  return out;
})();
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
function validateRange(r: Range, others: Range[]): string | null {
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

const DAYS = [
  { idx: 0, short: "D", long: "Domingo" },
  { idx: 1, short: "L", long: "Lunes" },
  { idx: 2, short: "M", long: "Martes" },
  { idx: 3, short: "M", long: "Miércoles" },
  { idx: 4, short: "J", long: "Jueves" },
  { idx: 5, short: "V", long: "Viernes" },
  { idx: 6, short: "S", long: "Sábado" },
];

const SCOPES: { value: Scope; label: string; days: number[] }[] = [
  { value: "all", label: "Todos los días", days: [0, 1, 2, 3, 4, 5, 6] },
  { value: "weekdays", label: "Lun a Vie", days: [1, 2, 3, 4, 5] },
  { value: "weekends", label: "Sáb y Dom", days: [6, 0] },
  { value: "custom", label: "Personalizado", days: [] },
];

const DEFAULT_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
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

  const [slots, setSlots] = useState<Map<string, boolean>>(new Map());
  const [allTimes, setAllTimes] = useState<string[]>(DEFAULT_TIMES);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [scopeOverride, setScopeOverride] = useState<Scope | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const incoming = ((data as any).slots ?? []) as Slot[];
    const map = new Map<string, boolean>();
    const timeSet = new Set<string>(DEFAULT_TIMES);
    for (const s of incoming) timeSet.add(s.time);
    const times = [...timeSet].sort();
    for (let wd = 0; wd < 7; wd++) {
      for (const t of times) map.set(`${wd}|${t}`, false);
    }
    for (const s of incoming) map.set(`${s.weekday}|${s.time}`, s.enabled);
    setSlots(map);
    setAllTimes(times);
    setBlocked(((data as any).blockedDates ?? []) as string[]);
    setDirty(false);

    // Seed the working ranges from the first active day using the fresh map
    // (cannot rely on `slots` state — it's still the previous render's value).
    const seedDay = [...selectedDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))[0];
    if (seedDay == null) {
      setRanges([]);
    } else {
      const enabled = times.filter((t) => map.get(`${seedDay}|${t}`));
      setRanges(slotsToRanges(enabled));
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const activeDays = selectedDays;

  const derivedScope: Scope = useMemo(() => {
    const key = [...selectedDays].sort((a, b) => a - b).join(",");
    for (const s of SCOPES) {
      if (s.value === "custom") continue;
      if ([...s.days].sort((a, b) => a - b).join(",") === key) return s.value;
    }
    return "custom";
  }, [selectedDays]);

  const activeScope: Scope = scopeOverride ?? derivedScope;

  function toggleDay(d: number) {
    setScopeOverride(null);
    setSelectedDays((curr) =>
      curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d].sort((a, b) => a - b),
    );
  }

  function applyPreset(s: Scope) {
    setScopeOverride(s);
    if (s !== "custom") {
      const preset = SCOPES.find((x) => x.value === s)!;
      setSelectedDays([...preset.days].sort((a, b) => a - b));
    }
  }

  // ---- Single working list of ranges that applies to the active days ----
  const [ranges, setRanges] = useState<Range[]>([]);

  // When the day selection changes, reload the working list from the first
  // active day in the *current* edit state. Initial load is seeded in the
  // data hydration effect above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) return;
    if (selectedDays.length === 0) {
      setRanges([]);
      setErrors({});
      return;
    }
    const wd = [...selectedDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))[0];
    const enabled: string[] = [];
    for (const t of allTimes) if (slots.get(`${wd}|${t}`)) enabled.push(t);
    setRanges(slotsToRanges(enabled));
    setErrors({});
  }, [selectedDays]);

  function applyRangesToActiveDays(nextRanges: Range[]) {
    const enabledSet = new Set(rangesToSlotTimes(nextRanges));
    const newTimes = new Set(allTimes);
    for (const t of enabledSet) newTimes.add(t);
    const nextAllTimes = [...newTimes].sort();
    setAllTimes(nextAllTimes);
    setSlots((prev) => {
      const m = new Map(prev);
      // Ensure every (wd, t) entry exists for newly introduced times
      for (let w = 0; w < 7; w++) {
        for (const t of nextAllTimes) {
          const k = `${w}|${t}`;
          if (!m.has(k)) m.set(k, false);
        }
      }
      // Overwrite each active day with the new ranges
      for (const wd of activeDays) {
        for (const t of nextAllTimes) m.set(`${wd}|${t}`, enabledSet.has(t));
      }
      return m;
    });
    setDirty(true);
    setErrors(() => {
      const out: Record<string, string> = {};
      nextRanges.forEach((r, i) => {
        const err = validateRange(
          r,
          nextRanges.filter((_, j) => j !== i),
        );
        if (err) out[`${i}`] = err;
      });
      return out;
    });
  }

  function setRangesAndApply(nextRanges: Range[]) {
    setRanges(nextRanges);
    applyRangesToActiveDays(nextRanges);
  }

  function addRange() {
    const curr = [...ranges].sort((a, b) => timeToMin(a.from) - timeToMin(b.from));
    let candidate: Range | null = null;
    let cursor = 480; // 08:00
    for (const r of curr) {
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
    if (!candidate) {
      cursor = 0;
      for (const r of curr) {
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
    setRangesAndApply([...ranges, candidate]);
  }

  function removeRange(idx: number) {
    setRangesAndApply(ranges.filter((_, i) => i !== idx));
  }

  function setRangeField(idx: number, field: "from" | "to", value: string) {
    setRangesAndApply(
      ranges.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  function clearRanges() {
    setRangesAndApply([]);
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
      for (const t of allTimes) {
        payload.push({ weekday: wd, time: t, enabled: !!slots.get(`${wd}|${t}`) });
      }
    }
    update.mutate({ data: { slots: payload, blockedDates: blocked } });
    setDirty(false);
  }

  const summary = useMemo(
    () =>
      DAYS.map((d) => {
        let count = 0;
        for (const t of allTimes) if (slots.get(`${d.idx}|${t}`)) count++;
        return { ...d, count };
      }),
    [slots, allTimes],
  );

  const blockedDates = useMemo(() => blocked.map(isoToDate), [blocked]);

  const activeDayLabel = useMemo(() => {
    if (activeDays.length === 0) return "—";
    if (activeScope !== "custom") {
      return SCOPES.find((s) => s.value === activeScope)!.label.toLowerCase();
    }
    return [...activeDays]
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((d) => DAYS[d].long.slice(0, 3).toLowerCase())
      .join(", ");
  }, [activeScope, activeDays]);

  return (
    <AppShell>
      <AppHeader
        title="Horarios"
        subtitle="Disponibilidad de tu negocio"
        right={
          <Button
            size="sm"
            onClick={save}
            disabled={update.isPending || !dirty}
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
                Franjas horarias
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

            {/* ---------------- FRANJAS HORARIAS ---------------- */}
            <TabsContent value="hours" className="space-y-4 mt-0">
              {/* Per-day summary */}
              <Card className="p-3">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {summary.map((d) => (
                    <div key={d.idx} className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {d.short}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          d.count === 0 ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {d.count}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Franjas activas por día
                </p>
              </Card>

              {/* Scope selector */}
              <Card className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Aplicar a</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SCOPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => applyPreset(s.value)}
                      data-testid={`scope-${s.value}`}
                      className={`text-xs py-2 rounded-md border hover-elevate active-elevate-2 ${
                        activeScope === s.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    Días seleccionados
                  </p>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((d) => {
                      const sel = selectedDays.includes(d.idx);
                      return (
                        <button
                          key={d.idx}
                          type="button"
                          onClick={() => toggleDay(d.idx)}
                          data-testid={`day-${d.idx}`}
                          className={`text-xs py-2 rounded-md border hover-elevate active-elevate-2 ${
                            sel
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card"
                          }`}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Single franjas editor — applies to the selected days */}
              <Card className="p-4 space-y-3" data-testid="ranges-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Franjas horarias</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {activeDays.length === 0
                        ? "Selecciona al menos un día"
                        : ranges.length === 0
                          ? "Sin franjas — los días seleccionados quedarán cerrados"
                          : `${ranges.length} franja${ranges.length > 1 ? "s" : ""} · ${totalHours(ranges)} · se aplica a ${activeDayLabel}`}
                    </p>
                  </div>
                  {ranges.length > 0 && activeDays.length > 0 && (
                    <button
                      type="button"
                      onClick={clearRanges}
                      className="text-[11px] px-2 py-1 rounded border hover-elevate text-destructive shrink-0"
                      data-testid="button-clear-ranges"
                    >
                      Quitar todas
                    </button>
                  )}
                </div>

                {activeDays.length > 0 && ranges.length > 0 && (
                  <div className="space-y-2">
                    {ranges.map((r, i) => {
                      const err = errors[`${i}`];
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Select
                              value={r.from}
                              onValueChange={(v) => setRangeField(i, "from", v)}
                            >
                              <SelectTrigger
                                className="flex-1 h-9"
                                data-testid={`from-${i}`}
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
                              onValueChange={(v) => setRangeField(i, "to", v)}
                            >
                              <SelectTrigger
                                className="flex-1 h-9"
                                data-testid={`to-${i}`}
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
                              onClick={() => removeRange(i)}
                              className="text-muted-foreground hover-elevate p-2 rounded"
                              aria-label="Quitar franja"
                              data-testid={`remove-${i}`}
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

                {activeDays.length > 0 && (
                  <button
                    type="button"
                    onClick={addRange}
                    className="w-full text-xs py-2 rounded-md border border-dashed hover-elevate flex items-center justify-center gap-1.5 text-muted-foreground"
                    data-testid="add-range"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar franja
                  </button>
                )}
              </Card>
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
