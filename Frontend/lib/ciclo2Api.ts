import { API_URL } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return typeof window !== "undefined"
    ? (localStorage.getItem("token") ?? "")
    : "";
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
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => apiRequest<T>("GET", path);
const post = <T>(path: string, body: unknown) =>
  apiRequest<T>("POST", path, body);
const put = <T>(path: string, body: unknown) =>
  apiRequest<T>("PUT", path, body);
const del = <T>(path: string) => apiRequest<T>("DELETE", path);

// ── CU08 – Cursos ─────────────────────────────────────────────────────────────
// Montado en /api/curso, rutas internas usan /cursos prefix

export const cursosApi = {
  // GET /api/curso/cursos → responde { total, cursos: [] }
  getAll: () =>
    get<{ total: number; cursos: CursoDetalle[] }>("/api/curso/cursos").then(
      (r) => r.cursos,
    ),
  // GET /api/curso/cursos/:id
  getOne: (id: number) =>
    get<{ curso: CursoDetalle }>(`/api/curso/cursos/${id}`).then(
      (r) => r.curso,
    ),
  // GET /api/curso/cursos/formulario/datos
  getFormulario: () =>
    get<FormularioCurso>("/api/curso/cursos/formulario/datos"),
  // POST /api/curso/cursos
  create: (data: CursoPayload) =>
    post<{ message: string; curso: CursoDetalle }>("/api/curso/cursos", data),
  // PUT /api/curso/cursos/:id
  update: (id: number, data: Partial<CursoPayload>) =>
    put<{ message: string; campos_editados?: string[] }>(
      `/api/curso/cursos/${id}`,
      data,
    ),
  // DELETE /api/curso/cursos/:id
  delete: (id: number) => del<{ message: string }>(`/api/curso/cursos/${id}`),
  // POST /api/curso/cursos/:id/duplicar
  duplicar: (id: number) =>
    post<{ message: string; nuevo_curso_id?: number }>(
      `/api/curso/cursos/${id}/duplicar`,
      {},
    ),
  // PATCH /api/curso/cursos/:id/activar
  activar: (id: number) =>
    apiRequest<{ message: string }>("PATCH", `/api/curso/cursos/${id}/activar`),
};

// ── CU09 – Materias asignadas ─────────────────────────────────────────────────
// Montado en /api/materia-asig, rutas internas usan /cursos prefix

export const materiaAsigApi = {
  // GET /api/materia-asig/cursos/:id/materias/disponibles
  getMaterias: (idCurso: number) =>
    get<{
      asignadas: MateriaAsignada[];
      disponibles: MateriaDisponible[];
      materias_asignadas: MateriaAsignada[];
      materias_disponibles_agrupadas: CampoMaterias[];
      catalogo_profesores: Profesor[];
      curso: {
        id_curso: number;
        nivel: string;
        profesor_titular: { id_profesor: number; nombre_completo: string };
      };
    }>(`/api/materia-asig/cursos/${idCurso}/materias/disponibles`),
  // POST /api/materia-asig/cursos/:id/materias
  // body: { materias: [{ id_materia, id_profesor }] } o { asignaciones: [...] }
  asignar: (
    idCurso: number,
    data: { materias: { id_materia: number; id_profesor: number }[] },
  ) =>
    post<{ message: string; asignaciones_exitosas?: MateriaAsignada[] }>(
      `/api/materia-asig/cursos/${idCurso}/materias`,
      data,
    ),
  // PUT /api/materia-asig/cursos/materias/:id/profesor
  actualizarProfesor: (idCursoMateria: number, id_profesor: number) =>
    put<{ message: string }>(
      `/api/materia-asig/cursos/materias/${idCursoMateria}/profesor`,
      { id_profesor },
    ),
  // DELETE /api/materia-asig/cursos/materias/:id
  eliminar: (idCursoMateria: number) =>
    del<{ message: string }>(
      `/api/materia-asig/cursos/materias/${idCursoMateria}`,
    ),
  // POST /api/materia-asig/cursos/:id/materias/plantilla
  cargarPlantilla: (idCurso: number) =>
    post<{ message: string; asignaciones: MateriaAsignada[] }>(
      `/api/materia-asig/cursos/${idCurso}/materias/plantilla`,
      {},
    ),
};

