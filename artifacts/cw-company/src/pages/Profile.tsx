import { Link } from "wouter";
import { useGetCompanyProfile } from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
  Package,
  Wrench,
  Wallet,
  LogOut,
  Star,
  CheckCircle2,
  ClipboardList,
  ChevronRight,
  User as UserIcon,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";

type Status = "review" | "active" | "denied";

function StatusBanner({ status }: { status: Status }) {
  const config: Record<
    Status,
    {
      bg: string;
      text: string;
      icon: React.ReactNode;
      title: string;
      desc: string;
    }
  > = {
    active: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-800",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      title: "Cuenta activada",
      desc: "Tu negocio ya puede recibir reservas.",
    },
    review: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      title: "En revisión",
      desc: "La plataforma está revisando tu cuenta. Te avisaremos cuando esté activada.",
    },
    denied: {
      bg: "bg-rose-50 border-rose-200",
      text: "text-rose-800",
      icon: <XCircle className="h-5 w-5 text-rose-600" />,
      title: "Cuenta denegada",
      desc: "Tu solicitud no fue aprobada. Contacta a soporte para más información.",
    },
  };
  const c = config[status];
  return (
    <Card
      className={`p-3 flex items-start gap-3 border ${c.bg}`}
      data-testid={`status-banner-${status}`}
    >
      <div className="shrink-0 mt-0.5">{c.icon}</div>
      <div className={`flex-1 min-w-0 ${c.text}`}>
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-[12px] leading-snug opacity-90">{c.desc}</p>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    active: {
      label: "Activada",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    review: {
      label: "En revisión",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    denied: {
      label: "Denegada",
      cls: "bg-rose-100 text-rose-700 border-rose-200",
    },
  };
  const c = map[status];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.cls}`}
      data-testid={`status-pill-${status}`}
    >
      {c.label}
    </span>
  );
}

export default function Profile() {
  const { logout, user } = useAuth();
  const { data, isLoading } = useGetCompanyProfile();
  const p = data as any;
  const status: Status = (p?.status as Status) ?? "review";

  return (
    <AppShell>
      <AppHeader title="Perfil" subtitle={user?.email} />
      <div className="p-4 space-y-4">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {p && (
          <>
            {status !== "active" && <StatusBanner status={status} />}

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {p.name?.[0]?.toUpperCase() ?? "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold truncate">{p.name}</p>
                    <StatusPill status={status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {p.email}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                <Stat
                  icon={<Star className="h-4 w-4 text-amber-500" />}
                  label="Rating"
                  value={p.rating?.toFixed(1) ?? "—"}
                />
                <Stat
                  icon={<ClipboardList className="h-4 w-4 text-primary" />}
                  label="Reservas"
                  value={String(p.totalBookings ?? 0)}
                />
                <Stat
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  label="Completadas"
                  value={String(p.completedBookings ?? 0)}
                />
              </div>
            </Card>

            <Card className="divide-y">
              <Link href="/company-data">
                <div
                  className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid="link-company-data"
                >
                  <UserIcon className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Datos</p>
                    <p className="text-xs text-muted-foreground">
                      Nombre, correo y teléfono del negocio
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/packages">
                <div
                  className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid="link-packages"
                >
                  <Package className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Paquetes</p>
                    <p className="text-xs text-muted-foreground">
                      Configura los planes que ofreces
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/services">
                <div
                  className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid="link-services"
                >
                  <Wrench className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Servicios</p>
                    <p className="text-xs text-muted-foreground">
                      Lavados y adicionales activos
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/earnings">
                <div
                  className="flex items-center gap-3 p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid="link-earnings"
                >
                  <Wallet className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Ingresos</p>
                    <p className="text-xs text-muted-foreground">
                      Resumen de ventas y servicios cobrados
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </Card>

            {status === "review" && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 px-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                Mientras tu cuenta está en revisión puedes configurar tus datos,
                paquetes y servicios.
              </p>
            )}

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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
