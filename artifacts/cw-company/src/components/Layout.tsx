import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarClock,
  Package,
  Wrench,
  User,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const tabs = [
  { path: "/", label: "Inicio", icon: LayoutDashboard },
  { path: "/bookings", label: "Reservas", icon: ClipboardList },
  { path: "/schedule", label: "Horarios", icon: CalendarClock },
  { path: "/profile", label: "Perfil", icon: User },
];

const secondaryTabs = [
  { path: "/packages", label: "Paquetes", icon: Package },
  { path: "/services", label: "Servicios", icon: Wrench },
];

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-muted/40">
      <div className="mx-auto w-full max-w-[440px] min-h-screen bg-background shadow-md flex flex-col">
        {children}
      </div>
    </div>
  );
}

export function AppHeader({
  title,
  right,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** When provided, renders a back chevron on the left that links to this path. */
  back?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-2 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {back && (
          <Link href={back}>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 -ml-1"
              data-testid="button-back"
              aria-label="Volver"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <div className={cn("min-w-0", !back && "pl-2")}>
          <h1
            className="text-lg font-semibold leading-tight truncate"
            data-testid="app-header-title"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pr-2">{right}</div>
    </header>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const isActive = (p: string) => (p === "/" ? location === "/" : location.startsWith(p));
  return (
    <nav className="sticky bottom-0 z-30 bg-background border-t">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.path);
          return (
            <li key={t.path}>
              <Link
                href={t.path}
                data-testid={`nav-${t.path === "/" ? "home" : t.path.slice(1)}`}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium hover-elevate active-elevate-2",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MobileFrame>
      <main className="flex-1 overflow-y-auto pb-4">{children}</main>
      <BottomNav />
    </MobileFrame>
  );
}

export function SecondaryNavLink() {
  return secondaryTabs;
}
