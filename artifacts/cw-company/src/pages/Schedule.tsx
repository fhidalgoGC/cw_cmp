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
import { Clock, CalendarOff, X, Plus, Trash2 } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";
import { es } from "date-fns/locale";

type Slot = { weekday: number; time: string; enabled: boolean };
type Scope = "all" | "weekdays" | "weekends" | "custom";
type Range = { from: string; to: string };
type Group = { id: string; days: number[]; ranges: Range[] };

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

function newId(): string {
  return `g_${Math.random().toString(36).slice(2, 9)}`;
}

function derivedScopeFor(days: number[]): Scope {
  const key = [...days].sort((a, b) => a - b).join(",");
  for (const s of SCOPES) {
    if (s.value === "custom") continue;
    if ([...s.days].sort((a, b) => a - b).join(",") === key) return s.value;
  }
  return "custom";
}

function groupDayLabel(g: Group, override: Scope | null): string {
  if (g.days.length === 0) return "ningún día";
  const scope = override ?? derivedScopeFor(g.days);
  if (scope !== "custom") {
    return SCOPES.find((s) => s.value === scope)!.label.toLowerCase();
  }
  return [...g.days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAYS[d].long.slice(0, 3).toLowerCase())
    .join(", ");
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

  const [groups, setGroups] = useState<Group[]>([
    { id: "g_init", days: [0, 1, 2, 3, 4, 5, 6], ranges: [] },
  ]);
  const [scopeOverrides, setScopeOverrides] = useState<Record<string, Scope | null>>({});
  const [blocked, setBlocked] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  // errors keyed by `${groupId}|${rangeIdx}`
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hydrate from server: build groups by grouping weekdays with the same
  // enabled-times signature.
  useEffect(() => {
    if (!data) return;
    const incoming = ((data as any).slots ?? []) as Slot[];
    const perDay: string[][] = Array.from({ length: 7 }, () => []);
    for (const s of incoming) if (s.enabled) perDay[s.weekday].push(s.time);
    const sigToDays = new Map<string, number[]>();
    for (let wd = 0; wd < 7; wd++) {
      const sig = [...perDay[wd]].sort().join(",");
      if (!sig) continue; // closed day → not part of any group
      if (!sigToDays.has(sig)) sigToDays.set(sig, []);
      sigToDays.get(sig)!.push(wd);
    }
    const next: Group[] = [];
    for (const [sig, days] of sigToDays) {
      const enabled = sig.split(",").filter(Boolean);
      next.push({ id: newId(), days, ranges: slotsToRanges(enabled) });
    }
    if (next.length === 0) {
      // No enabled slots saved → start with one empty group the user can fill in
      next.push({ id: newId(), days: [], ranges: [] });
    }
    setGroups(next);
    setScopeOverrides({});
    setErrors({});
    setBlocked(((data as any).blockedDates ?? []) as string[]);
    setDirty(false);
  }, [data]);

  // Union of DEFAULT_TIMES + every 30-min tick used by any group's ranges.
  const allTimes = useMemo(() => {
    const s = new Set<string>(DEFAULT_TIMES);
    for (const g of groups) for (const t of rangesToSlotTimes(g.ranges)) s.add(t);
    return [...s].sort();
  }, [groups]);

  function toggleDayInGroup(groupId: string, day: number) {
    const affectedOthers: string[] = [];
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const has = g.days.includes(day);
          return {
            ...g,
            days: has
              ? g.days.filter((d) => d !== day)
              : [...g.days, day].sort((a, b) => a - b),
          };
        }
        // Day is exclusive — remove from any other group
        if (g.days.includes(day)) {
          affectedOthers.push(g.id);
          return { ...g, days: g.days.filter((d) => d !== day) };
        }
        return g;
      }),
    );
    setScopeOverrides((prev) => {
      const out = { ...prev, [groupId]: null };
      // Drop any stale override on groups whose days just changed indirectly
      for (const id of affectedOthers) out[id] = null;
      return out;
    });
    setDirty(true);
  }

  function applyPresetToGroup(groupId: string, s: Scope) {
    if (s === "custom") {
      setScopeOverrides((prev) => ({ ...prev, [groupId]: s }));
      setDirty(true);
      return;
    }
    const presetDays = SCOPES.find((x) => x.value === s)!.days;
    const presetSet = new Set(presetDays);
    const affectedOthers: string[] = [];
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return { ...g, days: [...presetDays].sort((a, b) => a - b) };
        }
        const next = g.days.filter((d) => !presetSet.has(d));
        if (next.length !== g.days.length) affectedOthers.push(g.id);
        return { ...g, days: next };
      }),
    );
    setScopeOverrides((prev) => {
      const out = { ...prev, [groupId]: s };
      for (const id of affectedOthers) out[id] = null;
      return out;
    });
    setDirty(true);
  }

  function setGroupRanges(groupId: string, nextRanges: Range[]) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ranges: nextRanges } : g)),
    );
    setDirty(true);
    setErrors((prev) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`${groupId}|`)) out[k] = v;
      }
      nextRanges.forEach((r, i) => {
        const err = validateRange(
          r,
          nextRanges.filter((_, j) => j !== i),
        );
        if (err) out[`${groupId}|${i}`] = err;
      });
      return out;
    });
  }

  function addRangeToGroup(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const curr = [...g.ranges].sort((a, b) => timeToMin(a.from) - timeToMin(b.from));
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
    setGroupRanges(groupId, [...g.ranges, candidate]);
  }

  function removeRangeFromGroup(groupId: string, idx: number) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    setGroupRanges(
      groupId,
      g.ranges.filter((_, i) => i !== idx),
    );
  }

  function setRangeField(
    groupId: string,
    idx: number,
    field: "from" | "to",
    value: string,
  ) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    setGroupRanges(
      groupId,
      g.ranges.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setScopeOverrides((prev) => {
      const out = { ...prev };
      delete out[groupId];
      return out;
    });
    setErrors((prev) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`${groupId}|`)) out[k] = v;
      }
      return out;
    });
    setDirty(true);
  }

  function addGroup() {
    setGroups((prev) => [...prev, { id: newId(), days: [], ranges: [] }]);
    setDirty(true);
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
    // Only block on errors belonging to groups that have days assigned —
    // errors on dayless groups don't affect the saved payload.
    const groupsWithDays = new Set(
      groups.filter((g) => g.days.length > 0).map((g) => g.id),
    );
    const blockingErrors = Object.keys(errors).filter((k) =>
      groupsWithDays.has(k.split("|")[0]),
    );
    if (blockingErrors.length > 0) {
      toast.error("Revisa las franjas con error");
      return;
    }
    const groupByDay = new Map<number, Group>();
    for (const g of groups) for (const d of g.days) groupByDay.set(d, g);
    const payload: Slot[] = [];
    for (let wd = 0; wd < 7; wd++) {
      const g = groupByDay.get(wd);
      const enabledSet = g
        ? new Set(rangesToSlotTimes(g.ranges))
        : new Set<string>();
      for (const t of allTimes) {
        payload.push({ weekday: wd, time: t, enabled: enabledSet.has(t) });
      }
    }
    update.mutate({ data: { slots: payload, blockedDates: blocked } });
    setDirty(false);
  }

  // Per-day hours summary computed from groups.
  const summary = useMemo(() => {
    const groupByDay = new Map<number, Group>();
    for (const g of groups) for (const d of g.days) groupByDay.set(d, g);
    return DAYS.map((d) => {
      const g = groupByDay.get(d.idx);
      return { ...d, label: g && g.ranges.length > 0 ? totalHours(g.ranges) : "—" };
    });
  }, [groups]);

  const blockedDates = useMemo(() => blocked.map(isoToDate), [blocked]);

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
              {/* Per-day hours summary */}
              <Card className="p-3">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {summary.map((d) => (
                    <div key={d.idx} className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {d.short}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          d.label === "—" ? "text-muted-foreground" : "text-foreground"
                        }`}
                        data-testid={`summary-${d.idx}`}
                      >
                        {d.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Horas por día
                </p>
              </Card>

              {/* Two cards per group: días/scope + franjas */}
              {groups.map((g, gIdx) => {
                const override = scopeOverrides[g.id] ?? null;
                const activeScope: Scope = override ?? derivedScopeFor(g.days);
                return (
                  <div
                    key={g.id}
                    className="space-y-3"
                    data-testid={`group-${g.id}`}
                  >
                    {/* Horario header */}
                    <div className="flex items-center justify-between px-1 pt-1">
                      <h3 className="text-sm font-semibold">
                        Horario {gIdx + 1}
                      </h3>
                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroup(g.id)}
                          className="text-muted-foreground hover-elevate p-1.5 rounded text-[11px] flex items-center gap-1"
                          aria-label="Eliminar horario"
                          data-testid={`button-remove-group-${g.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      )}
                    </div>

                    {/* Días card */}
                    <Card className="p-4 space-y-3" data-testid={`days-card-${g.id}`}>
                      <div>
                        <h4 className="text-sm font-semibold">Días</h4>
                        <p className="text-[11px] text-muted-foreground">
                          Aplica este horario a {groupDayLabel(g, override)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {SCOPES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => applyPresetToGroup(g.id, s.value)}
                            data-testid={`scope-${g.id}-${s.value}`}
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

                      <div className="grid grid-cols-7 gap-1">
                        {DAYS.map((d) => {
                          const sel = g.days.includes(d.idx);
                          const inOther =
                            !sel &&
                            groups.some(
                              (other) =>
                                other.id !== g.id && other.days.includes(d.idx),
                            );
                          return (
                            <button
                              key={d.idx}
                              type="button"
                              onClick={() => toggleDayInGroup(g.id, d.idx)}
                              data-testid={`day-${g.id}-${d.idx}`}
                              title={inOther ? "Asignado a otro horario" : undefined}
                              className={`text-xs py-2 rounded-md border hover-elevate active-elevate-2 ${
                                sel
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : inOther
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-card"
                              }`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Franjas card */}
                    <Card
                      className="p-4 space-y-3"
                      data-testid={`ranges-card-${g.id}`}
                    >
                      <div>
                        <h4 className="text-sm font-semibold">Franjas horarias</h4>
                        <p className="text-[11px] text-muted-foreground">
                          {g.days.length === 0
                            ? "Selecciona al menos un día"
                            : g.ranges.length === 0
                              ? "Sin franjas — los días seleccionados quedarán cerrados"
                              : `${g.ranges.length} franja${g.ranges.length > 1 ? "s" : ""} · ${totalHours(g.ranges)}`}
                        </p>
                      </div>

                      {g.days.length > 0 && g.ranges.length > 0 && (
                        <div className="space-y-2">
                          {g.ranges.map((r, i) => {
                            const err = errors[`${g.id}|${i}`];
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={r.from}
                                    onValueChange={(v) =>
                                      setRangeField(g.id, i, "from", v)
                                    }
                                  >
                                    <SelectTrigger
                                      className="flex-1 h-9"
                                      data-testid={`from-${g.id}-${i}`}
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
                                  <span className="text-muted-foreground text-sm">
                                    a
                                  </span>
                                  <Select
                                    value={r.to}
                                    onValueChange={(v) =>
                                      setRangeField(g.id, i, "to", v)
                                    }
                                  >
                                    <SelectTrigger
                                      className="flex-1 h-9"
                                      data-testid={`to-${g.id}-${i}`}
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
                                    onClick={() =>
                                      removeRangeFromGroup(g.id, i)
                                    }
                                    className="text-muted-foreground hover-elevate p-2 rounded"
                                    aria-label="Quitar franja"
                                    data-testid={`remove-${g.id}-${i}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                {err && (
                                  <p className="text-[11px] text-destructive pl-1">
                                    {err}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {g.days.length > 0 && (
                        <button
                          type="button"
                          onClick={() => addRangeToGroup(g.id)}
                          className="w-full text-xs py-2 rounded-md border border-dashed hover-elevate flex items-center justify-center gap-1.5 text-muted-foreground"
                          data-testid={`add-range-${g.id}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Agregar franja
                        </button>
                      )}
                    </Card>
                  </div>
                );
              })}

              {/* Add another group */}
              <button
                type="button"
                onClick={addGroup}
                className="w-full text-sm py-3 rounded-md border border-dashed hover-elevate flex items-center justify-center gap-1.5 text-muted-foreground"
                data-testid="button-add-group"
              >
                <Plus className="h-4 w-4" />
                Agregar otro horario
              </button>
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
