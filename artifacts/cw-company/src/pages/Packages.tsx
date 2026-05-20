import { useEffect, useState } from "react";
import {
  useListCompanyPackages,
  useUpdateCompanyPackages,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Packages() {
  const { data, isLoading, refetch } = useListCompanyPackages();
  const [items, setItems] = useState<any[]>([]);
  const update = useUpdateCompanyPackages({
    mutation: { onSuccess: () => { toast.success("Paquetes actualizados"); refetch(); } },
  });

  useEffect(() => {
    if (data) setItems(data as any[]);
  }, [data]);

  function toggle(id: string) {
    setItems((arr) => arr.map((p) => (p.package.id === id ? { ...p, active: !p.active } : p)));
  }

  function save() {
    update.mutate({
      data: { packages: items.map((p) => ({ packageId: p.package.id, active: p.active })) },
    });
  }

  return (
    <AppShell>
      <AppHeader
        title="Paquetes"
        subtitle="Planes que ofrece tu empresa"
        back="/profile"
        right={
          <Button size="sm" onClick={save} disabled={update.isPending} data-testid="button-save">
            Guardar
          </Button>
        }
      />
      <div className="p-4 space-y-2">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {items.map((p) => (
          <Card key={p.package.id} className="p-4 flex items-center gap-3" data-testid={`package-${p.package.slug}`}>
            <div
              className="w-2 h-12 rounded"
              style={{ backgroundColor: p.color ?? "hsl(var(--primary))" }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                Incluye {p.washType.name}
              </p>
            </div>
            <Switch
              checked={p.active}
              onCheckedChange={() => toggle(p.package.id)}
              data-testid={`switch-package-${p.package.slug}`}
            />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
