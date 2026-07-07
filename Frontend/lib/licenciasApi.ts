// ── Licencias y Reemplazos de profesores (CU30) ───────────────────────────────
// Backend: /api/licencias y /api/reemplazos.
// Roles: Profesor (solicita/extiende), Director (aprueba/rechaza/retorno/reemplazos),
// Administrativo (registra por secretaría + lista).

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

const qs = (params: Record<string, string | undefined>) => {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v) clean[k] = String(v);
  return Object.keys(clean).length
    ? "?" + new URLSearchParams(clean).toString()
    : "";
};

// ── Constantes ────────────────────────────────────────────────────────────────

export const TIPOS_LICENCIA = [
  "medica",
  "vacaciones",
  "personal",
  "permiso",
  "otro",
] as const;

export type TipoLicencia = (typeof TIPOS_LICENCIA)[number];

// ── Cliente: Licencias ─────────────────────────────────────────────────────────

export const licenciasApi = {
  // Profesor
  solicitar: (data: {
    tipo_licencia: string;
    fecha_inicio: string;
    fecha_fin: string;
    motivo: string;
    documento_url?: string;
  }) =>
    post<{ mensaje: string; id_licencia: number }>(
      "/api/licencias/solicitar",
      data,
    ),
  extender: (
    idLicencia: number,
    data: { fecha_nuevo_fin: string; motivo_extension: string },
  ) =>
    post<{ mensaje: string; id_licencia: number }>(
      `/api/licencias/${idLicencia}/extender`,
      data,
    ),
  misLicencias: () =>
    get<{ solicitudes: Licencia[] }>("/api/licencias/mis-licencias").then(
      (r) => r.solicitudes,
    ),
  // Horario de clases propio del profesor (cursos, materias y bloques)
  misClases: () => get<MiClase[]>("/api/horarios/mis-clases"),

  // Director / Administrativo
  listar: (params?: {
    estado?: string;
    id_profesor?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) =>
    get<{ solicitudes: Licencia[] }>(
      `/api/licencias/solicitudes${qs(params || {})}`,
    ).then((r) => r.solicitudes),

  // Director
  aprobar: (idLicencia: number, comentario?: string) =>
    put<{ mensaje: string }>(`/api/licencias/${idLicencia}/aprobar`, {
      comentario,
    }),
  rechazar: (idLicencia: number, comentario: string) =>
    put<{ mensaje: string }>(`/api/licencias/${idLicencia}/rechazar`, {
      comentario,
    }),
  retornar: (idLicencia: number, fecha_retorno: string) =>
    put<{ mensaje: string }>(`/api/licencias/${idLicencia}/retornar`, {
      fecha_retorno,
    }),
  profesoresConLicencia: () =>
    get<{ profesores_con_licencia: ProfesorConLicencia[] }>(
      "/api/licencias/profesores-con-licencia",
    ).then((r) => r.profesores_con_licencia),

  // Administrativo (E5)
  registrarPorSecretaria: (data: {
    id_profesor: number;
    tipo_licencia: string;
    fecha_inicio: string;
    fecha_fin: string;
    motivo: string;
    documento_url?: string;
  }) =>
    post<{ mensaje: string; id_licencia: number }>(
      "/api/licencias/registrar-por-secretaria",
      data,
    ),
};

// ── Cliente: Reemplazos (suplentes) ────────────────────────────────────────────

export const reemplazosApi = {
  materiasSinCobertura: (idLicencia: number) =>
    get<{ materias_sin_cobertura: MateriaSinCobertura[] }>(
      `/api/reemplazos/licencias/${idLicencia}/materias-sin-cobertura`,
    ).then((r) => r.materias_sin_cobertura),
  sugerirSuplentes: (
    idLicencia: number,
    params: { dia_semana: string; hora_inicio: string; hora_fin: string },
  ) =>
    get<{ suplentes_disponibles: SuplenteDisponible[] }>(
      `/api/reemplazos/licencias/${idLicencia}/sugerir-suplentes${qs(params)}`,
    ).then((r) => r.suplentes_disponibles),
  asignar: (data: {
    idLicencia: number;
    idCursoMateria: number;
    idProfesorSuplente: number;
    observaciones?: string;
  }) =>
    post<{ mensaje: string; id_reemplazo: number }>(
      "/api/reemplazos/reemplazos",
      data,
    ),
  cerrar: (idReemplazo: number) =>
    put<{ mensaje: string }>(
      `/api/reemplazos/reemplazos/${idReemplazo}/cerrar`,
      {},
    ),
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Licencia {
  id_licencia: number;
  tipo_licencia: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_fin_real: string | null;
  motivo: string;
  documento_url: string | null;
  estado: string;
  comentario_director: string | null;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  observaciones_aprobador: string | null;
  id_profesor: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  aprobador_username: string | null;
}

export interface ProfesorConLicencia {
  id_licencia: number;
  fecha_inicio: string;
  fecha_fin: string;
  id_profesor: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  materias_afectadas: number[];
}

export interface MateriaSinCobertura {
  id_curso_materia: number;
  id_curso: number;
  id_materia: number;
  paralelo: string;
  nombre_materia: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface SuplenteDisponible {
  id_profesor: number;
  nombre: string;
  apellido: string;
}

export interface MiClase {
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  actividad: string | null;
  nombre_materia: string;
  nombre_grado: string;
  paralelo: string;
  turno: string;
}
