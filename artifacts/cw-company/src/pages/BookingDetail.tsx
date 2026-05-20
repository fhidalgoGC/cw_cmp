import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCompanyBooking,
  useAcceptCompanyBooking,
  useRejectCompanyBooking,
  useStartCompanyBooking,
  useCompleteCompanyBooking,
  getListCompanyBookingsQueryKey,
  getGetCompanyDashboardQueryKey,
  getGetCompanyBookingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MobileFrame, AppHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, CompanyStatusBadge, PaymentBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateLong } from "@/lib/format";
import { ChevronLeft, Phone, MapPin, Car, Clock, Star } from "lucide-react";
import { toast } from "sonner";

export default function BookingDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetCompanyBooking(id);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListCompanyBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCompanyDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCompanyBookingQueryKey(id) });
  };

  const accept = useAcceptCompanyBooking({
    mutation: { onSuccess: () => { invalidate(); toast.success("Reserva aceptada"); } },
  });
  const reject = useRejectCompanyBooking({
    mutation: { onSuccess: () => { invalidate(); toast.success("Reserva rechazada"); navigate("/bookings"); } },
  });
  const start = useStartCompanyBooking({
    mutation: { onSuccess: () => { invalidate(); toast.success("Servicio iniciado"); } },
  });
  const complete = useCompleteCompanyBooking({
    mutation: { onSuccess: () => { invalidate(); toast.success("Servicio completado"); } },
  });

  const b = data as any;

  return (
    <MobileFrame>
      <AppHeader
        title="Detalle de reserva"
        right={
          <Link href="/bookings">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="p-4 space-y-4">
          {isLoading && <Skeleton className="h-64 w-full" />}
          {b && (
            <>
              <Card className="p-4 space-y-3" data-testid={`detail-${b.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateLong(b.date)}
                    </p>
                    <p className="text-2xl font-bold flex items-center gap-1.5">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      {b.time}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={b.status} />
                    <CompanyStatusBadge status={b.companyStatus} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold">{formatCurrency(b.totalPrice)}</p>
                  <div className="mt-1 flex justify-end">
                    <PaymentBadge type={b.paymentType ?? "directo"} />
                  </div>
                </div>
              </Card>

              <Card className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Cliente</h3>
                <p className="text-base font-medium">{b.clientName}</p>
                <a
                  href={`tel:${b.clientPhone}`}
                  className="text-sm text-primary flex items-center gap-1.5"
                  data-testid="link-phone"
                >
                  <Phone className="h-4 w-4" /> {b.clientPhone}
                </a>
                <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {b.addressFull}
                </p>
              </Card>

              <Card className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Vehículo</h3>
                <p className="text-base font-medium flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  {b.vehicleBrand} {b.vehicleModel}
                </p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Tamaño</p>
                    <p>{b.vehicleSize.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Color</p>
                    <p>{b.vehicleColor ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Placas</p>
                    <p>{b.vehiclePlate ?? "—"}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Servicio</h3>
                <p className="text-base font-medium">{b.washType.name}</p>
                {b.addOns?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Adicionales</p>
                    <ul className="text-sm space-y-0.5">
                      {b.addOns.map((a: any) => (
                        <li key={a.id}>· {a.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {b.comments && (
                  <div>
                    <p className="text-xs text-muted-foreground">Comentarios</p>
                    <p className="text-sm">{b.comments}</p>
                  </div>
                )}
              </Card>

              {b.status === "completed" && (
                <Card className="p-4 space-y-2" data-testid="card-review">
                  <h3 className="text-sm font-semibold">Reseña del cliente</h3>
                  {b.review ? (
                    <>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={
                              n <= b.review.rating
                                ? "h-5 w-5 fill-amber-400 text-amber-400"
                                : "h-5 w-5 text-muted-foreground/30"
                            }
                          />
                        ))}
                        <span className="ml-2 text-sm font-semibold">
                          {b.review.rating}.0
                        </span>
                      </div>
                      {b.review.comment ? (
                        <p className="text-sm text-foreground/90 italic">
                          “{b.review.comment}”
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          El cliente no dejó comentario.
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateLong(b.review.createdAt.slice(0, 10))}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      El cliente aún no ha calificado este servicio.
                    </p>
                  )}
                </Card>
              )}

              {showReject && b.companyStatus === "pending_acceptance" && (
                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Motivo de rechazo</h3>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Indica el motivo (mínimo 5 caracteres)"
                    data-testid="input-reject-reason"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowReject(false)}
                      data-testid="button-cancel-reject"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={rejectReason.trim().length < 5 || reject.isPending}
                      onClick={() => reject.mutate({ bookingId: id, data: { reason: rejectReason.trim() } })}
                      data-testid="button-confirm-reject"
                    >
                      Confirmar
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      {b && (
        <div className="sticky bottom-0 bg-background border-t p-3 flex gap-2">
          {b.companyStatus === "pending_acceptance" && !showReject && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowReject(true)}
                data-testid="button-reject"
              >
                Rechazar
              </Button>
              <Button
                className="flex-1"
                disabled={accept.isPending}
                onClick={() => accept.mutate({ bookingId: id })}
                data-testid="button-accept"
              >
                Aceptar
              </Button>
            </>
          )}
          {b.status === "accepted" && (
            <Button
              className="flex-1"
              disabled={start.isPending}
              onClick={() => start.mutate({ bookingId: id })}
              data-testid="button-start"
            >
              Iniciar servicio
            </Button>
          )}
          {b.status === "in_progress" && (
            <Button
              className="flex-1"
              disabled={complete.isPending}
              onClick={() => complete.mutate({ bookingId: id })}
              data-testid="button-complete"
            >
              Marcar como completado
            </Button>
          )}
          {(b.status === "completed" || b.status === "cancelled") && (
            <Link href="/bookings" className="flex-1">
              <Button variant="outline" className="w-full">Volver</Button>
            </Link>
          )}
        </div>
      )}
    </MobileFrame>
  );
}
