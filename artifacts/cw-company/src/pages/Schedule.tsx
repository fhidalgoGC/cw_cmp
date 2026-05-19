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
import { Clock, CalendarOff, Copy, X } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";
import { es } from "date-fns/locale";

type Slot = { weekday: number; time: string; enabled: boolean };
type Scope = "all" | "weekdays" | "weekends" | "custom";

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
  const [scope, setScope] = useState<Scope>("all");
  const [customDays, setCustomDays] = useState<number[]>([1]);
  const [dirty, setDirty] = useState(false);

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
  }, [data]);

  const activeDays = useMemo(() => {
    if (scope === "custom") return customDays;
    return SCOPES.find((s) => s.value === scope)!.days;
  }, [scope, customDays]);

  function slotState(time: string): "on" | "off" | "mixed" {
    if (activeDays.length === 0) return "off";
    let on = 0;
    let off = 0;
    for (const d of activeDays) {
      if (slots.get(`${d}|${time}`)) on++;
      else off++;
    }
    if (on === activeDays.length) return "on";
    if (off === activeDays.length) return "off";
    return "mixed";
  }

  function toggleTime(time: string) {
    if (activeDays.length === 0) {
      toast.error("Selecciona al menos un día");
      return;
    }
    const state = slotState(time);
    const next = state === "on" ? false : true;
    setSlots((prev) => {
      const m = new Map(prev);
      for (const d of activeDays) m.set(`${d}|${time}`, next);
      return m;
    });
    setDirty(true);
  }

  function setAllForScope(value: boolean) {
    if (activeDays.length === 0) return;
    setSlots((prev) => {
      const m = new Map(prev);
      for (const d of activeDays) {
        for (const t of allTimes) m.set(`${d}|${t}`, value);
      }
      return m;
    });
    setDirty(true);
  }

  function copyFromWeekday(srcWd: number) {
    if (activeDays.length === 0) return;
    setSlots((prev) => {
      const m = new Map(prev);
      for (const d of activeDays) {
        if (d === srcWd) continue;
        for (const t of allTimes) m.set(`${d}|${t}`, !!prev.get(`${srcWd}|${t}`));
      }
      return m;
    });
    setDirty(true);
    toast.success(`Horario copiado desde ${DAYS[srcWd].long}`);
  }

  function toggleCustomDay(d: number) {
    setCustomDays((curr) =>
      curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d].sort(),
    );
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
                      onClick={() => setScope(s.value)}
                      data-testid={`scope-${s.value}`}
                      className={`text-xs py-2 rounded-md border hover-elevate active-elevate-2 ${
                        scope === s.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {scope === "custom" && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-2">
                      Selecciona los días a editar
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((d) => {
                        const sel = customDays.includes(d.idx);
                        return (
                          <button
                            key={d.idx}
                            type="button"
                            onClick={() => toggleCustomDay(d.idx)}
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
                )}
              </Card>

              {/* Slot grid */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Horarios</h3>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAllForScope(true)}
                      className="text-[11px] px-2 py-1 rounded border hover-elevate"
                      data-testid="button-enable-all"
                    >
                      Activar todo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllForScope(false)}
                      className="text-[11px] px-2 py-1 rounded border hover-elevate"
                      data-testid="button-disable-all"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Toca una hora para activar/desactivar.
                </p>
                {activeDays.length === 0 ? (
                  <p className="text-xs text-destructive py-4 text-center">
                    Selecciona al menos un día
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {allTimes.map((t) => {
                      const state = slotState(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTime(t)}
                          data-testid={`slot-${t}`}
                          className={`text-sm py-2 rounded-md border hover-elevate active-elevate-2 ${
                            state === "on"
                              ? "bg-primary text-primary-foreground border-primary"
                              : state === "mixed"
                                ? "bg-primary/20 text-foreground border-primary/40"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}

                {scope === "custom" && customDays.length >= 1 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Copy className="h-3 w-3" />
                      Copiar horario desde otro día
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((d) => (
                        <button
                          key={d.idx}
                          type="button"
                          onClick={() => copyFromWeekday(d.idx)}
                          className="text-xs py-1.5 rounded border bg-card hover-elevate active-elevate-2"
                          data-testid={`copy-from-${d.idx}`}
                        >
                          {d.short}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  <ul className="space-y-1.5">
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
