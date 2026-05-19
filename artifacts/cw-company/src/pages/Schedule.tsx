import { useEffect, useState } from "react";
import {
  useGetCompanyAvailability,
  useUpdateCompanyAvailability,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { toast } from "sonner";

type Slot = { time: string; enabled: boolean };

export default function Schedule() {
  const { data, isLoading, refetch } = useGetCompanyAvailability();
  const update = useUpdateCompanyAvailability({
    mutation: { onSuccess: () => { toast.success("Horarios actualizados"); refetch(); } },
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newBlocked, setNewBlocked] = useState("");

  useEffect(() => {
    if (data) {
      setSlots((data as any).slots ?? []);
      setBlocked((data as any).blockedDates ?? []);
    }
  }, [data]);

  function toggle(time: string) {
    setSlots((s) => s.map((x) => (x.time === time ? { ...x, enabled: !x.enabled } : x)));
  }

  function addBlocked() {
    if (!newBlocked) return;
    if (blocked.includes(newBlocked)) return;
    setBlocked((b) => [...b, newBlocked].sort());
    setNewBlocked("");
  }

  function removeBlocked(d: string) {
    setBlocked((b) => b.filter((x) => x !== d));
  }

  function save() {
    update.mutate({ data: { slots, blockedDates: blocked } });
  }

  return (
    <AppShell>
      <AppHeader
        title="Horarios"
        subtitle="Disponibilidad de tu negocio"
        right={
          <Button size="sm" onClick={save} disabled={update.isPending} data-testid="button-save">
            Guardar
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <>
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Franjas horarias</h3>
              <p className="text-xs text-muted-foreground">
                Activa o desactiva los horarios disponibles para nuevas reservas
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    onClick={() => toggle(s.time)}
                    data-testid={`slot-${s.time}`}
                    className={`text-sm py-2 rounded-md border hover-elevate active-elevate-2 ${
                      s.enabled
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Días bloqueados</h3>
              <p className="text-xs text-muted-foreground">
                Días específicos en los que tu negocio no estará disponible
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

            <Switch className="hidden" />
          </>
        )}
      </div>
    </AppShell>
  );
}
