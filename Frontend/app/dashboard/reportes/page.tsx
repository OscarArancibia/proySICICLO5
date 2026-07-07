"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Download,
  Users,
  DollarSign,
  Package,
  ClipboardList,
  UserCheck,
  BarChart3,
  Calendar,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  reportesApi,
  type ReportesFiltros,
  type ReporteReciente,
} from "@/lib/Ciclo4api";
import { ApiError } from "@/lib/Ciclo4api";

type Formato = "pdf" | "excel";

interface ReportType {
  id: string;
  endpoint: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  formats: Formato[];
}

const reportTypes: ReportType[] = [
  {
    id: "students",
    endpoint: "estudiantes",
    title: "Reporte de Estudiantes",
    description: "Listado completo de estudiantes inscritos por nivel y grado",
    icon: Users,
    color: "text-primary",
    bg: "bg-primary/10",
    formats: ["pdf", "excel"],
  },
  {
    id: "payments",
    endpoint: "pagos",
    title: "Reporte de Pagos",
    description: "Estado de cuenta, pagos realizados y deudas pendientes",
    icon: DollarSign,
    color: "text-success",
    bg: "bg-success/10",
    formats: ["pdf", "excel"],
  },
  {
    id: "inventory",
    endpoint: "inventario",
    title: "Reporte de Inventario",
    description: "Stock actual, movimientos y materiales con bajo inventario",
    icon: Package,
    color: "text-info",
    bg: "bg-info/10",
    formats: ["pdf"],
  },
  {
    id: "grades",
    endpoint: "calificaciones",
    title: "Reporte de Calificaciones",
    description: "Notas por trimestre, dimensión y materia",
    icon: ClipboardList,
    color: "text-warning-foreground",
    bg: "bg-warning/10",
    formats: ["pdf", "excel"],
  },
  {
    id: "deliveries",
    endpoint: "entregas",
    title: "Reporte de Entregas",
    description: "Historial de entregas seguras de estudiantes a tutores",
    icon: UserCheck,
    color: "text-accent-foreground",
    bg: "bg-accent",
    formats: ["pdf"],
  },
  {
    id: "general",
    endpoint: "general",
    title: "Reporte General",
    description: "Resumen ejecutivo con estadísticas globales del colegio",
    icon: BarChart3,
    color: "text-muted-foreground",
    bg: "bg-muted",
    formats: ["pdf"],
  },
];

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ALL = "__all__";