// ── CU10 – Horarios ───────────────────────────────────────────────────────────
// Montado en /api/horarios

export const horariosApi = {
  // GET /api/horarios/curso/:id_curso
  getByCurso: (idCurso: number) =>
    get<BloqueHorario[]>(`/api/horarios/curso/${idCurso}`),
  // GET /api/horarios/profesor/:id_profesor
  getByProfesor: (idProfesor: number) =>
    get<BloqueHorario[]>(`/api/horarios/profesor/${idProfesor}`),
  // POST /api/horarios
  create: (data: BloqueHorarioPayload) =>
    post<{ message: string; bloque: BloqueHorario }>("/api/horarios", data),
  // PUT /api/horarios/:id
  update: (id: number, data: Partial<BloqueHorarioPayload>) =>
    put<{ message: string; bloque: BloqueHorario }>(
      `/api/horarios/${id}`,
      data,
    ),
  // DELETE /api/horarios/:id
  delete: (id: number) => del<{ message: string }>(`/api/horarios/${id}`),
  // PUT /api/horarios/curso/:id_curso/publicar
  publicar: (idCurso: number) =>
    put<{ message: string; bloques_publicados: number }>(
      `/api/horarios/curso/${idCurso}/publicar`,
      {},
    ),
};

export const pagosApi = {
  getConceptos: () => get<Concepto[]>("/api/pagos/conceptos"),
  getDeudas: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<DeudaPago[]>(`/api/pagos/deudas${qs}`);
  },
  createDeuda: (data: {
    id_estudiante: number;
    id_gestion: number;
    id_concepto: number;
    monto: number;
    mes: string;
  }) => post<{ message: string; deuda: DeudaPago }>("/api/pagos/deudas", data),
  generateBulkDeudas: (data: BulkDeudasRequest) =>
    post<BulkDeudasResponse>("/api/pagos/deudas/masivas", data),
  registrarPago: (data: {
    id_deuda: number;
    monto_pagado: number;
    metodo_pago: string;
    estado?: string;
    comprobante_url?: string;
    observaciones?: string;
  }) => post<{ message: string; pago: Pago }>("/api/pagos", data),
  validarPago: (id: number, estado: string) =>
    put<{ message: string; pago: Pago }>(`/api/pagos/${id}/estado`, { estado }),
};

export const dimensionesApi = {
  get: () =>
    get<{
      gestion: { id_gestion: number; anio: number };
      dimensiones: Dimension[];
    }>("/api/dimensiones"),
  save: (data: { dimensiones: DimensionSave[] }) =>
    post<{ message: string; dimensiones: Dimension[] }>(
      "/api/dimensiones",
      data,
    ),
  update: (id: number, data: { puntaje_maximo: number }) =>
    put<{ message: string; dimension: Dimension }>(
      `/api/dimensiones/${id}`,
      data,
    ),
};

export const justificacionesApi = {
  buscarInasistencia: (id_estudiante: number, fecha: string) =>
    get<JustificacionDetalle>(
      `/api/justificaciones/inasistencia?id_estudiante=${id_estudiante}&fecha=${encodeURIComponent(
        fecha,
      )}`,
    ),
  registrar: (data: {
    id_asistencia: number;
    motivo: string;
    documento_referencia?: string;
    observaciones?: string;
  }) =>
    post<{ message: string; justificacion: Justificacion }>(
      "/api/justificaciones",
      data,
    ),
  listarPendientes: () =>
    get<Justificacion[]>("/api/justificaciones/pendientes"),
  resolver: (
    id: number,
    data: { estado: "aprobada" | "rechazada"; observaciones?: string },
  ) =>
    put<{ message: string; justificacion: Justificacion }>(
      `/api/justificaciones/${id}/resolver`,
      data,
    ),
  listar: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<Justificacion[]>(`/api/justificaciones${qs}`);
  },
};

// ── CU11 – Estudiantes ────────────────────────────────────────────────────────
// Montado en /api/estudiantes

