"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { stripePublicApi } from "@/lib/apiStripe";

interface Props {
  idPago: number;
  monto: string;
  concepto: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function CheckoutForm({ idPago, monto, concepto, onSuccess, onError }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: "if_required",
      });

      if (error) {
        onError(error.message ?? "Error al procesar el pago");
        return;
      }

      const result = await stripePublicApi.verificarPago(idPago);
      if (result.pago.estado === "completado" || result.stripeStatus === "succeeded") {
        onSuccess();
      } else {
        onError("El pago no pudo ser confirmado. Contacta al administrador.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        Concepto: <span className="font-medium">{concepto}</span>
        <span className="ml-2 font-semibold text-foreground">Bs. {monto}</span>
      </div>
      <PaymentElement />
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? "Procesando..." : `Pagar Bs. ${monto}`}
      </Button>
    </form>
  );
}
