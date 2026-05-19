import { useEffect, useState } from "react";
import { Link } from "wouter";
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
import { useAuth } from "@/lib/auth";
import { Package, Wrench, LogOut, Star, CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { logout, user } = useAuth();
  const { data, isLoading, refetch } = useGetCompanyProfile();
  const update = useUpdateCompanyProfile({
    mutation: { onSuccess: () => { toast.success("Perfil actualizado"); refetch(); } },
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
      <AppHeader title="Perfil" subtitle={user?.email} />
      <div className="p-4 space-y-4">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {p && (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {p.name?.[0]?.toUpperCase() ?? "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate">{p.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                <Stat icon={<Star className="h-4 w-4 text-amber-500" />} label="Rating" value={p.rating?.toFixed(1) ?? "—"} />
                <Stat icon={<ClipboardList className="h-4 w-4 text-primary" />} label="Reservas" value={String(p.totalBookings ?? 0)} />
                <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Completadas" value={String(p.completedBookings ?? 0)} />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Datos del negocio</h3>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
              </div>
              <Button
                className="w-full"
                onClick={() => update.mutate({ data: { name, phone } })}
                disabled={update.isPending}
                data-testid="button-save-profile"
              >
                Guardar cambios
              </Button>
            </Card>

            <Card className="divide-y">
              <Link href="/packages">
                <div className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer" data-testid="link-packages">
                  <Package className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Paquetes</p>
                    <p className="text-xs text-muted-foreground">Configura los planes que ofreces</p>
                  </div>
                </div>
              </Link>
              <Link href="/services">
                <div className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer" data-testid="link-services">
                  <Wrench className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Servicios</p>
                    <p className="text-xs text-muted-foreground">Lavados y adicionales activos</p>
                  </div>
                </div>
              </Link>
            </Card>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
