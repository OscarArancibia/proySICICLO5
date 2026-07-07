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

export const entregasApi = {
  listarMisCursos: () =>
    get<{ cursos: EntregaCurso[] }>("/api/entregas/mis-cursos").then(
      (r) => r.cursos,
    ),

  listarEstudiantes: (idCurso: number) =>
    get<{ estudiantes: EntregaEstudiante[] }>(
      `/api/entregas/cursos/${idCurso}/estudiantes`,
    ).then((r) => r.estudiantes),

  listarEntregasRegistradas: (idCurso: number) =>
    get<{ entregas: EntregaRegistro[] }>(
      `/api/entregas/cursos/${idCurso}/registradas`,
    ).then((r) => r.entregas),

  listarTutoresAutorizados: (idEstudiante: number) =>
    get<{ tutores: TutorAutorizado[] }>(
      `/api/entregas/estudiantes/${idEstudiante}/tutores-autorizados`,
    ).then((r) => r.tutores),

  // GET /api/entregas  (vista administrativa: SuperUsuario, Director, Administrativo)
  listarTodas: (params?: { fecha?: string }) => {
    const qs = params?.fecha
      ? `?fecha=${encodeURIComponent(params.fecha)}`
      : "";
    return get<{ entregas: EntregaListItem[] }>(`/api/entregas${qs}`).then(
      (r) => r.entregas,
    );
  },

  registrar: (data: RegistrarEntregaPayload) =>
    post<{
      mensaje: string;
      entrega: { id_entrega: number; fecha_hora_entrega: string };
    }>("/api/entregas", data),
};

export interface EntregaCurso {
  id_curso: number;
  paralelo: string;
  turno: string;
  nombre_grado: string;
  nombre_nivel: string;
  anio: number;
}

export interface EntregaEstudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string | null;
}

export interface TutorAutorizado {
  id_tutor: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  parentesco: string;
}

export interface RegistrarEntregaPayload {
  id_estudiante: number;
  id_tutor: number;
  observaciones?: string;
}

export interface EntregaRegistro {
  id_entrega: number;
  id_estudiante: number;
  id_tutor: number;
  fecha_hora_entrega: string;
  observaciones: string | null;
  tutor_nombre: string;
  tutor_apellido: string;
  parentesco: string | null;
}

// Item del listado administrativo global de entregas.
export interface EntregaListItem {
  id_entrega: number;
  fecha_hora_entrega: string;
  observaciones: string | null;
  id_estudiante: number;
  estudiante_nombre: string;
  estudiante_apellido: string;
  estudiante_ci: string | null;
  id_tutor: number;
  tutor_nombre: string;
  tutor_apellido: string;
  parentesco: string | null;
  id_docente: number;
  docente_username: string;
  docente_nombre: string | null;
  docente_apellido: string | null;
  id_curso: number | null;
  nombre_grado: string | null;
  paralelo: string | null;
  turno: string | null;
}

// ── Estado de cuenta (Ciclo 4) ────────────────────────────────────────────────
// Montado en /api/estado-cuenta — acceso: Admin, Director, Secretaria (roles 1,2,4)

export const estadoCuentaApi = {
  // GET /api/estado-cuenta/estudiantes?q=
  buscarEstudiantes: (q: string) =>
    get<{ estudiantes: EstadoCuentaBusqueda[] }>(
      `/api/estado-cuenta/estudiantes?q=${encodeURIComponent(q)}`,
    ).then((r) => r.estudiantes),

  // GET /api/estado-cuenta/:idEstudiante
  obtener: (idEstudiante: number) =>
    get<EstadoCuenta>(`/api/estado-cuenta/${idEstudiante}`),

  // POST /api/estado-cuenta/:idEstudiante/recordatorio
  enviarRecordatorio: (idEstudiante: number, idTutor?: number) =>
    post<{
      mensaje: string;
      tutor: { id: number; nombre: string; email: string };
      saldo_pendiente: number;
    }>(
      `/api/estado-cuenta/${idEstudiante}/recordatorio`,
      idTutor ? { id_tutor: idTutor } : {},
    ),
};

export interface EstadoCuentaBusqueda {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  id_curso: number | null;
  paralelo: string | null;
  nombre_grado: string | null;
}

export interface EstadoCuentaEstudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string | null;
  fecha_nacimiento: string | null;
  genero: string;
  estado: string;
}

export interface EstadoCuentaDeuda {
  id_deuda: number;
  monto: string;
  mes: string;
  estado_deuda: "pendiente" | "pagado" | "mora";
  fecha_generacion: string;
  nombre_concepto: string;
  concepto_desc: string | null;
  anio: number;
}

export interface EstadoCuentaPago {
  id_pago: number;
  monto_pagado: string;
  metodo_pago: string;
  estado_pago: string;
  fecha_pago: string;
  observaciones: string | null;
  numero_comprobante: string | null;
  archivo_pdf_url: string | null;
}

export interface EstadoCuentaTutor {
  id_tutor: number;
  nombre: string;
  apellido: string;
  correo_electronico: string | null;
  telefono: string | null;
  parentesco: string;
  contacto_emergencia: boolean;
  autorizado_recoger: boolean;
}

export interface EstadoCuenta {
  estudiante: EstadoCuentaEstudiante;
  deudas: EstadoCuentaDeuda[];
  pagos: EstadoCuentaPago[];
  saldo_pendiente: number;
  tutores: EstadoCuentaTutor[];
}

// ── Avisos / Comunicación (Ciclo 4) ───────────────────────────────────────────
// Montado en /api/avisos — publicar: Director o Profesor (roles 2, 3)

export type DestinatarioTipo = "todos" | "por_curso" | "individual";

