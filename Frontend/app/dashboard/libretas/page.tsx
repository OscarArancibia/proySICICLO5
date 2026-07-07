"use client";

import { useState, useEffect } from "react";
import {
  libretasApi,
  LibretaListItem,
  LibretaDetailResponse,
  LibretaDetalleItem,
} from "@/lib/apiLibreta";
import {
  cursosApi,
  estructuraApi,
  inscripcionesApi,
  CursoDetalle,
  Gestion,
  Inscripcion,
} from "@/lib/ciclo2Api";
import { API_URL } from "@/lib/api";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Download,
  CheckCircle,
  AlertTriangle,
  FileText,
  Search,
  Send,
  Check,
  Eye,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function LibretasPage() {
  // Session details
  const [userRole, setUserRole] = useState<number | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Filter options
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [cursos, setCursos] = useState<CursoDetalle[]>([]);
  const [estudiantes, setEstudiantes] = useState<Inscripcion[]>([]);

  // Generation state
  const [genGestion, setGenGestion] = useState<string>("");
  const [genTrimestre, setGenTrimestre] = useState<string>("");
  const [genCurso, setGenCurso] = useState<string>("");
  const [genEstudiante, setGenEstudiante] = useState<string>("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valido: boolean;
    message: string;
    pendientes?: any[];
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Lists state
  const [activeTab, setActiveTab] = useState<string>("consulta");
  const [libretas, setLibretas] = useState<LibretaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listFilters, setListFilters] = useState({
    id_gestion: "",
    trimestre: "",
    id_curso: "",
    estado: "",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Review & Approval & Details states
  const [selectedLibreta, setSelectedLibreta] =
    useState<LibretaDetailResponse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRemitModalOpen, setIsRemitModalOpen] = useState(false);
  const [observacionProfesor, setObservacionProfesor] = useState("");
  const [remitting, setRemitting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Fetch session role
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      if (role) setUserRole(parseInt(role, 10));
      setLoadingUser(false);
    }
  }, []);

  // Fetch initial filter data
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [gestList, cursList] = await Promise.all([
          estructuraApi.getGestiones(),
          cursosApi.getAll(),
        ]);
        setGestiones(gestList);
        setCursos(cursList);
      } catch (error) {
        console.error("Error loading filters:", error);
      }
    }
    if (userRole !== null) {
      loadInitialData();
    }
  }, [userRole]);

  // Set default tab based on role
  useEffect(() => {
    if (userRole === 3) {
      setActiveTab("revision");
    } else if (userRole === 1 || userRole === 2) {
      setActiveTab("generar");
    } else {
      setActiveTab("consulta");
    }
  }, [userRole]);

  // Chained fetch of students for generator
  useEffect(() => {
    async function loadStudents() {
      if (genGestion && genCurso) {
        try {
          const res = await inscripcionesApi.getAll({
            id_gestion: genGestion,
            id_curso: genCurso,
            estado: "inscrito",
          });
          setEstudiantes(res.inscripciones || []);
          setGenEstudiante("");
          setValidationResult(null);
        } catch (error) {
          console.error("Error loading students:", error);
        }
      } else {
        setEstudiantes([]);
        setGenEstudiante("");
      }
    }
    loadStudents();
  }, [genGestion, genCurso]);

  // Fetch list of libretas based on filters, tab, and page
  const fetchLibretas = async () => {
    setLoadingList(true);
    try {
      let queryEstado = listFilters.estado;
      if (activeTab === "revision") {
        queryEstado = "PENDIENTE_REVISION";
      } else if (activeTab === "aprobacion") {
        queryEstado = "PENDIENTE_APROBACION";
      }

      const res = await libretasApi.listarLibretas({
        id_gestion: listFilters.id_gestion,
        trimestre: listFilters.trimestre,
        id_curso: listFilters.id_curso,
        estado: queryEstado,
        page,
        limit: 10,
      });
      setLibretas(res.data || []);
      setTotalPages(res.pages || 1);
    } catch (error) {
      console.error("Error listing libretas:", error);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (userRole !== null) {
      fetchLibretas();
    }
  }, [activeTab, listFilters, page, userRole]);

  // Reset page when filters change
  const handleFilterChange = (key: string, value: string) => {
    setListFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Validate qualifications
  const handleValidate = async () => {
    if (!genEstudiante || !genCurso || !genGestion || !genTrimestre) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await libretasApi.validarCalificaciones({
        id_estudiante: Number(genEstudiante),
        id_curso: Number(genCurso),
        id_gestion: Number(genGestion),
        trimestre: Number(genTrimestre),
      });
      setValidationResult({
        valido: res.valido,
        message: res.message,
        pendientes: res.pendientes,
      });
    } catch (error: any) {
      setValidationResult({
        valido: false,
        message: error.message || "Error al validar calificaciones.",
      });
    } finally {
      setValidating(false);
    }
  };

  // Generate Report Card
  const handleGenerate = async () => {
    if (!genEstudiante || !genCurso || !genGestion || !genTrimestre) return;
    setGenerating(true);
    try {
      const res = await libretasApi.generarLibreta({
        id_estudiante: Number(genEstudiante),
        id_curso: Number(genCurso),
        id_gestion: Number(genGestion),
        trimestre: Number(genTrimestre),
      });
      alert(res.message || "Libreta generada correctamente.");
      setValidationResult(null);
      setGenEstudiante("");
      // Refresh consultation list
      fetchLibretas();
    } catch (error: any) {
      alert(error.message || "No fue posible generar la libreta.");
    } finally {
      setGenerating(false);
    }
  };

  // Open detail preview modal
  const handleViewDetail = async (id: number) => {
    try {
      const res = await libretasApi.obtenerLibretaPorId(id);
      setSelectedLibreta(res);
      setIsDetailOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error al cargar el detalle de la libreta.");
    }
  };

  // Remit Report Card to approval
  const handleRemit = async () => {
    if (!selectedLibreta) return;
    setRemitting(true);
    try {
      await libretasApi.remitirLibreta(
        selectedLibreta.cabecera.id_libreta,
        observacionProfesor,
      );
      alert("Libreta remitida al Director exitosamente.");
      setIsRemitModalOpen(false);
      setIsDetailOpen(false);
      setObservacionProfesor("");
      fetchLibretas();
    } catch (error: any) {
      alert(error.message || "Error al remitir la libreta.");
    } finally {
      setRemitting(false);
    }
  };

  // Approve Report Card
  const handleApprove = async () => {
    if (!selectedLibreta) return;
    setApproving(true);
    try {
      await libretasApi.aprobarLibreta(selectedLibreta.cabecera.id_libreta);
      alert("Libreta aprobada de forma definitiva.");
      setIsDetailOpen(false);
      fetchLibretas();
    } catch (error: any) {
      alert(error.message || "Error al aprobar la libreta.");
    } finally {
      setApproving(false);
    }
  };

  // Download PDF file
  const handleDownloadPdf = async (id: number, estName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/libretas/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `libreta_${estName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("No se pudo descargar el boletín en formato PDF.");
    }
  };

  // Download CSV file
  const handleDownloadCsv = async (id: number, estName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/libretas/${id}/csv`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Error al generar CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `libreta_${estName.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("No se pudo descargar el boletín en formato CSV.");
    }
  };

  // Download Word file
  const handleDownloadWord = async (id: number, estName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/libretas/${id}/word`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Error al generar Word");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `libreta_${estName.replace(/\s+/g, "_")}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("No se pudo descargar el boletín en formato Word.");
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE_REVISION":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            Pendiente Revisión
          </Badge>
        );
      case "PENDIENTE_APROBACION":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            Pendiente Aprobación
          </Badge>
        );
      case "APROBADA":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Aprobada
          </Badge>
        );
      case "entregada":
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300">
            Entregada
          </Badge>
        );
      case "borrador":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
            Borrador
          </Badge>
        );
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  if (loadingUser) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Libretas</h1>
        <p className="text-muted-foreground">
          Genera, verifica calificaciones, revisa y aprueba libretas
          trimestrales de estudiantes.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-muted p-1 rounded-lg">
          {(userRole === 1 || userRole === 2) && (
            <TabsTrigger value="generar" className="rounded-md">
              Generar Libreta
            </TabsTrigger>
          )}
          {(userRole === 1 || userRole === 3) && (
            <TabsTrigger value="revision" className="rounded-md">
              Revisión del Profesor
            </TabsTrigger>
          )}
          {(userRole === 1 || userRole === 2) && (
            <TabsTrigger value="aprobacion" className="rounded-md">
              Aprobación del Director
            </TabsTrigger>
          )}
          <TabsTrigger value="consulta" className="rounded-md">
            Consulta de Libretas
          </TabsTrigger>
        </TabsList>

        {/* pestaña: Generar Libreta */}
        {(userRole === 1 || userRole === 2) && (
          <TabsContent value="generar" className="space-y-4">
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Generación de Libreta Trimestral</CardTitle>
                <CardDescription>
                  Selecciona los parámetros del estudiante para verificar el
                  estado de calificaciones y consolidar las notas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Gestión Académica
                    </label>
                    <Select
                      value={genGestion}
                      onValueChange={(val) => {
                        setGenGestion(val);
                        setGenCurso(""); // resetear curso al cambiar de gestión
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione Gestión" />
                      </SelectTrigger>
                      <SelectContent>
                        {gestiones.map((g) => (
                          <SelectItem
                            key={g.id_gestion}
                            value={String(g.id_gestion)}
                          >
                            {g.anio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Trimestre
                    </label>
                    <Select
                      value={genTrimestre}
                      onValueChange={setGenTrimestre}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione Trimestre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Primer Trimestre</SelectItem>
                        <SelectItem value="2">Segundo Trimestre</SelectItem>
                        <SelectItem value="3">Tercer Trimestre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Curso / Turno
                    </label>
                    <Select value={genCurso} onValueChange={setGenCurso}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione Curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {cursos
                          .filter((c) => String(c.id_gestion) === genGestion)
                          .map((c) => (
                            <SelectItem
                              key={c.id_curso}
                              value={String(c.id_curso)}
                            >
                              {c.nombre_grado} "{c.paralelo}" - {c.turno}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Estudiante
                    </label>
                    <Select
                      value={genEstudiante}
                      onValueChange={setGenEstudiante}
                      disabled={!genCurso || !genGestion}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            genCurso && genGestion
                              ? "Seleccione Estudiante"
                              : "Primero elija Curso"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {estudiantes.map((e) => (
                          <SelectItem
                            key={e.id_estudiante}
                            value={String(e.id_estudiante)}
                          >
                            {e.estudiante}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleValidate}
                    disabled={!genEstudiante || !genTrimestre || validating}
                    variant="outline"
                  >
                    {validating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verificar Calificaciones
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={!validationResult?.valido || generating}
                  >
                    {generating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Generar y Consolidar Libreta
                  </Button>
                </div>

                {validationResult && (
                  <div
                    className={`p-4 rounded-lg border ${validationResult.valido ? "bg-green-50 border-green-200 text-green-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-2">
                      {validationResult.valido ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>¡Todo listo para la generación!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                          <span>Calificaciones Incompletas (E1)</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm">{validationResult.message}</p>

                    {validationResult.pendientes &&
                      validationResult.pendientes.length > 0 && (
                        <div className="mt-3 bg-white rounded-md border border-rose-200 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-rose-100">
                              <TableRow>
                                <TableHead className="text-rose-900 font-bold">
                                  Materia
                                </TableHead>
                                <TableHead className="text-rose-900 font-bold">
                                  Dimensión
                                </TableHead>
                                <TableHead className="text-rose-900 font-bold">
                                  Detalle Pendiente
                                </TableHead>
                                <TableHead className="text-rose-900 font-bold">
                                  Motivo
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {validationResult.pendientes.map(
                                (item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-semibold text-slate-800">
                                      {item.materia}
                                    </TableCell>
                                    <TableCell>{item.dimension}</TableCell>
                                    <TableCell className="text-slate-600 italic">
                                      {item.evaluacion_pendiente || "N/A"}
                                    </TableCell>
                                    <TableCell className="text-rose-700 font-semibold">
                                      {item.motivo}
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* pestaña: Revision de Profesor */}
        {(userRole === 1 || userRole === 3) && (
          <TabsContent value="revision" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bandeja de Revisión del Profesor</CardTitle>
                <CardDescription>
                  Libretas generadas en estado pendiente que requieren
                  observaciones pedagógicas y remisión al Director.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingList ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-sidebar-primary" />
                  </div>
                ) : libretas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tienes libretas pendientes de revisión en tus cursos.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Gestión</TableHead>
                          <TableHead className="text-center">
                            Trimestre
                          </TableHead>
                          <TableHead className="text-center">
                            Promedio Gral
                          </TableHead>
                          <TableHead>Fecha Generación</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {libretas.map((lib) => (
                          <TableRow key={lib.id_libreta}>
                            <TableCell className="font-semibold">
                              {lib.est_apellido}, {lib.est_nombre}
                            </TableCell>
                            <TableCell>
                              {lib.nombre_grado} "{lib.curso_paralelo}"
                            </TableCell>
                            <TableCell>{lib.gestion_anio}</TableCell>
                            <TableCell className="text-center font-bold text-primary">
                              {lib.trimestre}º
                            </TableCell>
                            <TableCell className="text-center font-semibold text-green-700">
                              {lib.promedio_general || "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                lib.fecha_generacion,
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-primary text-primary hover:bg-primary hover:text-white"
                                onClick={() => handleViewDetail(lib.id_libreta)}
                              >
                                <Eye className="h-4 w-4" />
                                Revisar libreta
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* pestaña: Aprobacion de Director */}
        {(userRole === 1 || userRole === 2) && (
          <TabsContent value="aprobacion" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bandeja de Aprobación del Director</CardTitle>
                <CardDescription>
                  Libretas remitidas por los docentes de curso listas para la
                  aprobación final del Director y generación de firma digital.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingList ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-sidebar-primary" />
                  </div>
                ) : libretas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No existen libretas pendientes de aprobación en el sistema.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Gestión</TableHead>
                          <TableHead className="text-center">
                            Trimestre
                          </TableHead>
                          <TableHead>Docente Remitente</TableHead>
                          <TableHead>Observaciones Docente</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {libretas.map((lib) => (
                          <TableRow key={lib.id_libreta}>
                            <TableCell className="font-semibold">
                              {lib.est_apellido}, {lib.est_nombre}
                            </TableCell>
                            <TableCell>
                              {lib.nombre_grado} "{lib.curso_paralelo}"
                            </TableCell>
                            <TableCell>{lib.gestion_anio}</TableCell>
                            <TableCell className="text-center font-bold text-primary">
                              {lib.trimestre}º
                            </TableCell>
                            <TableCell className="text-sm">
                              {lib.revisado_por_prof || "Profesor"}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground italic">
                              {lib.observaciones || "Sin observaciones"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                                onClick={() => handleViewDetail(lib.id_libreta)}
                              >
                                <Eye className="h-4 w-4" />
                                Evaluar y Aprobar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* pestaña: Consulta de Libretas */}
        <TabsContent value="consulta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial y Consulta de Libretas</CardTitle>
              <CardDescription>
                Busca y visualiza reportes escolares consolidados y descarga los
                boletines oficiales en PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros de Consulta */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Gestión
                  </label>
                  <Select
                    value={listFilters.id_gestion}
                    onValueChange={(val) =>
                      handleFilterChange("id_gestion", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_gestiones">
                        Todas las gestiones
                      </SelectItem>
                      {gestiones.map((g) => (
                        <SelectItem
                          key={g.id_gestion}
                          value={String(g.id_gestion)}
                        >
                          {g.anio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Trimestre
                  </label>
                  <Select
                    value={listFilters.trimestre}
                    onValueChange={(val) =>
                      handleFilterChange("trimestre", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_trimestres">
                        Todos los trimestres
                      </SelectItem>
                      <SelectItem value="1">1º Trimestre</SelectItem>
                      <SelectItem value="2">2º Trimestre</SelectItem>
                      <SelectItem value="3">3º Trimestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Curso
                  </label>
                  <Select
                    value={listFilters.id_curso}
                    onValueChange={(val) => handleFilterChange("id_curso", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_cursos">
                        Todos los cursos
                      </SelectItem>
                      {cursos.map((c) => (
                        <SelectItem key={c.id_curso} value={String(c.id_curso)}>
                          {c.nombre_grado} "{c.paralelo}"
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Estado
                  </label>
                  <Select
                    value={listFilters.estado}
                    onValueChange={(val) => handleFilterChange("estado", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_estados">
                        Todos los estados
                      </SelectItem>
                      <SelectItem value="PENDIENTE_REVISION">
                        Pendiente de revisión
                      </SelectItem>
                      <SelectItem value="PENDIENTE_APROBACION">
                        Pendiente de aprobación
                      </SelectItem>
                      <SelectItem value="APROBADA">Aprobada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingList ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-sidebar-primary" />
                </div>
              ) : libretas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron libretas registradas con los filtros
                  seleccionados.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead className="text-center">
                            Trimestre
                          </TableHead>
                          <TableHead>Gestión</TableHead>
                          <TableHead className="text-center">
                            Promedio Gral
                          </TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {libretas.map((lib) => (
                          <TableRow key={lib.id_libreta}>
                            <TableCell className="font-semibold text-slate-800">
                              {lib.est_apellido}, {lib.est_nombre}
                            </TableCell>
                            <TableCell>
                              {lib.nombre_grado} "{lib.curso_paralelo}"
                            </TableCell>
                            <TableCell className="text-center font-bold text-primary">
                              {lib.trimestre}º
                            </TableCell>
                            <TableCell>{lib.gestion_anio}</TableCell>
                            <TableCell className="text-center font-semibold text-green-700">
                              {lib.promedio_general || "N/A"}
                            </TableCell>
                            <TableCell>{getStatusBadge(lib.estado)}</TableCell>
                            <TableCell className="text-right flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => handleViewDetail(lib.id_libreta)}
                              >
                                <Eye className="h-4 w-4" />
                                Detalle
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-primary text-primary hover:bg-primary hover:text-white"
                                onClick={() =>
                                  handleDownloadPdf(
                                    lib.id_libreta,
                                    `${lib.est_apellido}_T${lib.trimestre}`,
                                  )
                                }
                              >
                                <Download className="h-4 w-4" />
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                                onClick={() =>
                                  handleDownloadCsv(
                                    lib.id_libreta,
                                    `${lib.est_apellido}_T${lib.trimestre}`,
                                  )
                                }
                              >
                                <Download className="h-4 w-4" />
                                CSV
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                                onClick={() =>
                                  handleDownloadWord(
                                    lib.id_libreta,
                                    `${lib.est_apellido}_T${lib.trimestre}`,
                                  )
                                }
                              >
                                <Download className="h-4 w-4" />
                                Word
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginador */}
                  {totalPages > 1 && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      >
                        Anterior
                      </Button>
                      <span className="self-center text-xs text-muted-foreground">
                        Página {page} de {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() =>
                          setPage((prev) => Math.min(totalPages, prev + 1))
                        }
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Vista Previa y Acciones de la Libreta */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          {selectedLibreta && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary text-center">
                  Boletín Oficial de Calificaciones
                </DialogTitle>
                <DialogDescription className="text-center">
                  Unidad Educativa Fausto Medrano Sandoval "A" — Gestión
                  Académica {selectedLibreta.cabecera.gestion_anio}
                </DialogDescription>
              </DialogHeader>

              {/* Ficha Informativa de Estudiante */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Estudiante
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedLibreta.cabecera.est_apellido},{" "}
                    {selectedLibreta.cabecera.est_nombre}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    R.U.D.E.
                  </span>
                  <span className="font-semibold text-slate-700">
                    {selectedLibreta.cabecera.est_rude || "No Registrado"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Curso / Grado
                  </span>
                  <span className="font-semibold text-slate-700">
                    {selectedLibreta.cabecera.nombre_grado} "
                    {selectedLibreta.cabecera.curso_paralelo}"
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Trimestre actual
                  </span>
                  <span className="font-bold text-primary">
                    {selectedLibreta.cabecera.trimestre}º Trimestre
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    C.I.
                  </span>
                  <span className="font-semibold text-slate-700">
                    {selectedLibreta.cabecera.est_ci || "No Registrado"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Turno
                  </span>
                  <span className="font-semibold text-slate-700">
                    {selectedLibreta.cabecera.curso_turno}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Promedio Trimestre
                  </span>
                  <span className="font-bold text-green-700">
                    {selectedLibreta.cabecera.promedio_general || "0.00"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">
                    Estado Boletín
                  </span>
                  {getStatusBadge(selectedLibreta.cabecera.estado)}
                </div>
              </div>

              {/* Watermark aviso si no es aprobada */}
              {selectedLibreta.cabecera.estado !== "APROBADA" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>
                    Este boletín es un borrador. La versión PDF final oficial
                    solo estará disponible una vez que el Director apruebe el
                    documento.
                  </span>
                </div>
              )}

              {/* Detalle de Notas */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="w-[280px]">
                        Área Curricular (Materia)
                      </TableHead>
                      <TableHead className="text-center w-[70px]">
                        1º Trim
                      </TableHead>
                      <TableHead className="text-center w-[70px]">
                        2º Trim
                      </TableHead>
                      <TableHead className="text-center w-[70px]">
                        3º Trim
                      </TableHead>
                      <TableHead className="text-center w-[90px]">
                        Prom Anual
                      </TableHead>
                      <TableHead className="w-[180px]">
                        Valoración Cualitativa
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLibreta.detalles.map((det) => (
                      <TableRow
                        key={det.id_libreta_detalle}
                        className="hover:bg-slate-50"
                      >
                        <TableCell>
                          <div className="font-semibold text-slate-800">
                            {det.nombre_materia}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {det.nombre_campo}
                          </div>
                          {/* Desglose de dimensiones */}
                          <div className="text-[9px] text-slate-500 font-medium mt-1">
                            Ser:{" "}
                            <span className="font-semibold">
                              {det.nota_ser ?? 0}
                            </span>{" "}
                            | Saber:{" "}
                            <span className="font-semibold">
                              {det.nota_saber ?? 0}
                            </span>{" "}
                            | Hacer:{" "}
                            <span className="font-semibold">
                              {det.nota_hacer ?? 0}
                            </span>{" "}
                            | Auto:{" "}
                            <span className="font-semibold">
                              {det.nota_autoevaluacion ?? 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {det.nota_primer_trimestre ?? "—"}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {det.nota_segundo_trimestre ?? "—"}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {det.nota_tercer_trimestre ?? "—"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {det.promedio_anual ?? "—"}
                        </TableCell>
                        <TableCell className="text-[10px] uppercase font-medium text-slate-600">
                          {det.promedio_literal || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cuadro de Observaciones del Profesor */}
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  Observaciones Docente de Curso:
                </h4>
                <p className="p-3 bg-slate-50 border rounded-md text-xs text-slate-700 italic">
                  {selectedLibreta.cabecera.observaciones ||
                    "Sin observaciones ingresadas por el docente."}
                </p>
              </div>

              {/* Firmantes e Historial */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground p-3 border-t">
                <div>
                  <p>
                    <strong>Revisado por Docente:</strong>{" "}
                    {selectedLibreta.cabecera.revisado_por_prof ||
                      "No remitido aún"}
                  </p>
                  <p>
                    <strong>Fecha de Remisión:</strong>{" "}
                    {selectedLibreta.cabecera.fecha_remision
                      ? new Date(
                          selectedLibreta.cabecera.fecha_remision,
                        ).toLocaleString()
                      : "Pendiente"}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Aprobado por Dirección:</strong>{" "}
                    {selectedLibreta.cabecera.aprobado_por_dir ||
                      "No aprobado aún"}
                  </p>
                  <p>
                    <strong>Fecha de Aprobación:</strong>{" "}
                    {selectedLibreta.cabecera.fecha_aprobacion
                      ? new Date(
                          selectedLibreta.cabecera.fecha_aprobacion,
                        ).toLocaleString()
                      : "Pendiente"}
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cerrar vista previa</Button>
                </DialogClose>

                {/* Acciones de Profesor: Remitir */}
                {activeTab === "revision" &&
                  selectedLibreta.cabecera.estado === "PENDIENTE_REVISION" && (
                    <Button
                      className="gap-1"
                      onClick={() => setIsRemitModalOpen(true)}
                    >
                      <Send className="h-4 w-4" />
                      Ingresar Observaciones y Remitir
                    </Button>
                  )}

                {/* Acciones de Director: Aprobar */}
                {activeTab === "aprobacion" &&
                  selectedLibreta.cabecera.estado ===
                    "PENDIENTE_APROBACION" && (
                    <Button
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleApprove}
                      disabled={approving}
                    >
                      {approving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Aprobar Boletín Oficial
                    </Button>
                  )}

                {/* Exportar PDF si está aprobada */}
                {selectedLibreta.cabecera.estado === "APROBADA" && (
                  <>
                    <Button
                      className="gap-1 border-primary text-primary hover:bg-primary hover:text-white"
                      variant="outline"
                      onClick={() =>
                        handleDownloadPdf(
                          selectedLibreta.cabecera.id_libreta,
                          `${selectedLibreta.cabecera.est_apellido}_T${selectedLibreta.cabecera.trimestre}`,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      className="gap-1 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                      variant="outline"
                      onClick={() =>
                        handleDownloadCsv(
                          selectedLibreta.cabecera.id_libreta,
                          `${selectedLibreta.cabecera.est_apellido}_T${selectedLibreta.cabecera.trimestre}`,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      className="gap-1 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                      variant="outline"
                      onClick={() =>
                        handleDownloadWord(
                          selectedLibreta.cabecera.id_libreta,
                          `${selectedLibreta.cabecera.est_apellido}_T${selectedLibreta.cabecera.trimestre}`,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Word
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL SECUNDARIO: Remitir libreta con Observaciones */}
      <Dialog open={isRemitModalOpen} onOpenChange={setIsRemitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remitir Libreta al Director</DialogTitle>
            <DialogDescription>
              Por favor, agrega observaciones o recomendaciones pedagógicas
              sobre el desempeño del estudiante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">
                Observaciones del Profesor:
              </label>
              <Textarea
                value={observacionProfesor}
                onChange={(e) => setObservacionProfesor(e.target.value)}
                placeholder="Ej. El estudiante demuestra excelente aptitud en las ciencias, se recomienda continuar con el apoyo pedagógico familiar..."
                className="h-28"
                maxLength={250}
              />
              <span className="text-[10px] text-muted-foreground block text-right">
                {observacionProfesor.length}/250 caracteres
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRemitModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleRemit} disabled={remitting}>
              {remitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar al Director
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
