import { useEffect, useState } from "react";
import {
  useGetCompanyProfile,
  useUpdateCompanyProfile,
} from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function CompanyData() {
  const { data, isLoading, refetch } = useGetCompanyProfile();
  const update = useUpdateCompanyProfile({
    mutation: {
      onSuccess: () => {
        toast.success("Datos actualizados");
        refetch();
      },
    },
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (data) {
      setName((data as any).name ?? "");
      setPhone((data as any).phone ?? "");
    }
  }, [data]);

  const p = data as any;

  return (
    <AppShell>
      <AppHeader
        title="Datos del negocio"
        subtitle="Información de tu empresa"
        back="/profile"
      />
      <div className="p-4 space-y-4">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {p && (
          <Card className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" value={p.email ?? ""} disabled />
              <p className="text-[11px] text-muted-foreground">
                El correo no se puede modificar
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del negocio</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => update.mutate({ data: { name, phone } })}
              disabled={
                update.isPending ||
                (name === (p.name ?? "") && phone === (p.phone ?? ""))
              }
              data-testid="button-save-profile"
            >
              Guardar cambios
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
