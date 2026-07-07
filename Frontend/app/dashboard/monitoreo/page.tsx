"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  Send,
  Eye,
  ShieldAlert,
  Search,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cursosApi, materiaAsigApi, CursoDetalle, MateriaAsignada } from "@/lib/ciclo2Api";
import { riesgoApi, EstudianteAnalizado, TutorSimplificado, AnalisisContexto, AnalisisResumen } from "@/lib/apiRiesgo";

export default function MonitoreoRendimientoPage() {
  const [userRole, setUserRole] = useState<number | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Filtros
  const [cursos, setCursos] = useState<CursoDetalle[]>([]);
  const [materias, setMaterias] = useState<MateriaAsignada[]>([]);
  const [filtroCurso, setFiltroCurso] = useState<string>("");
  const [filtroMateria, setFiltroMateria] = useState<string>("");
  const [filtroTrimestre, setFiltroTrimestre] = useState<string>("");
  const [filtroNivel, setFiltroNivel] = useState<string>("TODOS");

  const [loadingCursos, setLoadingCursos] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(false);

  // Estados de consulta y análisis
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analisisRealizado, setAnalisisRealizado] = useState(false);
  const [contexto, setContexto] = useState<AnalisisContexto | null>(null);
  const [resumen, setResumen] = useState<AnalisisResumen | null>(null);
  const [estudiantes, setEstudiantes] = useState<EstudianteAnalizado[]>([]);

  // Estudiante Seleccionado para Detalle
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<EstudianteAnalizado | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Recomendación
  const [loadingRecomendacion, setLoadingRecomendacion] = useState(false);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [isRecOpen, setIsRecOpen] = useState(false);

  // Notificación
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [tutores, setTutores] = useState<TutorSimplificado[]>([]);
  const [tutorSeleccionado, setTutorSeleccionado] = useState<string>("");
  const [mensajeNotif, setMensajeNotif] = useState<string>("");
  const [enviandoNotif, setEnviandoNotif] = useState(false);

  // Cargar rol de usuario y cursos iniciales
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      if (role) setUserRole(parseInt(role, 10));
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    async function loadCursos() {
      try {
        setLoadingCursos(true);
        const list = await cursosApi.getAll();
        setCursos(list || []);
      } catch (err: any) {
        console.error("Error al cargar cursos:", err);
        setError("Error al cargar los cursos desde la API.");
      } finally {
        setLoadingCursos(false);
      }
    }
    if (userRole !== null) {
      loadCursos();
    }
  }, [userRole]);

  // Cargar materias según curso seleccionado
  useEffect(() => {
    async function loadMaterias() {
      if (!filtroCurso) {
        setMaterias([]);
        setFiltroMateria("");
        return;
      }
      try {
        setLoadingMaterias(true);
        const res = await materiaAsigApi.getMaterias(Number(filtroCurso));
        setMaterias(res.asignadas || []);
        setFiltroMateria("");
      } catch (err: any) {
        console.error("Error al cargar materias:", err);
        setError("Error al cargar las materias asignadas al curso.");
      } finally {
        setLoadingMaterias(false);
      }
    }
    loadMaterias();
  }, [filtroCurso]);

  // Analizar Riesgo
  const analizarRiesgo = async () => {
    if (!filtroCurso || !filtroMateria || !filtroTrimestre) {
      setError("Debe seleccionar un Curso, una Materia y un Trimestre.");
      return;
    }

    setCargando(true);
    setError(null);
    setAnalisisRealizado(false);

    try {
      let res;
      if (filtroNivel === "TODOS" || filtroNivel === "BAJO") {
        res = await riesgoApi.analizarRiesgo({
          id_curso: Number(filtroCurso),
          id_materia: Number(filtroMateria),
          trimestre: Number(filtroTrimestre),
        });
      } else {
        res = await riesgoApi.consultarEstudiantesEnRiesgo({
          id_curso: Number(filtroCurso),
          id_materia: Number(filtroMateria),
          trimestre: Number(filtroTrimestre),
          nivel_riesgo: filtroNivel,
        });
      }

      setContexto(res.contexto);
      setResumen(res.resumen);
      setEstudiantes(res.estudiantes || []);
      setAnalisisRealizado(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al realizar el análisis.");
    } finally {
      setCargando(false);
    }
  };

  // Limpiar Filtros
  const limpiarFiltros = () => {
    setFiltroCurso("");
    setFiltroMateria("");
    setFiltroTrimestre("");
    setFiltroNivel("TODOS");
    setError(null);
    setAnalisisRealizado(false);
    setContexto(null);
    setResumen(null);
    setEstudiantes([]);
  };

  // Generar Recomendaciones
  const generarRecomendacion = async (est: EstudianteAnalizado) => {
    setEstudianteSeleccionado(est);
    setLoadingRecomendacion(true);
    setError(null);
    try {
      const res = await riesgoApi.generarRecomendacion({
        id_curso: Number(filtroCurso),
        id_materia: Number(filtroMateria),
        trimestre: Number(filtroTrimestre),
        id_estudiante: est.id_estudiante,
      });
      setRecomendaciones(res.recomendaciones || []);
      setIsRecOpen(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al generar la recomendación.");
    } finally {
      setLoadingRecomendacion(false);
    }
  };

  // Abrir Modal de Notificación
  const abrirModalNotificacion = async (est: EstudianteAnalizado) => {
    setEstudianteSeleccionado(est);
    setError(null);
    setCargando(true);
    try {
      // 1. Obtener las recomendaciones primero si no se cargaron
      let recList = recomendaciones;
      if (estudianteSeleccionado?.id_estudiante !== est.id_estudiante) {
        const recRes = await riesgoApi.generarRecomendacion({
          id_curso: Number(filtroCurso),
          id_materia: Number(filtroMateria),
          trimestre: Number(filtroTrimestre),
          id_estudiante: est.id_estudiante,
        });
        recList = recRes.recomendaciones;
        setRecomendaciones(recList);
      }

      // 2. Consultar tutores
      const res = await riesgoApi.notificarTutor({
        id_curso: Number(filtroCurso),
        id_materia: Number(filtroMateria),
        trimestre: Number(filtroTrimestre),
        id_estudiante: est.id_estudiante,
      });

      if (res.requiere_seleccion_tutor) {
        setTutores(res.tutores || []);
        setTutorSeleccionado("");
        // Pre-llenar mensaje base
        const msg = getPreFilledMessage(est, null, contexto?.curso || "", contexto?.materia || "", String(filtroTrimestre), recList);
        setMensajeNotif(msg);
        setIsNotifOpen(true);
      } else if (res.aviso) {
        // Solo un tutor
        setTutores([]);
        setTutorSeleccionado("");
        setMensajeNotif(res.aviso.mensaje);
        setIsNotifOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al inicializar la notificación.");
    } finally {
      setCargando(false);
    }
  };

  // Pre-llenar plantilla de mensaje en frontend
  const getPreFilledMessage = (
    est: EstudianteAnalizado,
    tutor: TutorSimplificado | null,
    curso: string,
    materia: string,
    trimestre: string,
    recList: string[]
  ) => {
    const tutorNombre = tutor ? tutor.nombre_completo : "[Nombre del Tutor]";
    return `Estimado/a tutor/a ${tutorNombre},

Se genera esta alerta académica automática de seguimiento para el estudiante:
Estudiante: ${est.nombre_completo}
Curso: ${curso}
Materia: ${materia}
Trimestre: ${trimestre}

MÉTRICAS DE RENDIMIENTO:
- Promedio actual en la materia: ${est.promedio !== null ? est.promedio + " puntos" : "Sin calificaciones"}
- Inasistencias no justificadas: ${est.inasistencias}
- Tardanzas: ${est.tardanzas}

NIVEL DE RIESGO DETECTADO: ${est.nivel_riesgo}

CAUSAS DE ALERTA:
${est.causas.map((c) => `- ${c}`).join("\n") || "- Ninguna causa crítica registrada"}

RECOMENDACIONES SUGERIDAS:
${recList.map((r) => `- ${r}`).join("\n") || "- Realizar acompañamiento general del estudiante"}`;
  };

  // Manejar cambio de tutor en el select
  const handleTutorChange = (val: string) => {
    setTutorSeleccionado(val);
    const selected = tutores.find((t) => String(t.id_tutor) === val);
    if (selected && estudianteSeleccionado) {
      const msg = getPreFilledMessage(
        estudianteSeleccionado,
        selected,
        contexto?.curso || "",
        contexto?.materia || "",
        String(filtroTrimestre),
        recomendaciones
      );
      setMensajeNotif(msg);
    }
  };

  // Enviar Notificación al Tutor
  const enviarNotificacion = async () => {
    if (!estudianteSeleccionado) return;
    if (tutores.length > 1 && !tutorSeleccionado) {
      alert("Por favor seleccione un tutor destinatario.");
      return;
    }

    const confirmacion = window.confirm("¿Está seguro de enviar esta alerta al tutor?");
    if (!confirmacion) return;

    setEnviandoNotif(true);
    try {
      const res = await riesgoApi.notificarTutor({
        id_curso: Number(filtroCurso),
        id_materia: Number(filtroMateria),
        trimestre: Number(filtroTrimestre),
        id_estudiante: estudianteSeleccionado.id_estudiante,
        id_tutor: tutorSeleccionado ? Number(tutorSeleccionado) : undefined,
        mensaje: mensajeNotif,
      } as any);

      alert(res.message || "La alerta fue enviada correctamente al tutor.");
      setIsNotifOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al enviar la notificación.");
    } finally {
      setEnviandoNotif(false);
    }
  };

  // Renderizar etiqueta de riesgo
  const getBadgeRiesgo = (nivel: string | null) => {
    if (!nivel) {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-300">
          Sin Datos
        </Badge>
      );
    }
    switch (nivel.toUpperCase()) {
      case "CRITICO":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold uppercase animate-pulse">
            Crítico
          </Badge>
        );
      case "ALTO":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300 font-bold uppercase">
            Alto
          </Badge>
        );
      case "MEDIO":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-medium uppercase">
            Medio
          </Badge>
        );
      case "BAJO":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 font-medium uppercase">
            Bajo
          </Badge>
        );
      default:
        return <Badge>{nivel}</Badge>;
    }
  };

  if (loadingUser) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  // Filtrar estudiantes localmente si el filtro nivel es BAJO o TODOS para la tabla
  const estudiantesFiltrados = estudiantes.filter((est) => {
    if (filtroNivel === "TODOS") return true;
    if (filtroNivel === "BAJO") return est.nivel_riesgo === "BAJO";
    if (filtroNivel === "SIN_DATOS") return est.nivel_riesgo === null;
    return est.nivel_riesgo === filtroNivel;
  });

  return (
    <div className="space-y-6 p-2 sm:p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Monitoreo del rendimiento académico
        </h1>
        <p className="text-muted-foreground mt-1">
          Analice las calificaciones, inasistencias y tardanzas para identificar estudiantes que requieren seguimiento.
        </p>
      </div>

      {/* Panel de Filtros */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Criterios de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Curso */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Curso / Turno
              </label>
              <Select value={filtroCurso} onValueChange={setFiltroCurso} disabled={loadingCursos}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={loadingCursos ? "Cargando..." : "Seleccione Curso"} />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((c) => (
                    <SelectItem key={c.id_curso} value={String(c.id_curso)}>
                      {c.nombre_grado} "{c.paralelo}" - {c.turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Materia */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Materia
              </label>
              <Select
                value={filtroMateria}
                onValueChange={setFiltroMateria}
                disabled={!filtroCurso || loadingMaterias}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue
                    placeholder={
                      loadingMaterias
                        ? "Cargando..."
                        : filtroCurso
                        ? "Seleccione Materia"
                        : "Seleccione Curso primero"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {materias.map((m) => (
                    <SelectItem key={m.id_materia} value={String(m.id_materia)}>
                      {m.nombre_materia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trimestre */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Trimestre
              </label>
              <Select value={filtroTrimestre} onValueChange={setFiltroTrimestre}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Seleccione Trimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Primer Trimestre</SelectItem>
                  <SelectItem value="2">Segundo Trimestre</SelectItem>
                  <SelectItem value="3">Tercer Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nivel de Riesgo Opcional */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Nivel de Riesgo
              </label>
              <Select value={filtroNivel} onValueChange={setFiltroNivel}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Seleccione Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estudiantes</SelectItem>
                  <SelectItem value="BAJO">Bajo</SelectItem>
                  <SelectItem value="MEDIO">Medio</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                  <SelectItem value="CRITICO">Crítico</SelectItem>
                  <SelectItem value="SIN_DATOS">Sin datos suficientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={analizarRiesgo}
              disabled={!filtroCurso || !filtroMateria || !filtroTrimestre || cargando}
              className="gap-2"
            >
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Analizar riesgo
                </>
              )}
            </Button>
            <Button onClick={limpiarFiltros} variant="outline" disabled={cargando}>
              Limpiar filtros
            </Button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error al procesar solicitud</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados del Análisis */}
      {analisisRealizado && (
        <div className="space-y-6 animate-fade-in">
          {/* Tarjetas de Resumen */}
          {resumen && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="border border-slate-100 shadow-sm bg-slate-50/50">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-slate-800">
                    {resumen.total_estudiantes}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wider mt-1">
                    Total alumnos
                  </span>
                </CardContent>
              </Card>

              <Card className="border border-rose-100 bg-rose-50/20 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-rose-700">
                    {resumen.total_en_riesgo}
                  </span>
                  <span className="text-xs font-semibold text-rose-600 text-center uppercase tracking-wider mt-1">
                    En Riesgo
                  </span>
                </CardContent>
              </Card>

              <Card className="border border-amber-100 bg-amber-50/20 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-amber-700">
                    {resumen.medio}
                  </span>
                  <span className="text-xs font-semibold text-amber-600 text-center uppercase tracking-wider mt-1">
                    Riesgo Medio
                  </span>
                </CardContent>
              </Card>

              <Card className="border border-orange-100 bg-orange-50/20 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-orange-700">
                    {resumen.alto}
                  </span>
                  <span className="text-xs font-semibold text-orange-600 text-center uppercase tracking-wider mt-1">
                    Riesgo Alto
                  </span>
                </CardContent>
              </Card>

              <Card className="border border-red-200 bg-red-50/20 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-red-600">
                    {resumen.critico}
                  </span>
                  <span className="text-xs font-semibold text-red-600 text-center uppercase tracking-wider mt-1">
                    Riesgo Crítico
                  </span>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 bg-slate-50/20 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-center items-center">
                  <span className="text-2xl font-bold text-slate-600">
                    {resumen.sin_datos}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wider mt-1">
                    Sin Datos
                  </span>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabla de Estudiantes */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
              <CardTitle className="text-lg font-semibold text-slate-800">
                Alumnos Identificados {filtroNivel !== "TODOS" && `(Filtrado por: ${filtroNivel})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {estudiantesFiltrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col justify-center items-center gap-3">
                  <Info className="h-10 w-10 text-slate-400" />
                  <p className="text-sm font-medium">
                    No existen estudiantes en riesgo para los criterios seleccionados.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead className="text-center">Promedio</TableHead>
                        <TableHead className="text-center">Inasistencias</TableHead>
                        <TableHead className="text-center">Tardanzas</TableHead>
                        <TableHead>Nivel de Riesgo</TableHead>
                        <TableHead>Causa Principal</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estudiantesFiltrados.map((est) => (
                        <TableRow key={est.id_estudiante} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-800">
                            {est.nombre_completo}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {est.promedio !== null ? est.promedio : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={est.inasistencias >= 3 ? "text-red-600 font-bold" : "text-slate-700"}>
                              {est.inasistencias}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={est.tardanzas >= 4 ? "text-amber-600 font-bold" : "text-slate-700"}>
                              {est.tardanzas}
                            </span>
                          </TableCell>
                          <TableCell>{getBadgeRiesgo(est.nivel_riesgo)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium italic max-w-[200px] truncate">
                            {est.causa_principal || "Sin alertas registradas"}
                          </TableCell>
                          <TableCell className="text-right flex justify-end gap-2.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEstudianteSeleccionado(est);
                                setIsDetailOpen(true);
                              }}
                              className="h-8 gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Detalle</span>
                            </Button>
                            
                            {est.nivel_riesgo && est.nivel_riesgo !== "BAJO" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generarRecomendacion(est)}
                                  disabled={loadingRecomendacion}
                                  className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                                >
                                  {loadingRecomendacion && estudianteSeleccionado?.id_estudiante === est.id_estudiante ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                  )}
                                  <span className="hidden sm:inline">Recomendar</span>
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => abrirModalNotificacion(est)}
                                  className="h-8 gap-1.5"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Notificar</span>
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal 1: Detalle Completo del Riesgo */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl">
          {estudianteSeleccionado && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>Detalle de Rendimiento y Riesgo</span>
                  {getBadgeRiesgo(estudianteSeleccionado.nivel_riesgo)}
                </DialogTitle>
                <DialogDescription>
                  Hoja de seguimiento académico consolidada del alumno.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Estudiante</span>
                    <span className="font-semibold text-slate-800">{estudianteSeleccionado.nombre_completo}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Documento Identidad (C.I.)</span>
                    <span className="font-medium text-slate-800">{estudianteSeleccionado.ci || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Curso</span>
                    <span className="font-medium text-slate-800">{contexto?.curso}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Materia</span>
                    <span className="font-medium text-slate-800">{contexto?.materia}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Métricas del Trimestre</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border border-slate-100 rounded p-3 text-center bg-white shadow-2xs">
                      <span className="text-xs text-slate-400 block">Promedio</span>
                      <span className="text-lg font-bold text-slate-800">
                        {estudianteSeleccionado.promedio !== null ? estudianteSeleccionado.promedio : "-"}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({estudianteSeleccionado.total_calificaciones} notas)
                      </span>
                    </div>
                    <div className="border border-slate-100 rounded p-3 text-center bg-white shadow-2xs">
                      <span className="text-xs text-slate-400 block">Inasistencias</span>
                      <span className="text-lg font-bold text-red-600">
                        {estudianteSeleccionado.inasistencias}
                      </span>
                      <span className="text-[10px] text-slate-400 block">no justificadas</span>
                    </div>
                    <div className="border border-slate-100 rounded p-3 text-center bg-white shadow-2xs">
                      <span className="text-xs text-slate-400 block">Tardanzas</span>
                      <span className="text-lg font-bold text-amber-600">
                        {estudianteSeleccionado.tardanzas}
                      </span>
                      <span className="text-[10px] text-slate-400 block">registros</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 p-3 rounded border border-slate-100">
                  <div>
                    <span className="text-slate-500">Inasistencias Justificadas: </span>
                    <span className="font-semibold text-slate-700">{estudianteSeleccionado.justificadas}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Licencias Médicas: </span>
                    <span className="font-semibold text-slate-700">{estudianteSeleccionado.licencias}</span>
                  </div>
                </div>

                {estudianteSeleccionado.causas.length > 0 && (
                  <div className="space-y-1.5 p-3.5 bg-rose-50/50 rounded-lg border border-rose-100">
                    <span className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      Causas de Alerta Identificadas
                    </span>
                    <ul className="text-xs text-rose-800 space-y-1 pl-5 list-disc font-medium">
                      {estudianteSeleccionado.causas.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cerrar</Button>
                </DialogClose>
                {estudianteSeleccionado.nivel_riesgo && estudianteSeleccionado.nivel_riesgo !== "BAJO" && (
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      generarRecomendacion(estudianteSeleccionado);
                    }}
                  >
                    Generar recomendaciones
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 2: Recomendaciones */}
      <Dialog open={isRecOpen} onOpenChange={setIsRecOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl">
          {estudianteSeleccionado && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Recomendaciones de Acompañamiento
                </DialogTitle>
                <DialogDescription>
                  Medidas sugeridas para {estudianteSeleccionado.nombre_completo} (Riesgo: {estudianteSeleccionado.nivel_riesgo})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Recomendaciones Académicas
                  </span>
                  {recomendaciones.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No se requieren recomendaciones críticas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recomendaciones.map((rec, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button
                  onClick={() => {
                    setIsRecOpen(false);
                    abrirModalNotificacion(estudianteSeleccionado);
                  }}
                  className="gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  Proceder a Notificar Tutor
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 3: Notificación */}
      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-xl bg-white rounded-xl">
          {estudianteSeleccionado && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Notificar Alerta al Tutor
                </DialogTitle>
                <DialogDescription>
                  Revise y edite el mensaje antes de enviarlo. El aviso llegará al panel del tutor de forma inmediata.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 max-h-[60vh] overflow-y-auto pr-1">
                {/* Selector de Tutor si existen varios */}
                {tutores.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Seleccionar Tutor Destinatario *
                    </label>
                    <Select value={tutorSeleccionado} onValueChange={handleTutorChange}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Elija un tutor vinculado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tutores.map((t) => (
                          <SelectItem key={t.id_tutor} value={String(t.id_tutor)}>
                            {t.nombre_completo} ({t.parentesco})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {tutores.length === 1 && (
                  <div className="bg-slate-50 p-3.5 rounded border border-slate-100 text-sm">
                    <span className="text-slate-500 font-medium">Tutor Vinculado (Único): </span>
                    <span className="font-bold text-slate-800">
                      {tutores[0].nombre_completo} ({tutores[0].parentesco})
                    </span>
                  </div>
                )}

                {/* Asunto */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Asunto</label>
                  <Input
                    value={`Alerta Académica - Trimestre ${filtroTrimestre} - ${estudianteSeleccionado.nombre_completo}`}
                    disabled
                    className="bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Cuerpo del Mensaje */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mensaje</label>
                  <Textarea
                    value={mensajeNotif}
                    onChange={(e) => setMensajeNotif(e.target.value)}
                    rows={12}
                    className="bg-white border-slate-200 font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={enviandoNotif}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  onClick={enviarNotificacion}
                  disabled={enviandoNotif || (tutores.length > 1 && !tutorSeleccionado)}
                  className="gap-1.5"
                >
                  {enviandoNotif ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar alerta
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
