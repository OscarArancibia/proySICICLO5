"use client";

import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2 } from "lucide-react";
import { stripePublicApi, type DeudaEstudiante, type EstudiantePublico } from "@/lib/apiStripe";
import { CheckoutForm } from "@/components/stripe/CheckoutForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Step = "search" | "debts" | "payment" | "success";

interface PaymentSession {
  clientSecret: string;
  idPago: number;
  deuda: DeudaEstudiante;
}

const BADGE_VARIANT: Record<DeudaEstudiante["estado_deuda"], "secondary" | "destructive" | "default"> = {
  pendiente: "secondary",
  mora: "destructive",
  pagado: "default",
};

export function PaymentPortal() {
  const [step, setStep] = useState<Step>("search");
  const [ci, setCi] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estudiante, setEstudiante] = useState<EstudiantePublico | null>(null);
  const [deudas, setDeudas] = useState<DeudaEstudiante[]>([]);
  const [session, setSession] = useState<PaymentSession | null>(null);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const est = await stripePublicApi.buscarEstudiante(ci.trim());
      const todas = await stripePublicApi.getDeudas(est.id_estudiante);
      setEstudiante(est);
      setDeudas(todas.filter((d) => d.estado_deuda !== "pagado"));
      setStep("debts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se encontró el estudiante.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectDeuda(deuda: DeudaEstudiante) {
    if (!estudiante) return;
    setError(null);
    setLoading(true);
    try {
      const { clientSecret, id_pago } = await stripePublicApi.crearPaymentIntent(
        deuda.id_deuda,
        estudiante.id_estudiante,
      );
      setSession({ clientSecret, idPago: id_pago, deuda });
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el pago.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("search");
    setCi("");
    setEstudiante(null);
    setDeudas([]);
    setSession(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Portal de Pagos</h1>
          <p className="text-muted-foreground text-sm">EduGestión — Pago seguro con Stripe</p>
        </div>

        {/* Step 1: Buscar estudiante */}
        {step === "search" && (
          <Card>
            <CardHeader>
              <CardTitle>Buscar Estudiante</CardTitle>
              <CardDescription>Ingresa tu número de cédula de identidad</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBuscar} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ci">Cédula de Identidad</Label>
                  <Input
                    id="ci"
                    placeholder="Ej. 12345678"
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={loading || !ci.trim()} className="w-full">
                  {loading ? "Buscando..." : "Buscar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Lista de deudas */}
        {step === "debts" && estudiante && (
          <Card>
            <CardHeader>
              <CardTitle>
                {estudiante.nombre} {estudiante.apellido}
              </CardTitle>
              <CardDescription>CI: {estudiante.ci} — Selecciona una deuda para pagar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {deudas.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No tienes deudas pendientes.
                </p>
              ) : (
                deudas.map((deuda) => (
                  <div
                    key={deuda.id_deuda}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{deuda.nombre_concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {deuda.mes} · {deuda.anio}
                      </p>
                      <Badge variant={BADGE_VARIANT[deuda.estado_deuda]}>
                        {deuda.estado_deuda}
                      </Badge>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-semibold">Bs. {deuda.monto}</span>
                      <Button
                        size="sm"
                        onClick={() => handleSelectDeuda(deuda)}
                        disabled={loading}
                      >
                        {loading ? "..." : "Pagar"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full" onClick={handleReset}>
                Volver
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Formulario de pago Stripe */}
        {step === "payment" && session && (
          <Card>
            <CardHeader>
              <CardTitle>Pago con Tarjeta</CardTitle>
              <CardDescription>Pago 100% seguro procesado por Stripe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: session.clientSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <CheckoutForm
                  idPago={session.idPago}
                  monto={session.deuda.monto}
                  concepto={session.deuda.nombre_concepto}
                  onSuccess={() => setStep("success")}
                  onError={(msg) => setError(msg)}
                />
              </Elements>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("debts");
                  setSession(null);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Éxito */}
        {step === "success" && (
          <Card>
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <div>
                <h2 className="text-xl font-bold">¡Pago exitoso!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Tu pago ha sido procesado correctamente.
                </p>
              </div>
              <Button onClick={handleReset} className="w-full">
                Realizar otro pago
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
