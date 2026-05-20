import { useEffect, useMemo, useState } from "react";
import {
  useListCompanyServices,
  useUpdateCompanyServices,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export default function Services() {
  const { data, isLoading, refetch } = useListCompanyServices();
  const [items, setItems] = useState<any[]>([]);
  const update = useUpdateCompanyServices({
    mutation: { onSuccess: () => { toast.success("Servicios actualizados"); refetch(); } },
  });

  useEffect(() => {
    if (data) setItems(data as any[]);
  }, [data]);

  const grouped = useMemo(() => {
    return {
      wash: items.filter((s) => s.kind === "wash_type"),
      addons: items.filter((s) => s.kind === "add_on"),
    };
  }, [items]);

  function toggle(id: string) {
    setItems((arr) => arr.map((s) => (s.service.id === id ? { ...s, active: !s.active } : s)));
  }

  function save() {
    update.mutate({
      data: { services: items.map((s) => ({ serviceId: s.service.id, active: s.active })) },
    });
  }

  return (
    <AppShell>
      <AppHeader
        title="Servicios"
        subtitle="Tipos de lavado y adicionales"
        back="/profile"
        right={
          <Button size="sm" onClick={save} disabled={update.isPending} data-testid="button-save">
            Guardar
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && (
          <>
            <section>
              <h2 className="text-sm font-semibold mb-2">Tipos de lavado</h2>
              <div className="space-y-2">
                {grouped.wash.map((s) => (
                  <ServiceRow key={s.service.id} item={s} onToggle={toggle} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-semibold mb-2">Servicios adicionales</h2>
              <div className="space-y-2">
                {grouped.addons.map((s) => (
                  <ServiceRow key={s.service.id} item={s} onToggle={toggle} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ServiceRow({ item, onToggle }: { item: any; onToggle: (id: string) => void }) {
  return (
    <Card className="p-3 flex items-center gap-3" data-testid={`service-${item.service.slug}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
      </div>
      <Switch
        checked={item.active}
        onCheckedChange={() => onToggle(item.service.id)}
        data-testid={`switch-${item.service.slug}`}
      />
    </Card>
  );
}