export const avisosApi = {
  // GET /api/avisos?estado=&tipo=
  listar: (params?: { estado?: string; tipo?: DestinatarioTipo }) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return get<{ avisos: Aviso[] }>(`/api/avisos${qs}`).then((r) => r.avisos);
  },

  // GET /api/avisos/mis-estudiantes
  // Profesor: solo estudiantes de sus cursos. Director: todos los activos.
  listarMisEstudiantes: () =>
    get<{ estudiantes: AvisoEstudiante[] }>(
      "/api/avisos/mis-estudiantes",
    ).then((r) => r.estudiantes),

  // POST /api/avisos
  publicar: (data: PublicarAvisoPayload) =>
    post<{ mensaje: string; aviso: AvisoPublicado }>("/api/avisos", data),

  // GET /api/avisos/panel — avisos visibles para el estudiante logueado
  // (todos, de sus cursos o dirigidos directamente a él).
  misAvisosPanel: () =>
    get<{ avisos: AvisoPanel[] }>("/api/avisos/panel").then((r) => r.avisos),
};

export interface AvisoPanel {
  id_aviso: number;
  titulo: string;
  contenido: string;
  fecha_envio: string;
  publicado_por: string;
}

export interface AvisoEstudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci: string | null;
}

export interface Aviso {
  id_aviso: number;
  titulo: string;
  contenido: string;
  destinatario_tipo: DestinatarioTipo;
  id_curso_destino: number | null;
  id_estudiante_destino: number | null;
  estado: string;
  fecha_envio: string;
  publicado_por: string;
}

export interface PublicarAvisoPayload {
  titulo: string;
  contenido: string;
  destinatario_tipo: DestinatarioTipo;
  id_curso_destino?: number;
  id_estudiante_destino?: number;
}

export interface AvisoPublicado {
  id: number;
  titulo: string;
  contenido: string;
  destinatario_tipo: DestinatarioTipo;
  destinatarios: number;
  notificaciones_creadas: number;
  notificaciones_fallidas: number;
  fecha_envio: string;
}

// ── CU27 – Reportes ────────────────────────────────────────────────────────────
// Montado en /api/reportes — acceso: SuperUsuario, Director, Administrativo

// Descarga un archivo (PDF/Excel) desde un endpoint protegido.
// Lanza ApiError con el mensaje del backend si la respuesta no es OK (ej. 404 sin datos).
async function descargarArchivo(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const data = await res.json();
      mensaje = data.message || data.error || mensaje;
    } catch {
      /* respuesta no-JSON */
    }
    throw new ApiError(mensaje, res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=([^;]+)/);
  const nombre = match ? match[1].trim().replace(/"/g, "") : fallbackName;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface ReportesFiltros {
  gestiones: { id_gestion: number; anio: number; estado: string }[];
  niveles: { id_nivel: number; nombre_nivel: string }[];
  cursos: {
    id_curso: number;
    id_gestion: number;
    id_nivel: number;
    label: string;
  }[];
  materias: { id_materia: number; nombre_materia: string }[];
  categorias: string[];
  dimensiones: string[];
  supervisores: { id_usuario: number; label: string }[];
}

export interface ReporteReciente {
  descripcion: string;
  tabla_afectada: string | null;
  fecha_hora: string;
  usuario: string;
}

function buildQs(params: Record<string, string | undefined>): string {
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  ) as [string, string][];
  return filtered.length
    ? "?" + new URLSearchParams(filtered).toString()
    : "";
}

export const reportesApi = {
  getFiltros: () => get<ReportesFiltros>("/api/reportes/filtros"),

  getRecientes: () =>
    get<{ recientes: ReporteReciente[] }>("/api/reportes/recientes").then(
      (r) => r.recientes,
    ),

  descargar: (
    reporte: string,
    params: Record<string, string | undefined>,
  ) =>
    descargarArchivo(
      `/api/reportes/${reporte}${buildQs(params)}`,
      `reporte_${reporte}`,
    ),
};

// ── CU28 – Chatbot ─────────────────────────────────────────────────────────────
// Montado en /api/chatbot — acceso: SuperUsuario, Director, Administrativo

export type ChatbotTipo =
  | "ok"
  | "vacio"
  | "fuera_alcance"
  | "bloqueada"
  | "error";

export interface ChatbotRespuesta {
  tipo: ChatbotTipo;
  titulo?: string;
  respuesta?: string;
  message?: string;
  es_listado?: boolean;
  columnas?: string[];
  filas?: Record<string, unknown>[];
}

export const chatbotApi = {
  consultar: (pregunta: string) =>
    post<ChatbotRespuesta>("/api/chatbot/consultar", { pregunta }),

  exportar: (
    data: {
      titulo: string;
      columnas: string[];
      filas: Record<string, unknown>[];
      formato: "pdf" | "csv";
    },
  ) =>
    fetch(`${API_URL}/api/chatbot/exportar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        let mensaje = `Error ${res.status}`;
        try {
          const j = await res.json();
          mensaje = j.message || j.error || mensaje;
        } catch {
          /* no-JSON */
        }
        throw new ApiError(mensaje, res.status);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consulta.${data.formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }),
};

// ── Citas de atención (CU29) ──────────────────────────────────────────────────
// La API de citas vive ahora en ./citasApi. Se re-exporta aquí para no romper
// los imports existentes (`@/lib/Ciclo4api`).
export { citasApi, DIAS_SEMANA } from "./citasApi";
export type {
  ModalidadCita,
  MiHorario,
  HorarioDisponible,
  CitaProfesor,
  CitaTutor,
  Cita,
} from "./citasApi";
