// ── Citas de atención (CU29) ──────────────────────────────────────────────────
// Montado en /api/citas. Profesor (dashboard), Estudiante/tutor (portal), Director.
// El tutor accede desde la cuenta del estudiante (rol "Estudiante").

import { API_URL } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return typeof window !== "undefined"
    ? (localStorage.getItem("token") ?? "")
    : "";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      err.error || err.message || `Error ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => apiRequest<T>("GET", path);
const post = <T>(path: string, body: unknown) =>
  apiRequest<T>("POST", path, body);
const put = <T>(path: string, body: unknown) =>
  apiRequest<T>("PUT", path, body);

// ── Constantes ────────────────────────────────────────────────────────────────

export type ModalidadCita = "presencial" | "virtual";
export const DIAS_SEMANA = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

// ── Cliente ───────────────────────────────────────────────────────────────────

export const citasApi = {
  // Profesor
  registrarHorario: (data: {
    dia_semana: string;
    hora_inicio: string;
    hora_fin: string;
    modalidad: ModalidadCita;
    enlace_videollamada?: string;
  }) =>
    post<{ mensaje: string; id_horario_atencion: number }>(
      "/api/citas/horarios-atencion",
      data,
    ),
  misHorarios: () =>
    get<{ horarios: MiHorario[] }>("/api/citas/mis-horarios").then(
      (r) => r.horarios,
    ),
  confirmar: (idCita: number) =>
    put<{ mensaje: string }>(`/api/citas/citas/${idCita}/confirmar`, {}),
  proponerAlternativa: (
    idCita: number,
    data: {
      id_horario_atencion_alternativo: number;
      mensaje_alternativa?: string;
    },
  ) => put<{ mensaje: string }>(`/api/citas/citas/${idCita}/alternativa`, data),

  // Estudiante (tutor por la cuenta del estudiante)
  misProfesores: () =>
    get<{ profesores: CitaProfesor[] }>("/api/citas/mis-profesores").then(
      (r) => r.profesores,
    ),
  misTutores: () =>
    get<{ tutores: CitaTutor[] }>("/api/citas/mis-tutores").then(
      (r) => r.tutores,
    ),
  horariosDisponibles: (idProfesor: number) =>
    get<{ horarios: HorarioDisponible[] }>(
      `/api/citas/profesores/${idProfesor}/horarios-disponibles`,
    ).then((r) => r.horarios),
  solicitar: (data: {
    id_horario_atencion: number;
    motivo: string;
    id_tutor: number;
  }) => post<{ mensaje: string; id_cita: number }>("/api/citas/citas", data),

  // Estudiante (tutor): aceptar el horario alternativo propuesto
  aceptarAlternativa: (idCita: number) =>
    put<{ mensaje: string }>(
      `/api/citas/citas/${idCita}/aceptar-alternativa`,
      {},
    ),

  // Estudiante o Profesor
  cancelar: (idCita: number) =>
    put<{ mensaje: string }>(`/api/citas/citas/${idCita}/cancelar`, {}),

  // Listado (Director: todas; Profesor: suyas; Estudiante: de su hijo)
  listar: (params?: {
    estado?: string;
    id_profesor?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) => {
    // Solo enviar los filtros con valor (evita mandar "undefined" como texto).
    const clean: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) clean[k] = String(v);
      }
    }
    const qs = Object.keys(clean).length
      ? "?" + new URLSearchParams(clean).toString()
      : "";
    return get<{ citas: Cita[] }>(`/api/citas/citas${qs}`).then((r) => r.citas);
  },
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MiHorario {
  id_horario_atencion: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  modalidad: ModalidadCita;
  enlace_videollamada: string | null;
  estado: string;
  ocupado: boolean;
}

export interface HorarioDisponible {
  id_horario_atencion: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  modalidad: ModalidadCita;
  enlace_videollamada: string | null;
}

export interface CitaProfesor {
  id_profesor: number;
  nombre: string;
  apellido: string;
}

export interface CitaTutor {
  id_tutor: number;
  nombre: string;
  apellido: string;
  parentesco: string;
}

export interface Cita {
  id_cita: number;
  motivo: string;
  estado:
    | "pendiente"
    | "confirmada"
    | "realizada"
    | "cancelada"
    | "alternativa";
  fecha_cita: string | null;
  fecha_solicitud: string;
  fecha_confirmacion: string | null;
  mensaje_alternativa: string | null;
  id_horario_atencion: number;
  id_profesor: number;
  profesor_nombre: string;
  profesor_apellido: string;
  tutor_nombre: string;
  tutor_apellido: string;
  estudiante_nombre: string;
  estudiante_apellido: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  modalidad: ModalidadCita;
  enlace_videollamada: string | null;
}
