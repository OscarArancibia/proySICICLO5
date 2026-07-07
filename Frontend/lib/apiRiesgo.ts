import { API_URL } from "@/lib/api";

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

export interface AnalisisContexto {
  id_curso: number;
  curso: string;
  nivel: string;
  turno: string;
  id_materia: number;
  materia: string;
  id_gestion: number;
  gestion: number;
  trimestre: number;
  periodo: {
    fecha_inicio: string;
    fecha_fin: string;
  };
}

export interface AnalisisResumen {
  total_estudiantes: number;
  total_en_riesgo: number;
  bajo: number;
  medio: number;
  alto: number;
  critico: number;
  sin_datos: number;
  total_filtrado?: number;
}

export interface EstudianteAnalizado {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  ci: string | null;
  promedio: number | null;
  total_calificaciones: number;
  dimensiones_calificadas: number;
  total_registros_asistencia: number;
  inasistencias: number;
  tardanzas: number;
  justificadas: number;
  licencias: number;
  nivel_riesgo: "BAJO" | "MEDIO" | "ALTO" | "CRITICO" | null;
  causa_principal: string | null;
  causas: string[];
  estado_analisis: "analizado" | "sin_datos";
}

export interface AnalisisCursoResponse {
  message: string;
  contexto: AnalisisContexto;
  resumen: AnalisisResumen;
  estudiantes: EstudianteAnalizado[];
}

export interface TutorSimplificado {
  id_tutor: number;
  nombre_completo: string;
  parentesco: string;
  telefono: string | null;
  correo_electronico: string | null;
}

export interface RecomendacionResponse {
  message: string;
  contexto: AnalisisContexto;
  estudiante: {
    id_estudiante: number;
    nombre_completo: string;
    promedio: number | null;
    inasistencias: number;
    tardanzas: number;
    nivel_riesgo: string | null;
    causas: string[];
  };
  recomendaciones: string[];
}

export interface NotificacionResponse {
  requiere_seleccion_tutor?: boolean;
  message?: string;
  tutores?: TutorSimplificado[];
  aviso?: {
    id_aviso: number;
    titulo: string;
    destinatario: string;
    parentesco: string;
    mensaje: string;
  };
}

export const riesgoApi = {
  analizarRiesgo: (params: { id_curso: number; id_materia: number; trimestre: number }) => {
    return apiRequest<AnalisisCursoResponse>("POST", "/api/riesgo-academico/analizar", params);
  },

  consultarEstudiantesEnRiesgo: (params: {
    id_curso: number;
    id_materia: number;
    trimestre: number;
    nivel_riesgo?: string;
  }) => {
    const cleanParams: Record<string, string> = {
      id_curso: String(params.id_curso),
      id_materia: String(params.id_materia),
      trimestre: String(params.trimestre),
    };
    if (params.nivel_riesgo && params.nivel_riesgo !== "TODOS") {
      cleanParams.nivel_riesgo = params.nivel_riesgo;
    }
    const query = new URLSearchParams(cleanParams).toString();
    return apiRequest<AnalisisCursoResponse>("GET", `/api/riesgo-academico/estudiantes-en-riesgo?${query}`);
  },

  generarRecomendacion: (params: {
    id_curso: number;
    id_materia: number;
    trimestre: number;
    id_estudiante: number;
  }) => {
    return apiRequest<RecomendacionResponse>("POST", "/api/riesgo-academico/recomendacion", params);
  },

  notificarTutor: (params: {
    id_curso: number;
    id_materia: number;
    trimestre: number;
    id_estudiante: number;
    id_tutor?: number;
  }) => {
    return apiRequest<NotificacionResponse>("POST", "/api/riesgo-academico/notificar-tutor", params);
  },
};