export default function ReportesPage() {
  const [filtros, setFiltros] = useState<ReportesFiltros | null>(null);
  const [recientes, setRecientes] = useState<ReporteReciente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros globales
  const [idGestion, setIdGestion] = useState<string>(ALL);
  const [periodo, setPeriodo] = useState<string>(ALL);
  const [idNivel, setIdNivel] = useState<string>(ALL);

  // Diálogo de reporte específico
  const [openReport, setOpenReport] = useState<ReportType | null>(null);
  const [specific, setSpecific] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, r] = await Promise.all([
          reportesApi.getFiltros(),
          reportesApi.getRecientes(),
        ]);
        setFiltros(f);
        setRecientes(r);
        // Gestión activa por defecto
        const activa = f.gestiones.find((g) => g.estado === "activa");
        if (activa) setIdGestion(String(activa.id_gestion));
        else if (f.gestiones[0]) setIdGestion(String(f.gestiones[0].id_gestion));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Error al cargar el módulo de reportes",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshRecientes = async () => {
    try {
      setRecientes(await reportesApi.getRecientes());
    } catch {
      /* silencioso */
    }
  };

  const val = (v: string) => (v === ALL || v === "" ? undefined : v);

  const trimestreGlobal = periodo.startsWith("trimestre")
    ? periodo.replace("trimestre", "")
    : undefined;
  const mesGlobal = MESES.includes(periodo) ? periodo : undefined;

  const buildParams = (report: ReportType): Record<string, string | undefined> => {
    const g = val(idGestion);
    const n = val(idNivel);
    switch (report.endpoint) {
      case "estudiantes":
        return {
          id_gestion: g,
          id_nivel: n,
          id_curso: specific.id_curso,
          estado: specific.estado,
        };
      case "pagos":
        return {
          id_gestion: g,
          estado_deuda: specific.estado_deuda,
          mes: specific.mes || mesGlobal,
        };
      case "inventario":
        return {
          categoria: specific.categoria,
          estado: specific.estado,
          stock_bajo: specific.stock_bajo,
        };
      case "calificaciones":
        return {
          id_gestion: g,
          id_materia: specific.id_materia,
          trimestre: specific.trimestre || trimestreGlobal,
          dimension: specific.dimension,
        };
      case "entregas":
        return {
          fecha_inicio: specific.fecha_inicio,
          fecha_fin: specific.fecha_fin,
          id_supervisor: specific.id_supervisor,
        };
      case "general":
        return { id_gestion: g };
      default:
        return {};
    }
  };

  const handleDownload = async (report: ReportType, formato: Formato) => {
    const params = buildParams(report);
    if (formato === "excel") params.formato = "excel";
    else params.formato = "pdf";
    const key = `${report.id}-${formato}`;
    setDownloading(key);
    try {
      await reportesApi.descargar(report.endpoint, params);
      toast.success(`${report.title} generado correctamente`);
      await refreshRecientes();
      setOpenReport(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.warning(e.message);
      } else if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        toast.error(
          e.status === 401
            ? "Su sesión ha expirado. Por favor, inicie sesión nuevamente."
            : "No tiene permiso para acceder a este módulo.",
        );
      } else {
        toast.error(
          e instanceof Error
            ? e.message
            : "Ocurrió un error al generar el reporte.",
        );
      }
    } finally {
      setDownloading(null);
    }
  };

  const openDialog = (report: ReportType) => {
    setSpecific({});
    setOpenReport(report);
  };

  const setSp = (k: string, v: string) =>
    setSpecific((prev) => ({ ...prev, [k]: v === ALL ? "" : v }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Generación de reportes académicos y administrativos
          </p>
        </div>
      </div>

      {/* Filtros globales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros globales</CardTitle>
          <CardDescription>
            Se aplican a todos los reportes (gestión, período y nivel).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium mb-2 block">
                Gestión Académica
              </label>
              <Select value={idGestion} onValueChange={setIdGestion}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {filtros?.gestiones.map((g) => (
                    <SelectItem key={g.id_gestion} value={String(g.id_gestion)}>
                      {g.anio} {g.estado === "activa" ? "(activa)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Anual / Todos</SelectItem>
                  <SelectItem value="trimestre1">1er Trimestre</SelectItem>
                  <SelectItem value="trimestre2">2do Trimestre</SelectItem>
                  <SelectItem value="trimestre3">3er Trimestre</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium mb-2 block">Nivel</label>
              <Select value={idNivel} onValueChange={setIdNivel}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los niveles</SelectItem>
                  {filtros?.niveles.map((n) => (
                    <SelectItem key={n.id_nivel} value={String(n.id_nivel)}>
                      {n.nombre_nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grilla de reportes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => {
          const IconComponent = report.icon;
          return (
            <Card
              key={report.id}
              className="group hover:shadow-md transition-shadow flex flex-col"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${report.bg}`}
                  >
                    <IconComponent className={`h-6 w-6 ${report.color}`} />
                  </div>
                  <div className="flex gap-1">
                    {report.formats.map((format) => (
                      <Badge key={format} variant="outline" className="text-xs uppercase">
                        {format === "excel" ? "Excel" : "PDF"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <CardTitle className="text-lg mt-4">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => openDialog(report)}
                  disabled={loading}
                >
                  <Download className="h-4 w-4" />
                  Configurar y descargar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reportes Recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Reportes Recientes</CardTitle>
          <CardDescription>
            Últimos reportes exportados (registro de bitácora)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no se ha generado ningún reporte.
            </p>
          ) : (
            <div className="space-y-3">
              {recientes.map((r, idx) => {
                const esExcel = /excel/i.test(r.descripcion);
                return (
                  <div
                    key={idx}
                    className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        {esExcel ? (
                          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {r.descripcion.split(".")[0]}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.fecha_hora).toLocaleString("es-BO")}
                          <span>|</span>
                          {r.usuario}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="uppercase self-end sm:self-auto">
                      {esExcel ? "Excel" : "PDF"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de filtros específicos */}
      <Dialog
        open={!!openReport}
        onOpenChange={(o) => !o && setOpenReport(null)}
      >
        <DialogContent className="sm:max-w-md">
          {openReport && (
            <>
              <DialogHeader>
                <DialogTitle>{openReport.title}</DialogTitle>
                <DialogDescription>
                  Ajuste los filtros específicos y elija el formato de descarga.
                  Los filtros globales también se aplican.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {renderSpecificFilters(openReport, filtros, specific, setSp)}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                {openReport.formats.includes("pdf") && (
                  <Button
                    onClick={() => handleDownload(openReport, "pdf")}
                    disabled={downloading !== null}
                    className="gap-2"
                  >
                    {downloading === `${openReport.id}-pdf` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Descargar PDF
                  </Button>
                )}
                {openReport.formats.includes("excel") && (
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(openReport, "excel")}
                    disabled={downloading !== null}
                    className="gap-2"
                  >
                    {downloading === `${openReport.id}-excel` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Descargar Excel
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderSpecificFilters(
  report: ReportType,
  filtros: ReportesFiltros | null,
  specific: Record<string, string>,
  setSp: (k: string, v: string) => void,
) {
  const sel = (
    label: string,
    key: string,
    options: { value: string; label: string }[],
    allLabel = "Todos",
  ) => (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <Select
        value={specific[key] || ALL}
        onValueChange={(v) => setSp(key, v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleccione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  switch (report.endpoint) {
    case "estudiantes":
      return (
        <>
          {sel(
            "Curso / Paralelo",
            "id_curso",
            (filtros?.cursos || []).map((c) => ({
              value: String(c.id_curso),
              label: c.label,
            })),
          )}
          {sel("Estado del estudiante", "estado", [
            { value: "activo", label: "Activo" },
            { value: "inactivo", label: "Inactivo" },
            { value: "retirado", label: "Retirado" },
            { value: "egresado", label: "Egresado" },
          ])}
        </>
      );
    case "pagos":
      return (
        <>
          {sel("Estado de deuda", "estado_deuda", [
            { value: "pendiente", label: "Pendiente" },
            { value: "pagado", label: "Pagado" },
            { value: "mora", label: "Mora" },
          ])}
          {sel(
            "Mes de deuda",
            "mes",
            MESES.map((m) => ({ value: m, label: m })),
            "Todos (o el período global)",
          )}
        </>
      );
    case "inventario":
      return (
        <>
          {sel(
            "Categoría de material",
            "categoria",
            (filtros?.categorias || []).map((c) => ({ value: c, label: c })),
          )}
          {sel("Estado del material", "estado", [
            { value: "activo", label: "Activo" },
            { value: "inactivo", label: "Inactivo" },
          ])}
          {sel(
            "Filtro de stock",
            "stock_bajo",
            [{ value: "true", label: "Solo stock bajo" }],
            "Todos",
          )}
        </>
      );
    case "calificaciones":
      return (
        <>
          {sel(
            "Materia",
            "id_materia",
            (filtros?.materias || []).map((m) => ({
              value: String(m.id_materia),
              label: m.nombre_materia,
            })),
          )}
          {sel(
            "Trimestre",
            "trimestre",
            [
              { value: "1", label: "1er Trimestre" },
              { value: "2", label: "2do Trimestre" },
              { value: "3", label: "3er Trimestre" },
            ],
            "Todos (o el período global)",
          )}
          {sel(
            "Dimensión",
            "dimension",
            (filtros?.dimensiones || []).map((d) => ({ value: d, label: d })),
          )}
        </>
      );
    case "entregas":
      return (
        <>
          <div>
            <Label className="mb-2 block">Fecha desde</Label>
            <Input
              type="date"
              value={specific.fecha_inicio || ""}
              onChange={(e) => setSp("fecha_inicio", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-2 block">Fecha hasta</Label>
            <Input
              type="date"
              value={specific.fecha_fin || ""}
              onChange={(e) => setSp("fecha_fin", e.target.value)}
            />
          </div>
          {sel(
            "Supervisor / Docente",
            "id_supervisor",
            (filtros?.supervisores || []).map((s) => ({
              value: String(s.id_usuario),
              label: s.label,
            })),
          )}
        </>
      );
    case "general":
      return (
        <p className="text-sm text-muted-foreground">
          Este reporte consolida estadísticas globales del colegio. No requiere
          filtros adicionales (usa la gestión seleccionada en los filtros
          globales).
        </p>
      );
    default:
      return null;
  }
}
