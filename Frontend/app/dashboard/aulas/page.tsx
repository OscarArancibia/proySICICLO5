"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  School,
  Plus,
  AlertCircle,
  Edit,
  MoreHorizontal,
  DoorOpen,
  Layers,
  BookOpen,
  DollarSign,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";

const API = `${API_URL}/api/estructura`;

function getHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── NIVELES TAB ───────────────────────────────────────────────
function NivelesTab() {
  const [niveles, setNiveles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ nombre_nivel: "", monto_mensualidad: "" });
  const [editForm, setEditForm] = useState({
    id: 0,
    nombre_nivel: "",
    monto_mensualidad: "",
  });

  const fetchNiveles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/niveles`, { headers: getHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Error al cargar niveles");
      setNiveles(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar niveles");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchNiveles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.nombre_nivel) {
      setFormError("El nombre del nivel es obligatorio.");
      return;
    }
    const monto = parseFloat(form.monto_mensualidad) || 0;
    if (monto < 0) {
      setFormError("El monto no puede ser negativo.");
      return;
    }
    try {
      const res = await fetch(`${API}/niveles`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          nombre_nivel: form.nombre_nivel,
          monto_mensualidad: monto,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsCreateOpen(false);
      setForm({ nombre_nivel: "", monto_mensualidad: "" });
      fetchNiveles();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!editForm.nombre_nivel) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    const monto = parseFloat(editForm.monto_mensualidad) || 0;
    if (monto < 0) {
      setFormError("El monto no puede ser negativo.");
      return;
    }
    try {
      const res = await fetch(`${API}/niveles/${editForm.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          nombre_nivel: editForm.nombre_nivel,
          monto_mensualidad: monto,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsEditOpen(false);
      fetchNiveles();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Niveles educativos con su monto de mensualidad. Ej: Kínder, Primaria.
        </p>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(o) => {
            setIsCreateOpen(o);
            if (!o) {
              setForm({ nombre_nivel: "", monto_mensualidad: "" });
              setFormError("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Nivel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nivel</DialogTitle>
              <DialogDescription>
                Ingrese el nombre y la mensualidad del nivel educativo.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Nombre del Nivel *</Label>
                <Input
                  value={form.nombre_nivel}
                  onChange={(e) =>
                    setForm({ ...form, nombre_nivel: e.target.value })
                  }
                  placeholder="Ej. Kínder, Primaria"
                />
              </div>
              <div className="space-y-2">
                <Label>Monto Mensualidad (Bs.)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-10"
                    value={form.monto_mensualidad}
                    onChange={(e) =>
                      setForm({ ...form, monto_mensualidad: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={isEditOpen}
        onOpenChange={(o) => {
          setIsEditOpen(o);
          if (!o) setFormError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nivel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre del Nivel *</Label>
              <Input
                value={editForm.nombre_nivel}
                onChange={(e) =>
                  setEditForm({ ...editForm, nombre_nivel: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Monto Mensualidad (Bs.)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10"
                  value={editForm.monto_mensualidad}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      monto_mensualidad: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Actualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : niveles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay niveles registrados.
              </div>
            ) : (
              niveles.map((n) => (
                <div
                  key={n.id_nivel}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <p className="font-semibold">{n.nombre_nivel}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {n.id_nivel}
                  </p>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Bs. {parseFloat(n.monto_mensualidad || 0).toFixed(2)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditForm({
                        id: n.id_nivel,
                        nombre_nivel: n.nombre_nivel,
                        monto_mensualidad: String(n.monto_mensualidad || 0),
                      });
                      setFormError("");
                      setIsEditOpen(true);
                    }}
                    className="w-full"
                  >
                    Editar
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Nombre del Nivel</TableHead>
                  <TableHead>Mensualidad (Bs.)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : niveles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay niveles registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  niveles.map((n) => (
                    <TableRow key={n.id_nivel}>
                      <TableCell className="text-muted-foreground">
                        {n.id_nivel}
                      </TableCell>
                      <TableCell className="font-medium">
                        {n.nombre_nivel}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-sm font-semibold">
                          Bs. {parseFloat(n.monto_mensualidad || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditForm({
                                  id: n.id_nivel,
                                  nombre_nivel: n.nombre_nivel,
                                  monto_mensualidad: String(
                                    n.monto_mensualidad || 0,
                                  ),
                                });
                                setFormError("");
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4 text-blue-500" />{" "}
                              Editar
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
        </CardContent>
      </Card>
    </div>
  );
}

// ─── GRADOS TAB ───────────────────────────────────────────────
function GradosTab() {
  const [grados, setGrados] = useState<any[]>([]);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ nombre_grado: "", id_nivel: "" });
  const [editForm, setEditForm] = useState({
    id: 0,
    nombre_grado: "",
    id_nivel: "",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const h = getHeaders();
      const [resG, resN] = await Promise.all([
        fetch(`${API}/grados`, { headers: h }),
        fetch(`${API}/niveles`, { headers: h }),
      ]);
      const gradosData = await resG.json().catch(() => null);
      const nivelesData = await resN.json().catch(() => null);
      if (!resG.ok)
        throw new Error(gradosData?.message || "Error al cargar grados");
      if (!resN.ok)
        throw new Error(nivelesData?.message || "Error al cargar niveles");
      setGrados(gradosData);
      setNiveles(nivelesData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.nombre_grado || !form.id_nivel) {
      setFormError("Nombre del grado y nivel son obligatorios.");
      return;
    }
    try {
      const res = await fetch(`${API}/grados`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          nombre_grado: form.nombre_grado,
          id_nivel: parseInt(form.id_nivel),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsCreateOpen(false);
      setForm({ nombre_grado: "", id_nivel: "" });
      fetchData();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!editForm.nombre_grado || !editForm.id_nivel) {
      setFormError("Nombre y nivel son obligatorios.");
      return;
    }
    try {
      const res = await fetch(`${API}/grados/${editForm.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          nombre_grado: editForm.nombre_grado,
          id_nivel: parseInt(editForm.id_nivel),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsEditOpen(false);
      fetchData();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Grados asignados a cada nivel. Primero registre los niveles.
        </p>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(o) => {
            setIsCreateOpen(o);
            if (!o) {
              setForm({ nombre_grado: "", id_nivel: "" });
              setFormError("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Grado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Grado</DialogTitle>
              <DialogDescription>
                Vincule el grado a un nivel educativo existente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Nombre del Grado *</Label>
                <Input
                  value={form.nombre_grado}
                  onChange={(e) =>
                    setForm({ ...form, nombre_grado: e.target.value })
                  }
                  placeholder="Ej. 1ro, 2do, Kínder A"
                />
              </div>
              <div className="space-y-2">
                <Label>Nivel *</Label>
                <Select
                  value={form.id_nivel}
                  onValueChange={(v) => setForm({ ...form, id_nivel: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {niveles.map((n) => (
                      <SelectItem key={n.id_nivel} value={String(n.id_nivel)}>
                        {n.nombre_nivel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={isEditOpen}
        onOpenChange={(o) => {
          setIsEditOpen(o);
          if (!o) setFormError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grado</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre del Grado *</Label>
              <Input
                value={editForm.nombre_grado}
                onChange={(e) =>
                  setEditForm({ ...editForm, nombre_grado: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nivel *</Label>
              <Select
                value={editForm.id_nivel}
                onValueChange={(v) => setEditForm({ ...editForm, id_nivel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {niveles.map((n) => (
                    <SelectItem key={n.id_nivel} value={String(n.id_nivel)}>
                      {n.nombre_nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Actualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : grados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay grados registrados.
              </div>
            ) : (
              grados.map((g) => (
                <div
                  key={g.id_grado}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <p className="font-semibold">{g.nombre_grado}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {g.id_grado}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Nivel:</span> {g.nombre_nivel}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditForm({
                        id: g.id_grado,
                        nombre_grado: g.nombre_grado,
                        id_nivel: String(g.id_nivel),
                      });
                      setFormError("");
                      setIsEditOpen(true);
                    }}
                    className="w-full"
                  >
                    Editar
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : grados.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay grados registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  grados.map((g) => (
                    <TableRow key={g.id_grado}>
                      <TableCell className="text-muted-foreground">
                        {g.id_grado}
                      </TableCell>
                      <TableCell className="font-medium">
                        {g.nombre_grado}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-semibold">
                          {g.nombre_nivel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditForm({
                                  id: g.id_grado,
                                  nombre_grado: g.nombre_grado,
                                  id_nivel: String(g.id_nivel),
                                });
                                setFormError("");
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4 text-blue-500" />{" "}
                              Editar
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
        </CardContent>
      </Card>
    </div>
  );
}

// ─── AULAS TAB ───────────────────────────────────────────────
function AulasTab() {
  const [aulas, setAulas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    numero_aula: "",
    descripcion: "",
    cantidad_mesas: "",
    cantidad_sillas: "",
    capacidad_estudiantes: "",
  });
  const [editForm, setEditForm] = useState({
    id: 0,
    numero_aula: "",
    descripcion: "",
    cantidad_mesas: "",
    cantidad_sillas: "",
    capacidad_estudiantes: "",
  });

  const fetchAulas = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/aulas`, { headers: getHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Error al cargar aulas");
      setAulas(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar aulas");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchAulas();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.numero_aula) {
      setFormError("El número de aula es obligatorio.");
      return;
    }
    try {
      const res = await fetch(`${API}/aulas`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          numero_aula: form.numero_aula,
          descripcion: form.descripcion,
          cantidad_mesas: parseInt(form.cantidad_mesas) || 0,
          cantidad_sillas: parseInt(form.cantidad_sillas) || 0,
          capacidad_estudiantes: parseInt(form.capacidad_estudiantes) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsCreateOpen(false);
      setForm({
        numero_aula: "",
        descripcion: "",
        cantidad_mesas: "",
        cantidad_sillas: "",
        capacidad_estudiantes: "",
      });
      fetchAulas();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!editForm.numero_aula) {
      setFormError("El número de aula es obligatorio.");
      return;
    }
    try {
      const res = await fetch(`${API}/aulas/${editForm.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          numero_aula: editForm.numero_aula,
          descripcion: editForm.descripcion,
          cantidad_mesas: parseInt(editForm.cantidad_mesas) || 0,
          cantidad_sillas: parseInt(editForm.cantidad_sillas) || 0,
          capacidad_estudiantes: parseInt(editForm.capacidad_estudiantes) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message);
        return;
      }
      setIsEditOpen(false);
      fetchAulas();
    } catch {
      setFormError("Error de conexión.");
    }
  };

  const aulaFormFields = (data: any, setter: (d: any) => void) => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Aula *</Label>
          <Input
            value={data.numero_aula}
            onChange={(e) => setter({ ...data, numero_aula: e.target.value })}
            placeholder="Ej. A-101"
          />
        </div>
        <div className="space-y-2">
          <Label>Capacidad Estudiantes</Label>
          <Input
            type="number"
            min="0"
            value={data.capacidad_estudiantes}
            onChange={(e) =>
              setter({ ...data, capacidad_estudiantes: e.target.value })
            }
            placeholder="0"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cantidad de Mesas</Label>
          <Input
            type="number"
            min="0"
            value={data.cantidad_mesas}
            onChange={(e) =>
              setter({ ...data, cantidad_mesas: e.target.value })
            }
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Cantidad de Sillas</Label>
          <Input
            type="number"
            min="0"
            value={data.cantidad_sillas}
            onChange={(e) =>
              setter({ ...data, cantidad_sillas: e.target.value })
            }
            placeholder="0"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descripción</Label>
        <Textarea
          value={data.descripcion}
          onChange={(e: any) =>
            setter({ ...data, descripcion: e.target.value })
          }
          placeholder="Descripción adicional del aula..."
          rows={2}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Aulas físicas con capacidad y mobiliario disponible.
        </p>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(o) => {
            setIsCreateOpen(o);
            if (!o) {
              setForm({
                numero_aula: "",
                descripcion: "",
                cantidad_mesas: "",
                cantidad_sillas: "",
                capacidad_estudiantes: "",
              });
              setFormError("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Nueva Aula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Aula</DialogTitle>
              <DialogDescription>
                Ingrese el número, capacidad y mobiliario del aula.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              {aulaFormFields(form, setForm)}
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={isEditOpen}
        onOpenChange={(o) => {
          setIsEditOpen(o);
          if (!o) setFormError("");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Aula</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {formError}
              </div>
            )}
            {aulaFormFields(editForm, setEditForm)}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Actualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : aulas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay aulas registradas.
              </div>
            ) : (
              aulas.map((a) => (
                <div
                  key={a.id_aula}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <p className="font-semibold">{a.numero_aula}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.descripcion || "—"}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border px-2 py-1 text-center">
                      Cap: {a.capacidad_estudiantes}
                    </div>
                    <div className="rounded border px-2 py-1 text-center">
                      Mesas: {a.cantidad_mesas}
                    </div>
                    <div className="rounded border px-2 py-1 text-center">
                      Sillas: {a.cantidad_sillas}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditForm({
                        id: a.id_aula,
                        numero_aula: a.numero_aula,
                        descripcion: a.descripcion || "",
                        cantidad_mesas: String(a.cantidad_mesas || 0),
                        cantidad_sillas: String(a.cantidad_sillas || 0),
                        capacidad_estudiantes: String(
                          a.capacidad_estudiantes || 0,
                        ),
                      });
                      setFormError("");
                      setIsEditOpen(true);
                    }}
                    className="w-full"
                  >
                    Editar
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Aula</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Descripción
                  </TableHead>
                  <TableHead className="text-center">Capacidad</TableHead>
                  <TableHead className="text-center">Mesas</TableHead>
                  <TableHead className="text-center">Sillas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : aulas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay aulas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  aulas.map((a) => (
                    <TableRow key={a.id_aula}>
                      <TableCell className="font-semibold">
                        {a.numero_aula}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm truncate max-w-[200px]">
                        {a.descripcion || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                          {a.capacidad_estudiantes} est.
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {a.cantidad_mesas}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {a.cantidad_sillas}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditForm({
                                  id: a.id_aula,
                                  numero_aula: a.numero_aula,
                                  descripcion: a.descripcion || "",
                                  cantidad_mesas: String(a.cantidad_mesas || 0),
                                  cantidad_sillas: String(
                                    a.cantidad_sillas || 0,
                                  ),
                                  capacidad_estudiantes: String(
                                    a.capacidad_estudiantes || 0,
                                  ),
                                });
                                setFormError("");
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4 text-blue-500" />{" "}
                              Editar
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
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function EstructuraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
          <School className="h-8 w-8 text-primary" />
          Niveles, Grados y Aulas
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure la estructura académica y física de la institución
          educativa.
        </p>
      </div>

      <Tabs defaultValue="niveles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="niveles" className="gap-2">
            <Layers className="h-4 w-4" /> Niveles
          </TabsTrigger>
          <TabsTrigger value="grados" className="gap-2">
            <BookOpen className="h-4 w-4" /> Grados
          </TabsTrigger>
          <TabsTrigger value="aulas" className="gap-2">
            <DoorOpen className="h-4 w-4" /> Aulas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="niveles">
          <NivelesTab />
        </TabsContent>
        <TabsContent value="grados">
          <GradosTab />
        </TabsContent>
        <TabsContent value="aulas">
          <AulasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
