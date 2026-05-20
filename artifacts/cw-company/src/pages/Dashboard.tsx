import { useState, useMemo } from "react";
import { useGetCompanyDashboard, useGetCompanyProfile } from "@workspace/api-client-react";
import { AppShell, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateLong, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, AlertCircle, Star, MessageSquare } from "lucide-react";

type ReviewFilter = "all" | "good" | "regular" | "bad";

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "good", label: "Buenos" },
  { id: "regular", label: "Regular" },
  { id: "bad", label: "Malos" },
];

function matchesFilter(rating: number, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "good") return rating >= 4;
  if (filter === "regular") return rating === 3;
  return rating <= 2;
}

export default function Dashboard() {
  const today = todayIso();
  const { data: profile } = useGetCompanyProfile();
  const { data, isLoading } = useGetCompanyDashboard({ date: today });

  return (
    <AppShell>
      <AppHeader
        title={`Hola, ${(profile as any)?.name ?? "Empresa"}`}
        subtitle={formatDateLong(today)}
      />

      <div className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Calendar className="h-4 w-4" />}
                label="Reservas hoy"
                value={String((data as any)?.summary?.total ?? 0)}
                testId="stat-total"
              />
              <StatCard
                icon={<AlertCircle className="h-4 w-4" />}
                label="Por aceptar"
                value={String((data as any)?.summary?.pendingAcceptance ?? 0)}
                accent="amber"
                testId="stat-pending"
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="En curso"
                value={String((data as any)?.summary?.inProgress ?? 0)}
                accent="violet"
                testId="stat-inprogress"
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Ingresos hoy"
                value={formatCurrency((data as any)?.summary?.revenueToday ?? 0)}
                accent="emerald"
                testId="stat-revenue"
              />
            </div>

            <section>
              <h2 className="text-sm font-semibold mb-2">Calificación general</h2>
              <RatingCard
                rating={(data as any)?.rating ?? null}
                total={(data as any)?.totalReviews ?? 0}
              />
            </section>

            <ReviewsSection reviews={(data as any)?.recentReviews ?? []} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "amber" | "violet" | "emerald";
  testId?: string;
}) {
  const accentCls =
    accent === "amber"
      ? "text-amber-700 bg-amber-50"
      : accent === "violet"
      ? "text-violet-700 bg-violet-50"
      : accent === "emerald"
      ? "text-emerald-700 bg-emerald-50"
      : "text-primary bg-primary/10";
  return (
    <Card className="p-3" data-testid={testId}>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accentCls}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </Card>
  );
}

function ReviewsSection({ reviews }: { reviews: any[] }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const counts = useMemo(
    () => ({
      all: reviews.length,
      good: reviews.filter((r) => r.rating >= 4).length,
      regular: reviews.filter((r) => r.rating === 3).length,
      bad: reviews.filter((r) => r.rating <= 2).length,
    }),
    [reviews],
  );

  const filtered = reviews.filter((r) => matchesFilter(r.rating, filter));

  return (
    <section>
      <h2 className="text-sm font-semibold mb-2">Comentarios de clientes</h2>
      <div className="flex gap-1.5 mb-2 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              data-testid={`filter-${f.id}`}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover-elevate active-elevate-2",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "ml-1.5 text-[10px]",
                  active ? "opacity-70" : "text-muted-foreground",
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="space-y-2 max-h-80 overflow-y-auto pr-1 -mr-1"
        data-testid="reviews-scroll"
      >
        {reviews.length === 0 ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            Aún no hay reseñas de clientes
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            No hay comentarios en esta categoría
          </Card>
        ) : (
          filtered.map((r: any) => <ReviewRow key={r.id} review={r} />)
        )}
      </div>
    </section>
  );
}

function RatingCard({
  rating,
  total,
}: {
  rating: number | null;
  total: number;
}) {
  const value = rating ?? 0;
  return (
    <Card
      className="p-4 border-amber-200 bg-amber-50/50"
      data-testid="card-rating"
    >
      <div className="flex items-center gap-4">
        <div className="text-center shrink-0">
          <p className="text-3xl font-bold text-amber-700 leading-none">
            {rating != null ? rating.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
            {total} {total === 1 ? "reseña" : "reseñas"}
          </p>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  n <= Math.round(value)
                    ? "h-5 w-5 fill-amber-400 text-amber-400"
                    : "h-5 w-5 text-muted-foreground/30"
                }
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {total === 0
              ? "Aún sin calificaciones"
              : "Promedio de tus clientes"}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ReviewRow({ review }: { review: any }) {
  return (
    <Card className="p-3" data-testid={`review-${review.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate">{review.clientName}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={
                n <= review.rating
                  ? "h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  : "h-3.5 w-3.5 text-muted-foreground/30"
              }
            />
          ))}
        </div>
      </div>
      {review.comment ? (
        <p className="text-sm text-foreground/90 italic mt-1.5">
          “{review.comment}”
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Sin comentario
        </p>
      )}
    </Card>
  );
}
