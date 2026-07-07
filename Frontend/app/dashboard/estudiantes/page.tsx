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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  UserCheck,
  Download,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PASSWORD_HINT, validatePasswordStrength } from "@/lib/password-policy";
import {
  estudiantesApi,
  type Estudiante,
  type EstudiantePayload,
} from "@/lib/ciclo2Api";
import { adminEstudianteApi } from "@/lib/apiEstudiante";
import { useRouter } from "next/navigation";

const GENEROS = ["Masculino", "Femenino"];
const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "retirado", label: "Retirado" },
  { value: "egresado", label: "Egresado" },
];
const emptyForm: EstudiantePayload & { rude?: string } = {
  nombre: "",
  apellido: "",
  ci: "",
  rude: "",
  fecha_nacimiento: "",
  genero: "",
  de_traslado: false,
  institucion_origen: "",
  observaciones: "",
};

// Validar RUDE (15-16 dígitos)
const validarRude = (rude: string) => {
  if (!rude) return true;
  const cleaned = rude.replace(/\D/g, "");
  return cleaned.length >= 15 && cleaned.length <= 16;
};

// Validar edad mínima (4 años cumplidos hasta 30 de junio de 2026)
const validarEdadMinima = (fechaNacimiento: string) => {
  if (!fechaNacimiento) return true;
  const fecha = new Date(fechaNacimiento);
  const fechaLimite = new Date(2022, 5, 30);
  return fecha <= fechaLimite;
};

// Calcular si es mayor a 18 años (al 30 de junio de 2026)
const esEstudianteMayor = (fechaNacimiento: string) => {
  if (!fechaNacimiento) return false;
  const fecha = new Date(fechaNacimiento);
  const fechaReferencia = new Date(2026, 5, 30);
  const edad = fechaReferencia.getFullYear() - fecha.getFullYear();
  const mes = fechaReferencia.getMonth() - fecha.getMonth();

  if (mes < 0 || (mes === 0 && fechaReferencia.getDate() < fecha.getDate())) {
    return edad - 1 >= 18;
  }
  return edad >= 18;
};

