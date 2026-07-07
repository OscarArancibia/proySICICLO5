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

export interface LibretaFilters {
  id_gestion?: string;
  trimestre?: string;
  id_curso?: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export interface LibretaListItem {
  id_libreta: number;
  trimestre: number;
  estado: string;
  fecha_generacion: string;
  observaciones: string | null;
  fecha_remision: string | null;
  fecha_aprobacion: string | null;
  promedio_general: string | null;
  archivo_pdf_url: string | null;
  est_nombre: string;
  est_apellido: string;
  curso_paralelo: string;
  nombre_grado: string;
  gestion_anio: number;
  revisado_por_prof: string | null;
  aprobado_por_dir: string | null;
}

export interface LibretaCabecera {
  id_libreta: number;
  trimestre: number;
  estado: string;
  observaciones: string | null;
  fecha_generacion: string;
  fecha_remision: string | null;
  fecha_aprobacion: string | null;
  promedio_general: string | null;
  archivo_pdf_url: string | null;
  est_nombre: string;
  est_apellido: string;
  est_ci: string | null;
  est_rude: string | null;
  id_estudiante: number;
  curso_paralelo: string;
  curso_turno: string;
  id_curso: number;
  nombre_grado: string;
  nombre_nivel: string;
  gestion_anio: number;
  id_gestion: number;
  revisado_por_prof: string | null;
  aprobado_por_dir: string | null;
}

export interface LibretaDetalleItem {
  id_libreta_detalle: number;
  id_materia: number;
  nombre_materia: string;
  id_campo: number;
  nombre_campo: string;
  nota_primer_trimestre: number | null;
  nota_segundo_trimestre: number | null;
  nota_tercer_trimestre: number | null;
  promedio_anual: number | null;
  promedio_literal: string | null;
  observacion: string | null;
  nota_ser: number | null;
  nota_saber: number | null;
  nota_hacer: number | null;
  nota_autoevaluacion: number | null;
}

export interface LibretaDetailResponse {
  cabecera: LibretaCabecera;
  detalles: LibretaDetalleItem[];
}

export const libretasApi = {
  validarCalificaciones: (params: { id_estudiante: number; id_curso: number; id_gestion: number; trimestre: number }) => {
    const query = new URLSearchParams({
      id_estudiante: String(params.id_estudiante),
      id_curso: String(params.id_curso),
      id_gestion: String(params.id_gestion),
      trimestre: String(params.trimestre)
    }).toString();
    return apiRequest<{ valido: boolean; message: string; pendientes?: any[] }>("GET", `/api/libretas/validar?${query}`);
  },

  generarLibreta: (data: { id_estudiante: number; id_curso: number; id_gestion: number; trimestre: number }) => {
    return apiRequest<{ message: string; id_libreta: number; estado: string }>("POST", "/api/libretas/generar", data);
  },

  remitirLibreta: (id: number, observacion: string) => {
    return apiRequest<{ message: string; id_libreta: number; estado: string }>("POST", `/api/libretas/${id}/remitir`, { observacion });
  },

  aprobarLibreta: (id: number) => {
    return apiRequest<{ message: string; id_libreta: number; estado: string }>("POST", `/api/libretas/${id}/aprobar`, {});
  },

  listarLibretas: (filters: LibretaFilters) => {
    const cleanFilters: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "all_gestiones" &&
        value !== "all_trimestres" &&
        value !== "all_cursos" &&
        value !== "all_estados"
      ) {
        cleanFilters[key] = String(value);
      }
    });
    const query = new URLSearchParams(cleanFilters).toString();
    return apiRequest<{
      total: number;
      page: number;
      limit: number;
      pages: number;
      data: LibretaListItem[];
    }>("GET", `/api/libretas?${query}`);
  },

  obtenerLibretaPorId: (id: number) => {
    return apiRequest<LibretaDetailResponse>("GET", `/api/libretas/${id}`);
  },

  getPdfUrl: (id: number): string => {
    return `${API_URL}/api/libretas/${id}/pdf?token=${getToken()}`;
  }
};
