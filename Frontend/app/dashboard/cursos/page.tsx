"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Search,
  BookOpen,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  Layers,
  AlertCircle,
} from "lucide-react";
import {
  cursosApi,
  materiaAsigApi,
  type CursoDetalle,
  type FormularioCurso,
  type MateriaAsignada,
  type CampoMaterias,
  type Profesor,
} from "@/lib/ciclo2Api";

const TURNOS = ["Mañana", "Tarde"];
const emptyForm = {
  id_gestion: 0,
  id_grado: 0,
  paralelo: "",
  turno: "",
  id_aula: 0,
  id_profesor: 0,
  nombre_aula: "",
};
type CursoFieldKey =
  | "id_gestion"
  | "id_grado"
  | "paralelo"
  | "turno"
  | "id_aula"
  | "id_profesor";

const cursoFieldLabels: Record<CursoFieldKey, string> = {
  id_gestion: "Gestión",
  id_grado: "Grado",
  paralelo: "Paralelo",
  turno: "Turno",
  id_aula: "Aula",
  id_profesor: "Profesor Titular",
};

export default function CursosPage() {
  const [cursos, setCursos] = useState<CursoDetalle[]>([]);
  const [formulario, setFormulario] = useState<FormularioCurso | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CursoFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  // Materias dialog
  const [showMaterias, setShowMaterias] = useState(false);
  const [cursoSeleccionado, setCursoSeleccionado] =
    useState<CursoDetalle | null>(null);
  const [materiasAsignadas, setMateriasAsignadas] = useState<MateriaAsignada[]>(
    [],
  );
  const [materiasPorCampo, setMateriasPorCampo] = useState<CampoMaterias[]>([]);
  const [catalogoProfesores, setCatalogoProfesores] = useState<Profesor[]>([]);
  const [profesorTitularId, setProfesorTitularId] = useState<number>(0);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [seleccion, setSeleccion] = useState<{ [id_materia: number]: number }>(
    {},
  ); // materia→profesor
  const [guardandoMaterias, setGuardandoMaterias] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cs, fm] = await Promise.all([
        cursosApi.getAll(),
        cursosApi.getFormulario(),
      ]);
      setCursos(cs);
      setFormulario(fm);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setShowDialog(true);
  };

  const openEdit = (c: CursoDetalle) => {
    setEditId(c.id_curso);
    setForm({
      id_gestion: formulario?.gestion_activa?.id_gestion ?? 0,
      id_grado: c.id_grado!,
      paralelo: c.paralelo,
      turno: c.turno,
      id_aula: c.id_aula!,
      id_profesor: c.id_profesor ?? 0,
      nombre_aula: c.nombre_aula!,
    });
    setFieldErrors({});
    setShowDialog(true);
  };

  const clearFieldError = (field: CursoFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateFormField = <K extends keyof typeof form>(
    field: K,
    value: (typeof form)[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field in cursoFieldLabels) {
      clearFieldError(field as CursoFieldKey);
    }
  };

  const getFieldMessage = (field: CursoFieldKey) =>
    `${cursoFieldLabels[field]} es obligatorio.`;

  const validateCursoForm = () => {
    const requiredFields: CursoFieldKey[] = editId
      ? ["turno", "id_aula", "id_profesor"]
      : ["id_gestion", "id_grado", "paralelo", "turno", "id_aula", "id_profesor"];
    const nextErrors: Partial<Record<CursoFieldKey, string>> = {};

    requiredFields.forEach((field) => {
      const value = form[field];
      if (typeof value === "string" ? value.trim() === "" : !value) {
        nextErrors[field] = getFieldMessage(field);
      }
    });

    setFieldErrors(nextErrors);

    const firstError = requiredFields.find((field) => nextErrors[field]);
    if (firstError) {
      toast.error(nextErrors[firstError]);
      return false;
    }

    return true;
  };

  const fieldControlClass = (field: CursoFieldKey) =>
    fieldErrors[field]
      ? "border-destructive focus-visible:ring-destructive/30"
      : undefined;

  const FieldError = ({ field }: { field: CursoFieldKey }) =>
    fieldErrors[field] ? (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        {fieldErrors[field]}
      </p>
    ) : null;

  const handleSave = async () => {
    if (!validateCursoForm()) return;
    setSaving(true);
    try {
      if (editId) {
        const payload: Partial<typeof form> = {};
        if (form.id_aula) payload.id_aula = form.id_aula;
        if (form.turno) payload.turno = form.turno;
        if (form.id_profesor) payload.id_profesor = form.id_profesor;
        await cursosApi.update(editId, payload);
      } else {
        await cursosApi.create(form);
      }
      toast.success(editId ? "Curso actualizado" : "Curso creado");
      setShowDialog(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const r = await cursosApi.duplicar(id);
      toast.success(r.message || "Curso duplicado correctamente");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al duplicar");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este curso?")) return;
    try {
      await cursosApi.delete(id);
      toast.success("Curso desactivado");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al desactivar");
    }
  };

  const handleActivar = async (id: number) => {
    try {
      await cursosApi.activar(id);
      toast.success("Curso activado");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al activar");
    }
  };

  // ── Materias ──
  const openMaterias = async (c: CursoDetalle) => {
    setCursoSeleccionado(c);
    setShowMaterias(true);
    setLoadingMaterias(true);
    setSeleccion({});
    try {
      const data = await materiaAsigApi.getMaterias(c.id_curso);
      setMateriasAsignadas(data.asignadas ?? data.materias_asignadas ?? []);
      setMateriasPorCampo(data.materias_disponibles_agrupadas ?? []);
      setCatalogoProfesores(data.catalogo_profesores ?? []);
      setProfesorTitularId(data.curso?.profesor_titular?.id_profesor ?? 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al cargar materias");
    } finally {
      setLoadingMaterias(false);
    }
  };

  const handleCargarPlantilla = async () => {
    if (!cursoSeleccionado) return;
    setGuardandoMaterias(true);
    try {
      const r = await materiaAsigApi.cargarPlantilla(
        cursoSeleccionado.id_curso,
      );
      toast.success(r.message);
      await openMaterias(cursoSeleccionado);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardandoMaterias(false);
    }
  };

  const handleAsignarSeleccionadas = async () => {
    if (!cursoSeleccionado || Object.keys(seleccion).length === 0) {
      return toast.error("Seleccione al menos una materia y su profesor");
    }
    setGuardandoMaterias(true);
    try {
      const materias = Object.entries(seleccion).map(
        ([id_materia, id_profesor]) => ({
          id_materia: Number(id_materia),
          id_profesor,
        }),
      );
      const r = await materiaAsigApi.asignar(cursoSeleccionado.id_curso, {
        materias,
      });
      toast.success(r.message);
      setSeleccion({});
      await openMaterias(cursoSeleccionado);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setGuardandoMaterias(false);
    }
  };

  const handleEliminarMateria = async (id_curso_materia: number) => {
    if (!confirm("¿Quitar esta materia del curso?")) return;
    try {
      await materiaAsigApi.eliminar(id_curso_materia);
      toast.success("Materia eliminada");
      if (cursoSeleccionado) await openMaterias(cursoSeleccionado);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleCambiarProfesor = async (
    id_curso_materia: number,
    id_profesor: number,
  ) => {
    try {
      await materiaAsigApi.actualizarProfesor(id_curso_materia, id_profesor);
      toast.success("Profesor actualizado");
      if (cursoSeleccionado) await openMaterias(cursoSeleccionado);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const gestActiva = formulario?.gestion_activa;
  const filtered = cursos.filter((c) =>
    `${c.nombre_nivel} ${c.nombre_grado} ${c.paralelo}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
          <p className="text-muted-foreground">
            Gestión {gestActiva?.anio ?? "—"}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Curso
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total", cursos.length, ""],
          [
            "Turno Mañana",
            cursos.filter((c) => c.turno === "Mañana").length,
            "text-blue-600",
          ],
          [
            "Turno Tarde",
            cursos.filter((c) => c.turno === "Tarde").length,
            "text-orange-500",
          ],
        ].map(([l, v, cls]) => (
          <Card key={String(l)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{l}</p>
              <p className={`text-3xl font-bold ${cls}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Cursos</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 w-60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Par.</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Profesor</TableHead>
                    <TableHead>Aula</TableHead>
                    <TableHead>Est./Cap.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Sin cursos
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id_curso}>
                        <TableCell>
                          <Badge variant="secondary">{c.nombre_nivel}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {c.nombre_grado}
                        </TableCell>
                        <TableCell>{c.paralelo}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              c.turno === "Mañana"
                                ? "text-blue-600"
                                : "text-orange-500"
                            }
                          >
                            {c.turno}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.profesor_titular ?? c.profesor_nombre ?? "—"}
                        </TableCell>
                        <TableCell> {c.numero_aula} </TableCell>
                        <TableCell className="text-sm">
                          {c.total_estudiantes ?? 0}/
                          {c.capacidad_estudiantes ?? "—"}
                        </TableCell>
                        <TableCell>
                          {(c as unknown as { curso_estado?: boolean })
                            .curso_estado !== false ? (
                            <Badge
                              variant="default"
                              className="bg-green-500/20 text-green-700 border-green-300"
                            >
                              Activo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openMaterias(c)}>
                                <BookOpen className="h-4 w-4 mr-2" />
                                Materias
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(c)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(c.id_curso)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              {(c as unknown as { curso_estado?: boolean })
                                .curso_estado === false ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivar(c.id_curso)}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(c.id_curso)}
                                  className="text-destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Desactivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar Curso */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setFieldErrors({});
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editId && (
              <>
                <div className="space-y-1">
                  <Label>Gestión</Label>
                  <Select
                    value={form.id_gestion ? String(form.id_gestion) : ""}
                    onValueChange={(v) =>
                      updateFormField("id_gestion", +v)
                    }
                  >
                    <SelectTrigger className={fieldControlClass("id_gestion")}>
                      <SelectValue placeholder="Seleccionar gestión" />
                    </SelectTrigger>
                    <SelectContent>
                      {formulario?.gestion_activa ? (
                        <SelectItem
                          value={String(formulario.gestion_activa.id_gestion)}
                        >
                          {formulario.gestion_activa.anio} ✓ Activa
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <FieldError field="id_gestion" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Grado</Label>
                    <Select
                      value={form.id_grado ? String(form.id_grado) : ""}
                      onValueChange={(v) =>
                        updateFormField("id_grado", +v)
                      }
                    >
                      <SelectTrigger className={fieldControlClass("id_grado")}>
                        <SelectValue placeholder="Grado" />
                      </SelectTrigger>
                      <SelectContent>
                        {formulario?.grados.map((g) => (
                          <SelectItem
                            key={g.id_grado}
                            value={String(g.id_grado)}
                          >
                            {g.nombre_grado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError field="id_grado" />
                  </div>
                  <div className="space-y-1">
                    <Label>Paralelo</Label>
                    <Input
                      placeholder="A, B..."
                      value={form.paralelo}
                      onChange={(e) =>
                        updateFormField("paralelo", e.target.value.toUpperCase())
                      }
                      className={fieldControlClass("paralelo")}
                      aria-invalid={Boolean(fieldErrors.paralelo)}
                      maxLength={3}
                    />
                    <FieldError field="paralelo" />
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Turno</Label>
                <Select
                  value={form.turno}
                  onValueChange={(v) => updateFormField("turno", v)}
                >
                  <SelectTrigger className={fieldControlClass("turno")}>
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError field="turno" />
              </div>
              <div className="space-y-1">
                <Label>Aula</Label>
                <Select
                  value={form.id_aula ? String(form.id_aula) : ""}
                  onValueChange={(v) => updateFormField("id_aula", +v)}
                >
                  <SelectTrigger className={fieldControlClass("id_aula")}>
                    <SelectValue placeholder="Aula" />
                  </SelectTrigger>
                  <SelectContent>
                    {formulario?.aulas.map((a) => (
                      <SelectItem key={a.id_aula} value={String(a.id_aula)}>
                        {a.numero_aula} ({a.capacidad_estudiantes}){" "}
                        {a.estado === "ocupado" ? "🔴" : "🟢"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError field="id_aula" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Profesor Titular</Label>
              <Select
                value={form.id_profesor ? String(form.id_profesor) : ""}
                onValueChange={(v) =>
                  updateFormField("id_profesor", +v)
                }
              >
                <SelectTrigger className={fieldControlClass("id_profesor")}>
                  <SelectValue placeholder="Seleccionar profesor" />
                </SelectTrigger>
                <SelectContent>
                  {formulario?.profesores.map((p) => (
                    <SelectItem
                      key={p.id_profesor}
                      value={String(p.id_profesor)}
                    >
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError field="id_profesor" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Materias */}
      <Dialog open={showMaterias} onOpenChange={setShowMaterias}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Materias — {cursoSeleccionado?.nombre_grado}{" "}
              {cursoSeleccionado?.paralelo}
            </DialogTitle>
          </DialogHeader>

          {loadingMaterias ? (
            <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando materias...
            </div>
          ) : (
            <Tabs defaultValue="asignadas">
              <TabsList className="w-full">
                <TabsTrigger value="asignadas" className="flex-1">
                  Asignadas ({materiasAsignadas.length})
                </TabsTrigger>
                <TabsTrigger value="disponibles" className="flex-1">
                  Agregar Materias
                </TabsTrigger>
              </TabsList>

              {/* TAB: Materias asignadas */}
              <TabsContent value="asignadas" className="space-y-2 mt-4">
                {materiasAsignadas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay materias asignadas aún.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Materia</TableHead>
                          <TableHead>Profesor</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materiasAsignadas.map((m) => (
                          <TableRow key={m.id_curso_materia}>
                            <TableCell className="font-medium">
                              {m.nombre_materia}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={String(m.id_profesor)}
                                onValueChange={(v) =>
                                  handleCambiarProfesor(m.id_curso_materia, +v)
                                }
                              >
                                <SelectTrigger className="h-8 w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {catalogoProfesores.map((p) => (
                                    <SelectItem
                                      key={p.id_profesor}
                                      value={String(p.id_profesor)}
                                    >
                                      {p.nombre} {p.apellido}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-8 w-8"
                                onClick={() =>
                                  handleEliminarMateria(m.id_curso_materia)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* TAB: Agregar materias */}
              <TabsContent value="disponibles" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCargarPlantilla}
                    disabled={guardandoMaterias}
                  >
                    {guardandoMaterias ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Cargar plantilla completa
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAsignarSeleccionadas}
                    disabled={
                      guardandoMaterias || Object.keys(seleccion).length === 0
                    }
                  >
                    {guardandoMaterias ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Asignar seleccionadas ({Object.keys(seleccion).length})
                  </Button>
                </div>

                {materiasPorCampo.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Todas las materias ya están asignadas.
                  </p>
                ) : (
                  materiasPorCampo.map((campo) => (
                    <div key={campo.id_campo} className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {campo.nombre_campo}
                      </h4>
                      <div className="space-y-1 pl-2">
                        {campo.materias.map((m) => {
                          const selected =
                            seleccion[m.id_materia] !== undefined;
                          return (
                            <div
                              key={m.id_materia}
                              className={`flex items-center gap-3 rounded-md p-2 border transition-colors ${selected ? "bg-primary/5 border-primary/30" : "border-transparent hover:bg-muted/40"}`}
                            >
                              <input
                                type="checkbox"
                                id={`m-${m.id_materia}`}
                                checked={selected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSeleccion((prev) => ({
                                      ...prev,
                                      [m.id_materia]:
                                        profesorTitularId ||
                                        (catalogoProfesores[0]?.id_profesor ??
                                          0),
                                    }));
                                  } else {
                                    setSeleccion((prev) => {
                                      const n = { ...prev };
                                      delete n[m.id_materia];
                                      return n;
                                    });
                                  }
                                }}
                                className="h-4 w-4 accent-primary"
                              />
                              <label
                                htmlFor={`m-${m.id_materia}`}
                                className="flex-1 text-sm cursor-pointer"
                              >
                                {m.nombre_materia}
                              </label>
                              {selected && (
                                <Select
                                  value={String(seleccion[m.id_materia])}
                                  onValueChange={(v) =>
                                    setSeleccion((prev) => ({
                                      ...prev,
                                      [m.id_materia]: +v,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-7 w-44">
                                    <SelectValue placeholder="Profesor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {catalogoProfesores.map((p) => (
                                      <SelectItem
                                        key={p.id_profesor}
                                        value={String(p.id_profesor)}
                                      >
                                        <User className="h-3 w-3 mr-1 inline" />
                                        {p.nombre} {p.apellido}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaterias(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
