import { API_URL } from "@/lib/api";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function authRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface MisDatos {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  fecha_nacimiento: string | null;
  genero: string;
  estado: string;
  fecha_registro: string;
  observaciones: string | null;
}

export interface MiDeuda {
  id_deuda: number;
  id_gestion: number;
  anio: string;
  nombre_concepto: string;
  monto: string;
  mes: string;
  estado_deuda: "pendiente" | "mora" | "pagado";
  fecha_generacion: string;
  id_pago: number | null;
  id_stripe_payment: string | null;
  monto_pagado: string | null;
  metodo_pago: string | null;
  estado_pago: string | null;
  fecha_pago: string | null;
  observaciones: string | null;
}

export interface MiPago {
  id_pago: number;
  id_deuda: number;
  monto_pagado: string;
  monto_deuda: string;
  metodo_pago: string;
  estado: string;
  fecha_pago: string;
  observaciones: string | null;
  id_stripe_payment: string | null;
  mes: string;
  nombre_concepto: string;
  anio: string;
}

export interface ActividadCalificacion {
  id_actividad: number;
  nombre_actividad: string;
  fecha_actividad: string;
  nota: number;
  observaciones: string | null;
}

export interface DimensionCalificacion {
  dimension: string;
  puntaje_maximo: number;
  total_obtenido: number;
  actividades: ActividadCalificacion[];
}

export interface TrimestreCalificacion {
  trimestre: number;
  dimensiones: DimensionCalificacion[];
}

export interface MateriaCalificacion {
  id_materia: number;
  nombre_materia: string;
  campo: string;
  trimestres: TrimestreCalificacion[];
}

export interface GestionCalificacion {
  anio: string;
  materias: MateriaCalificacion[];
}

// ── API calls ────────────────────────────────────────────────────────────────

export const estudianteMeApi = {
  getMisDatos: () => authRequest<MisDatos>("GET", "/api/me/datos"),
  getMisCalificaciones: () => authRequest<GestionCalificacion[]>("GET", "/api/me/calificaciones"),
  getMisDeudas: () => authRequest<MiDeuda[]>("GET", "/api/me/deudas"),
  getMisPagos: () => authRequest<MiPago[]>("GET", "/api/me/pagos"),
};

export const adminEstudianteApi = {
  crearCuenta: (
    id_estudiante: number,
    data: { username: string; password: string; email: string }
  ) => authRequest<{ message: string }>("POST", `/api/estudiantes/${id_estudiante}/cuenta`, data),
};