export const estudiantesApi = {
  // GET /api/estudiantes?search=&estado=
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<Estudiante[]>(`/api/estudiantes${qs}`);
  },
  // POST /api/estudiantes
  create: (data: EstudiantePayload) =>
    post<{ message: string; estudiante: Estudiante; nota_traslado?: string }>(
      "/api/estudiantes",
      data,
    ),
  // PUT /api/estudiantes/:id
  update: (
    id: number,
    data: Partial<EstudiantePayload> & { estado?: string },
  ) =>
    put<{ message: string; estudiante: Estudiante; nota_motivo?: string }>(
      `/api/estudiantes/${id}`,
      data,
    ),
  // GET /api/estudiantes/exportar/csv
  exportarCsv: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetch(`${API_URL}/api/estudiantes/exportar/csv${qs}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },
};

// ── CU12 – Tutores ────────────────────────────────────────────────────────────
// Montado en /api/tutores

export const tutoresApi = {
  // GET /api/tutores/search?search=
  search: (q: string) =>
    get<Tutor[]>(`/api/tutores/search?search=${encodeURIComponent(q)}`),
  // POST /api/tutores
  create: (data: TutorPayload) =>
    post<{ message: string; tutor: Tutor }>("/api/tutores", data),
  // PUT /api/tutores/:id_tutor
  update: (id: number, data: Partial<TutorPayload>) =>
    put<{ message: string; tutor: Tutor }>(`/api/tutores/${id}`, data),
  // POST /api/tutores/vincular
  vincular: (data: VinculoPayload) =>
    post<{ message: string }>("/api/tutores/vincular", data),
  // PUT /api/tutores/vincular/:id_estudiante/:id_tutor
  editarVinculo: (
    idEstudiante: number,
    idTutor: number,
    data: VinculoEditPayload,
  ) =>
    put<{ message: string }>(
      `/api/tutores/vincular/${idEstudiante}/${idTutor}`,
      data,
    ),
  // DELETE /api/tutores/desvincular/:id_estudiante/:id_tutor
  desvincular: (idEstudiante: number, idTutor: number) =>
    del<{ message: string }>(
      `/api/tutores/desvincular/${idEstudiante}/${idTutor}`,
    ),
};

// ── CU13 – Inscripciones ─────────────────────────────────────────────────────
// Montado en /api/inscripciones

export const inscripcionesApi = {
  // GET /api/inscripciones?id_gestion=&id_curso=&estado=
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<InscripcionesResponse>(`/api/inscripciones${qs}`);
  },
  // POST /api/inscripciones
  inscribir: (data: {
    id_estudiante: number;
    id_curso: number;
    id_gestion: number;
  }) =>
    post<{ message: string; inscripcion: Inscripcion; advertencia?: string }>(
      "/api/inscripciones",
      data,
    ),
  // PUT /api/inscripciones/:id
  retirar: (
    idInscripcion: number,
    data: { estado: "retirado" | "trasladado"; motivo: string },
  ) =>
    put<{ message: string; inscripcion: Inscripcion }>(
      `/api/inscripciones/${idInscripcion}`,
      data,
    ),
  // POST /api/inscripciones/traslado/:id
  trasladar: (
    idInscripcion: number,
    data: { id_curso_destino: number; motivo: string },
  ) =>
    post<{ message: string; nueva_inscripcion: Inscripcion }>(
      `/api/inscripciones/traslado/${idInscripcion}`,
      data,
    ),
  // POST /api/inscripciones/masiva/csv
  masivaCsv: (data: {
    id_curso: number;
    id_gestion: number;
    csv_text: string;
  }) => post<MasivaCsvResponse>("/api/inscripciones/masiva/csv", data),
};

// ── CU14 – Expediente ─────────────────────────────────────────────────────────
// Montado en /api/expedientes

export const expedienteApi = {
  // GET /api/expedientes/:id_estudiante
  get: (idEstudiante: number) =>
    get<Expediente>(`/api/expedientes/${idEstudiante}`),
  // GET /api/expedientes/:id_estudiante/pdf
  exportarPdf: (idEstudiante: number) =>
    fetch(`${API_URL}/api/expedientes/${idEstudiante}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }),
};

