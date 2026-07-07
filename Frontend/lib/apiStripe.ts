import { API_URL } from "@/lib/api";

async function publicRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface EstudiantePublico {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string;
  estado: string;
}

export interface DeudaEstudiante {
  id_deuda: number;
  id_estudiante: number;
  estudiante: string;
  estudiante_ci: string;
  id_gestion: number;
  anio: string;
  id_concepto: number;
  nombre_concepto: string;
  monto: string;
  mes: string;
  estado_deuda: "pendiente" | "mora" | "pagado";
  fecha_generacion: string;
  id_pago: number | null;
  id_stripe_payment?: string | null;
  id_stripe_payment_intent?: string | null;
  monto_pagado: string | null;
  metodo_pago: string | null;
  estado_pago: string | null;
  fecha_pago: string | null;
  observaciones: string | null;
}

export const stripePublicApi = {
  buscarEstudiante: (ci: string) =>
    publicRequest<EstudiantePublico>(
      "GET",
      `/api/pagos/portal/buscar?ci=${encodeURIComponent(ci)}`,
    ),

  getDeudas: (id_estudiante: number) =>
    publicRequest<DeudaEstudiante[]>(
      "GET",
      `/api/pagos/portal/deudas/${id_estudiante}`,
    ),

  crearPaymentIntent: (id_deuda: number, id_estudiante: number) =>
    publicRequest<{ clientSecret: string; id_pago: number }>(
      "POST",
      "/api/pagos/portal/payment-intent",
      {
        id_deuda,
        id_estudiante,
      },
    ),

  verificarPago: (id_pago: number) =>
    publicRequest<{ pago: { estado: string }; stripeStatus: string | null }>(
      "GET",
      `/api/pagos/portal/verificar/${id_pago}`,
    ),
};
