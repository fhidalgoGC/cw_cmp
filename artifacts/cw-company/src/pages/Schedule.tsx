import { useEffect, useMemo, useState } from "react";
import {
  useGetCompanyAvailability,
  useUpdateCompanyAvailability,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";

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

// Default times shown if a company has none seeded for a given weekday
const DEFAULT_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

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

  // slots is a Map keyed by `${weekday}|${time}` => enabled
  const [slots, setSlots] = useState<Map<string, boolean>>(new Map());
  const [allTimes, setAllTimes] = useState<string[]>(DEFAULT_TIMES);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newBlocked, setNewBlocked] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [customDays, setCustomDays] = useState<number[]>([1]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const incoming = ((data as any).slots ?? []) as Slot[];
    const map = new Map<string, boolean>();
    const timeSet = new Set<string>(DEFAULT_TIMES);
    // Ensure every weekday has an entry for every known time (default false)
    for (const s of incoming) {
      timeSet.add(s.time);
    }
    const times = [...timeSet].sort();
    for (let wd = 0; wd < 7; wd++) {
      for (const t of times) {
        map.set(`${wd}|${t}`, false);
      }
    }
    for (const s of incoming) {
      map.set(`${s.weekday}|${s.time}`, s.enabled);
    }
    setSlots(map);
    setAllTimes(times);
    setBlocked(((data as any).blockedDates ?? []) as string[]);
    setDirty(false);
  }, [data]);

  const activeDays = useMemo(() => {
    if (scope === "custom") return customDays;
    return SCOPES.find((s) => s.value === scope)!.days;
  }, [scope, customDays]);

  // For each time: "on" if enabled on ALL active days; "off" if disabled on all;
  // "mixed" otherwise.
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
    const next = state === "on" ? false : true; // mixed and off both go to on
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
        for (const t of allTimes) {
          m.set(`${d}|${t}`, !!prev.get(`${srcWd}|${t}`));
        }
      }
      return m;
    });
    setDirty(true);
  }

  function toggleCustomDay(d: number) {
    setCustomDays((curr) =>
      curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d].sort(),
    );
  }

  function addBlocked() {
    if (!newBlocked) return;
    if (blocked.includes(newBlocked)) {
      toast.error("Ese día ya está bloqueado");
      return;
    }
    setBlocked((b) => [...b, newBlocked].sort());
    setNewBlocked("");
    setDirty(true);
  }

  function removeBlocked(d: string) {
    setBlocked((b) => b.filter((x) => x !== d));
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

  // Summary of how many slots are enabled per weekday — useful at a glance
  const summary = useMemo(() => {
    return DAYS.map((d) => {
      let count = 0;
      for (const t of allTimes) {
        if (slots.get(`${d.idx}|${t}`)) count++;
      }
      return { ...d, count };
    });
  }, [slots, allTimes]);

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
          <>
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
                <h3 className="text-sm font-semibold">Franjas horarias</h3>
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
                Toca una hora para activar/desactivar. Los cambios se aplican a los
                días seleccionados arriba.
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

              {/* Copy from another day */}
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

            {/* Blocked dates */}
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Días no laborables</h3>
              <p className="text-xs text-muted-foreground">
                Fechas específicas en las que tu negocio no estará disponible
                (vacaciones, festivos, etc.)
              </p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlocked}
                  onChange={(e) => setNewBlocked(e.target.value)}
                  data-testid="input-blocked-date"
                />
                <Button size="icon" onClick={addBlocked} data-testid="button-add-blocked">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-1.5 pt-2">
                {blocked.length === 0 && (
                  <li className="text-xs text-muted-foreground">Sin días bloqueados</li>
                )}
                {blocked.map((d) => (
                  <li
                    key={d}
                    className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm"
                    data-testid={`blocked-${d}`}
                  >
                    <span>{formatDateLong(d)}</span>
                    <button
                      onClick={() => removeBlocked(d)}
                      className="text-destructive hover-elevate p-1 rounded"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