// ── Estructura académica (auxiliares) ─────────────────────────────────────────

export const estructuraApi = {
  // GET /api/gestiones  (requiere rol Admin o Director — protegido en backend)
  getGestiones: () => get<Gestion[]>("/api/gestiones"),
  // GET /api/estructura
  getEstructura: () => get<EstructuraData>("/api/estructura"),
  // GET /api/profesores
  getProfesores: () => get<Profesor[]>("/api/profesores"),
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CursoDetalle {
  id_curso: number;
  paralelo: string;
  turno: string;
  nombre_grado: string;
  nombre_nivel: string;
  numero_aula?: string; // backend usa numero_aula
  nombre_aula?: string; // alias front
  profesor_titular?: string; // backend usa profesor_titular
  profesor_nombre?: string; // alias front
  capacidad_estudiantes?: number;
  capacidad?: number; // alias front
  total_estudiantes?: number;
  inscritos?: number; // alias front
  anio?: number;
  id_grado?: number;
  id_aula?: number;
  id_gestion?: number;
  id_profesor?: number;
}

export interface FormularioCurso {
  gestion_activa: { id_gestion: number; anio: number } | null;
  gestiones?: Gestion[]; // para compatibilidad
  niveles: {
    id_nivel: number;
    nombre_nivel: string;
    monto_mensualidad?: number;
  }[];
  grados: {
    id_grado: number;
    nombre_grado: string;
    id_nivel: number;
    nombre_nivel?: string;
  }[];
  aulas: {
    id_aula: number;
    numero_aula: string;
    capacidad_estudiantes: number;
    descripcion?: string;
    estado?: string;
  }[];
  profesores: Profesor[];
  turnos?: string[];
}

export interface CursoPayload {
  id_gestion: number;
  id_grado: number;
  paralelo: string;
  turno: string;
  id_aula: number;
  id_profesor: number;
}

export interface MateriaAsignada {
  id_curso_materia: number;
  id_materia: number;
  nombre_materia: string;
  nombre_campo?: string;
  nombre_profesor?: string;
  profesor?: string; // alias from backend
  id_profesor: number;
}

export interface MateriaDisponible {
  id_materia: number;
  nombre_materia: string;
  nombre_campo?: string;
}

export interface CampoMaterias {
  id_campo: number;
  nombre_campo: string;
  orden: number;
  materias: {
    id_materia: number;
    nombre_materia: string;
    descripcion?: string;
    profesor_sugerido?: number;
  }[];
}

export interface BloqueHorario {
  id_horario: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  actividad?: string;
  nombre_materia?: string;
  profesor?: string;
  id_materia?: number;
  publicado: boolean;
}

export interface BloqueHorarioPayload {
  id_curso: number;
  id_materia?: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  actividad?: string;
}

export interface DeudaPago {
  id_deuda: number;
  id_estudiante: number;
  estudiante: string;
  estudiante_ci?: string;
  id_gestion: number;
  anio: number;
  id_concepto: number;
  nombre_concepto: string;
  monto: string;
  mes: string;
  estado_deuda: string;
  id_pago?: number;
  monto_pagado?: string;
  metodo_pago?: string;
  estado_pago?: string;
  fecha_pago?: string;
}

export interface Concepto {
  id_concepto: number;
  nombre_concepto: string;
}

export interface BulkDeudasRequest {
  id_gestion: number;
  id_concepto: number;
  mes: string;
  filtros?: {
    id_nivel?: number;
    id_grado?: number;
    id_curso?: number;
    ids_estudiantes?: number[];
  };
}

export interface BulkDeudasResponse {
  message: string;
  resumen: {
    nuevas_deudas: number;
    ya_existentes: number;
    sin_arancel_configurado: number;
    total_procesados: number;
  };
}

export interface Dimension {
  id_dimension_eval: number;
  nombre_dimension: string;
  puntaje_maximo: number;
  id_gestion: number;
}

export interface DimensionSave {
  nombre_dimension: string;
  puntaje_maximo: number;
}

export interface Justificacion {
  id_justificacion: number;
  id_asistencia: number;
  id_estudiante: number;
  id_curso: number;
  fecha: string;
  motivo: string;
  documento_referencia?: string;
  observaciones?: string;
  estado: string;
  fecha_solicitud?: string;
  id_usuario_solicitante?: number;
  id_usuario_revisor?: number;
  fecha_resolucion?: string;
}

export interface JustificacionDetalle {
  id_asistencia: number;
  id_estudiante: number;
  id_curso: number;
  fecha: string;
  estado: string;
  observaciones?: string;
}

export interface Estudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci?: string;
  fecha_nacimiento?: string;
  genero: string;
  estado: string;
  edad?: number;
  observaciones?: string;
}