export default function EstudiantesPage() {
  const router = useRouter();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("activo");
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EstudiantePayload>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Crear cuenta de estudiante
  const [showCuentaDialog, setShowCuentaDialog] = useState(false);
  const [cuentaEstudiante, setCuentaEstudiante] = useState<Estudiante | null>(null);
  const [cuentaForm, setCuentaForm] = useState({ username: "", password: "", email: "" });
  const [showCuentaPassword, setShowCuentaPassword] = useState(false);
  const [savingCuenta, setSavingCuenta] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (estadoFilter !== "todos") params.estado = estadoFilter;
      const data = await estudiantesApi.getAll(params);
      setEstudiantes(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [search, estadoFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  };
  const openEdit = (e: Estudiante) => {
    setEditId(e.id_estudiante);
    setForm({
      nombre: e.nombre,
      apellido: e.apellido,
      ci: e.ci ?? "",
      fecha_nacimiento: e.fecha_nacimiento ?? "",
      genero: e.genero,
      estado: e.estado,
      de_traslado: false,
      institucion_origen: "",
      observaciones: e.observaciones ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.nombre || !form.apellido || !form.genero)
      return toast.error("Nombre, apellido y género son obligatorios");

    // Validar CI (obligatorio)
    if (!form.ci || form.ci.trim() === "") {
      return toast.error("El CI es obligatorio");
    }

    // Validar RUDE (obligatorio)
    if (!form.rude || form.rude.trim() === "") {
      return toast.error("El RUDE es obligatorio");
    }

    // Validar formato RUDE
    if (form.rude && !validarRude(form.rude)) {
      return toast.error("El RUDE debe tener 15 a 16 dígitos válidos");
    }

    // Validar fecha de nacimiento
    if (form.fecha_nacimiento) {
      if (new Date(form.fecha_nacimiento) > new Date()) {
        return toast.error(
          "La fecha de nacimiento no puede ser una fecha futura",
        );
      }
      if (!validarEdadMinima(form.fecha_nacimiento)) {
        return toast.error(
          "El estudiante debe tener 4 años cumplidos hasta el 30 de junio de 2026",
        );
      }
    }

    setSaving(true);
    try {
      if (editId) {
        const r = await estudiantesApi.update(
          editId,
          form as EstudiantePayload,
        );
        toast.success(r.message);
      } else {
        const r = await estudiantesApi.create(form as EstudiantePayload);
        toast.success(r.message);
        if (r.nota_traslado) toast.info(r.nota_traslado);
        if (r.alerta_edad) toast.warning(r.alerta_edad);
      }
      setShowDialog(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await estudiantesApi.exportarCsv();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "estudiantes.csv";
      a.click();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    }
  };

  const openCrearCuenta = (e: Estudiante) => {
    setCuentaEstudiante(e);
    setCuentaForm({ username: "", password: "", email: "" });
    setShowCuentaDialog(true);
  };

  const handleCrearCuenta = async () => {
    if (!cuentaEstudiante) return;
    if (!cuentaForm.username || !cuentaForm.password || !cuentaForm.email) {
      return toast.error("Usuario, contraseña y email son obligatorios.");
    }
    const pwError = validatePasswordStrength(cuentaForm.password);
    if (pwError) return toast.error(pwError);
    setSavingCuenta(true);
    try {
      const r = await adminEstudianteApi.crearCuenta(cuentaEstudiante.id_estudiante, cuentaForm);
      toast.success(r.message);
      setShowCuentaDialog(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al crear cuenta");
    } finally {
      setSavingCuenta(false);
    }
  };

  const initials = (e: Estudiante) =>
    `${e.nombre[0] ?? ""}${e.apellido[0] ?? ""}`.toUpperCase();
  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      activo: "bg-green-100 text-green-700",
      inactivo: "bg-red-100 text-red-700",
      retirado: "bg-yellow-100 text-yellow-700",
      egresado: "bg-gray-100 text-gray-600",
    };
    return map[estado] ?? "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estudiantes</h1>
          <p className="text-muted-foreground">
            Expedientes digitales — {estudiantes.length} resultado(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Estudiante
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o CI..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Buscando...
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>CI</TableHead>
                    <TableHead>Género</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estudiantes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Sin resultados
                      </TableCell>
                    </TableRow>
                  ) : (
                    estudiantes.map((e) => (
                      <TableRow key={e.id_estudiante}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {initials(e)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {e.nombre} {e.apellido}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {e.ci ?? "—"}
                        </TableCell>
                        <TableCell>{e.genero}</TableCell>
                        <TableCell>{e.edad ? `${e.edad} años` : "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={estadoBadge(e.estado)}
                          >
                            {e.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/expedientes?id=${e.id_estudiante}`,
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver expediente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(e)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openCrearCuenta(e)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Crear cuenta de acceso
                              </DropdownMenuItem>
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar Estudiante" : "Nuevo Estudiante"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {form.fecha_nacimiento &&
              esEstudianteMayor(form.fecha_nacimiento) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                  ⚠️ <strong>Alerta:</strong> Este estudiante es mayor a 18
                  años. Se recomienda verificar su inscripción al CEMA o CEA.
                </div>
              )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Apellido *</Label>
                <Input
                  value={form.apellido}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apellido: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CI *</Label>
                <Input
                  value={form.ci}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ci: e.target.value }))
                  }
                  placeholder="Obligatorio"
                />
              </div>
              <div className="space-y-1">
                <Label>RUDE *</Label>
                <Input
                  value={form.rude || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rude: e.target.value }))
                  }
                  placeholder="15-16 dígitos"
                  maxLength={16}
                />
                {form.rude && !validarRude(form.rude) && (
                  <p className="text-xs text-red-500 mt-1">
                    El RUDE debe tener 15 a 16 dígitos válidos
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))
                  }
                  max={new Date().toISOString().split("T")[0]}
                />
                {form.fecha_nacimiento &&
                  !validarEdadMinima(form.fecha_nacimiento) && (
                    <p className="text-xs text-red-500 mt-1">
                      Debe tener 4 años cumplidos hasta el 30/06/2026
                    </p>
                  )}
              </div>
              <div className="space-y-1">
                <Label>Género *</Label>
                <Select
                  value={form.genero}
                  onValueChange={(v) => setForm((f) => ({ ...f, genero: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENEROS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="traslado"
                  checked={!!form.de_traslado}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, de_traslado: !!v }))
                  }
                />
                <Label htmlFor="traslado">Estudiante de traslado</Label>
              </div>
            )}
            {form.de_traslado && (
              <div className="space-y-1">
                <Label>Institución de origen</Label>
                <Input
                  value={form.institucion_origen}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      institucion_origen: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Input
                value={form.observaciones}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observaciones: e.target.value }))
                }
                placeholder="Opcional"
              />
            </div>
            {editId && (
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select
                  value={
                    (form as EstudiantePayload & { estado?: string }).estado ??
                    "activo"
                  }
                  onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Crear cuenta de acceso para estudiante ── */}
      <Dialog open={showCuentaDialog} onOpenChange={setShowCuentaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Crear cuenta de acceso
            </DialogTitle>
          </DialogHeader>
          {cuentaEstudiante && (
            <p className="text-sm text-muted-foreground -mt-2">
              {cuentaEstudiante.nombre} {cuentaEstudiante.apellido}
            </p>
          )}
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Usuario</Label>
              <Input
                placeholder="nombre.apellido"
                value={cuentaForm.username}
                onChange={(e) => setCuentaForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={cuentaForm.email}
                onChange={(e) => setCuentaForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
              <div className="relative">
                <Input
                  type={showCuentaPassword ? "text" : "password"}
                  placeholder="Mínimo 10 caracteres"
                  value={cuentaForm.password}
                  onChange={(e) => setCuentaForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCuentaPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCuentaPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showCuentaPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCuentaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrearCuenta} disabled={savingCuenta}>
              {savingCuenta ? "Creando..." : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
