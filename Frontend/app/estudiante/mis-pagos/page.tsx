"use client";

import { useEffect, useState, useCallback } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CreditCard, History, CheckCircle2 } from "lucide-react";
import { estudianteMeApi, type MiDeuda, type MiPago } from "@/lib/apiEstudiante";
import { stripePublicApi } from "@/lib/apiStripe";
import { CheckoutForm } from "@/components/stripe/CheckoutForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const ESTADO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pendiente: "secondary",
  mora: "destructive",
  pagado: "default",
};

const PAGO_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  completado: "default",
  validado: "default",
  pendiente_validacion: "secondary",
  rechazado: "destructive",
};

interface PaymentSession {
  clientSecret: string;
  idPago: number;
  deuda: MiDeuda;
}

export default function MisPagosPage() {
  const [deudas, setDeudas] = useState<MiDeuda[]>([]);
  const [pagos, setPagos] = useState<MiPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initiating, setInitiating] = useState<number | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        estudianteMeApi.getMisDeudas(),
        estudianteMeApi.getMisPagos(),
      ]);
      setDeudas(d);
      setPagos(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const idEstudiante = () => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("idEstudiante") || "0");
  };

  async function handlePagar(deuda: MiDeuda) {
    setInitiating(deuda.id_deuda);
    setError(null);
    try {
      const { clientSecret, id_pago } = await stripePublicApi.crearPaymentIntent(
        deuda.id_deuda,
        idEstudiante()
      );
      setSession({ clientSecret, idPago: id_pago, deuda });
      setPaySuccess(false);
      setDialogOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInitiating(null);
    }
  }

  function handleSuccess() {
    setPaySuccess(true);
    refresh();
  }

  const pendientes = deudas.filter((d) => d.estado_deuda !== "pagado");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Mis Pagos</h1>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Tabs defaultValue="deudas">
        <TabsList>
          <TabsTrigger value="deudas">
            Deudas pendientes
            {pendientes.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {pendientes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* ── Deudas pendientes ── */}
        <TabsContent value="deudas" className="mt-4 space-y-3">
          {loading ? (
            <LoadingCards />
          ) : pendientes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No tienes deudas pendientes.
              </CardContent>
            </Card>
          ) : (
            pendientes.map((deuda) => (
              <Card key={deuda.id_deuda}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm truncate">{deuda.nombre_concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {deuda.mes} · Gestión {deuda.anio}
                    </p>
                    <Badge variant={ESTADO_VARIANT[deuda.estado_deuda] ?? "secondary"}>
                      {deuda.estado_deuda}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-base">Bs. {deuda.monto}</span>
                    <Button
                      size="sm"
                      onClick={() => handlePagar(deuda)}
                      disabled={initiating === deuda.id_deuda}
                    >
                      {initiating === deuda.id_deuda ? "Iniciando..." : "Pagar con Stripe"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Historial de pagos ── */}
        <TabsContent value="historial" className="mt-4 space-y-3">
          {loading ? (
            <LoadingCards />
          ) : pagos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No hay pagos registrados.
              </CardContent>
            </Card>
          ) : (
            pagos.map((pago) => (
              <Card key={pago.id_pago}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm truncate">{pago.nombre_concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {pago.mes} · Gestión {pago.anio} ·{" "}
                      {new Date(pago.fecha_pago).toLocaleDateString("es-BO")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={PAGO_VARIANT[pago.estado] ?? "secondary"}>
                        {pago.estado.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {pago.metodo_pago}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-base shrink-0">
                    Bs. {pago.monto_pagado}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Diálogo de pago Stripe ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setSession(null);
            setPaySuccess(false);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paySuccess ? "Pago completado" : "Pagar con tarjeta"}
            </DialogTitle>
          </DialogHeader>

          {paySuccess ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <div>
                <p className="font-semibold text-lg">¡Pago exitoso!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Tu pago ha sido procesado correctamente.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setDialogOpen(false);
                  setSession(null);
                  setPaySuccess(false);
                }}
              >
                Cerrar
              </Button>
            </div>
          ) : session ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret: session.clientSecret, appearance: { theme: "stripe" } }}
            >
              <CheckoutForm
                idPago={session.idPago}
                monto={session.deuda.monto}
                concepto={session.deuda.nombre_concepto}
                onSuccess={handleSuccess}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </>
  );
}