export interface EstudiantePayload {
  nombre: string;
  apellido: string;
  ci?: string;
  fecha_nacimiento?: string;
  genero: string;
  estado?: string;
  de_traslado?: boolean;
  institucion_origen?: string;
  observaciones?: string;
}

export interface Tutor {
  id_tutor: number;
  nombre: string;
  apellido: string;
  ci: string;
  genero: string;
  telefono?: string;
  correo_electronico?: string;
  direccion?: string;
}

export interface TutorPayload {
  nombre: string;
  apellido: string;
  ci: string;
  genero: string;
  telefono?: string;
  correo_electronico?: string;
  direccion?: string;
}

export interface VinculoPayload {
  id_tutor: number;
  id_estudiante: number;
  parentesco: string;
  autorizado_recoger: boolean;
  contacto_emergencia: boolean;
}

export interface VinculoEditPayload {
  parentesco?: string;
  autorizado_recoger?: boolean;
  contacto_emergencia?: boolean;
}

export interface Inscripcion {
  id_inscripcion: number;
  id_estudiante: number;
  id_curso: number;
  fecha_inscripcion: string;
  estado: string;
  observaciones?: string;
  estudiante?: string;
  estudiante_ci?: string;
  nombre_grado?: string;
  nombre_nivel?: string;
  paralelo?: string;
  turno?: string;
  anio?: number;
}

export interface InscripcionesResponse {
  total: number;
  inscripciones: Inscripcion[];
}

export interface MasivaCsvResponse {
  message: string;
  resumen: { total_procesados: number; exitosos: number; errores: number };
  resultados: {
    exitosos: { ci: string; nombre: string; id_inscripcion: number }[];
    errores: { fila: number; ci: string; error: string }[];
  };
}

export interface Expediente {
  datos_personales: Estudiante;
  tutores: (Tutor & {
    parentesco: string;
    autorizado_recoger: boolean;
    contacto_emergencia: boolean;
  })[];
  inscripciones: Inscripcion[];
  calificaciones: CalificacionGestion[];
  asistencias: ResumenAsistencia[];
  pagos: Pago[];
}

export interface CalificacionGestion {
  anio: number;
  materias: {
    id_materia: number;
    nombre_materia: string;
    campo: string;
    trimestres: {
      trimestre: number;
      dimensiones: {
        dimension: string;
        puntaje_maximo: number;
        total_obtenido: number;
      }[];
    }[];
  }[];
}

export interface ResumenAsistencia {
  id_curso: number;
  nombre_grado: string;
  paralelo: string;
  anio: number;
  total_dias: number;
  presentes: number;
  ausentes: number;
  tardanzas: number;
  justificados: number;
  porcentaje_asistencia: number;
  alerta_inasistencia: boolean;
}

export interface Pago {
  id_deuda: number;
  nombre_concepto: string;
  mes: string;
  monto_deuda: number;
  estado_deuda: string;
  id_pago?: number;
  monto_pagado?: number;
  fecha_pago?: string;
  numero_comprobante?: string;
}

export interface Gestion {
  id_gestion: number;
  anio: number;
  estado: string;
}

export interface Profesor {
  id_profesor: number;
  nombre: string;
  apellido: string;
  ci?: string;
}

export interface EstructuraData {
  niveles: { id_nivel: number; nombre_nivel: string }[];
  grados: { id_grado: number; nombre_grado: string; id_nivel: number }[];
  aulas: {
    id_aula: number;
    nombre_aula: string;
    capacidad_estudiantes: number;
  }[];
}
