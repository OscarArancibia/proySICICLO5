"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Package,
  Plus,
  Edit,
  Eye,
  EyeOff,
} from "lucide-react";

interface Material {
  id_material: number;
  nombre_item: string;
  descripcion?: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  estado: boolean;
  ultima_fecha_movimiento?: string;
  ultimo_tipo_movimiento?: string;
}

interface Movimiento {
  id_movimiento: number;
  id_material: number;
  nombre_item: string;
  tipo_movimiento: "entrada" | "salida";
  cantidad: number;
  fecha_movimiento: string;
  usuario: string;
  observaciones?: string;
}

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

export default function InventarioPage() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("true");
  const [materialOpen, setMaterialOpen] = useState(false);
  const [movimientoOpen, setMovimientoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialForm, setMaterialForm] = useState({
    nombre_item: "",
    descripcion: "",
    categoria: "",
    stock_minimo: "",
    stock_inicial: "",
  });
  const [editForm, setEditForm] = useState({
    nombre_item: "",
    descripcion: "",
    categoria: "",
    stock_minimo: "",
  });
  const [movimientoForm, setMovimientoForm] = useState({
    id_material: "",
    tipo_movimiento: "entrada",
    cantidad: "",
    observaciones: "",
  });

  const load = async (searchVal = search, est = estadoFilter) => {
    const paramsList: string[] = [];
    if (searchVal) paramsList.push(`search=${encodeURIComponent(searchVal)}`);
    if (est !== "todos") paramsList.push(`estado=${est}`);
    else paramsList.push("estado=todos");
    const qs = paramsList.length ? `?${paramsList.join("&")}` : "";

    try {
      const [materialesRes, movimientosRes] = await Promise.all([
        fetch(`${API_URL}/api/inventario/materiales${qs}`, {
          headers: getHeaders(),
        }),
        fetch(`${API_URL}/api/inventario/movimientos?limit=25`, {
          headers: getHeaders(),
        }),
      ]);
      const [materialesData, movimientosData] = await Promise.all([
        materialesRes.json(),
        movimientosRes.json(),
      ]);
      if (!materialesRes.ok)
        throw new Error(materialesData.message || "Error al cargar materiales");
      if (!movimientosRes.ok)
        throw new Error(
          movimientosData.message || "Error al cargar movimientos",
        );
      setMateriales(materialesData);
      setMovimientos(movimientosData);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar inventario",
      );
    }
  };

  useEffect(() => {
    load(search, estadoFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFilter]);

  const stats = useMemo(() => {
    const bajo = materiales.filter((m) => m.stock_actual <= m.stock_minimo);
    return {
      totalUnidades: materiales.reduce(
        (acc, m) => acc + Number(m.stock_actual),
        0,
      ),
      productos: materiales.length,
      bajo: bajo.length,
      movimientos: movimientos.length,
    };
  }, [materiales, movimientos]);

  const createMaterial = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventario/materiales`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(materialForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al crear material");
      toast.success("Material creado");
      setMaterialOpen(false);
      setMaterialForm({
        nombre_item: "",
        descripcion: "",
        categoria: "",
        stock_minimo: "",
        stock_inicial: "",
      });
      load(search, estadoFilter);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear material",
      );
    }
  };

  const updateMaterial = async () => {
    if (!editingMaterial) return;
    try {
      const res = await fetch(`${API_URL}/api/inventario/materiales/${editingMaterial.id_material}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al actualizar material");
      toast.success("Material actualizado correctamente");
      setEditOpen(false);
      setEditingMaterial(null);
      load(search, estadoFilter);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar material",
      );
    }
  };

  const toggleMaterialEstado = async (material: Material) => {
    const nuevoEstado = !material.estado;
    try {
      const res = await fetch(`${API_URL}/api/inventario/materiales/${material.id_material}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al cambiar estado del material");
      toast.success(nuevoEstado ? "Material activado" : "Material desactivado");
      load(search, estadoFilter);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cambiar estado",
      );
    }
  };

  const registrarMovimiento = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventario/movimientos`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(movimientoForm),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || data.message || "Error al registrar movimiento",
        );
      toast.success("Movimiento registrado");
      setMovimientoOpen(false);
      setMovimientoForm({
        id_material: "",
        tipo_movimiento: "entrada",
        cantidad: "",
        observaciones: "",
      });
      load(search, estadoFilter);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al registrar movimiento",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Materiales, stock y movimientos
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={movimientoOpen} onOpenChange={setMovimientoOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar movimiento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Material</Label>
                  <Select
                    value={movimientoForm.id_material}
                    onValueChange={(value) =>
                      setMovimientoForm({
                        ...movimientoForm,
                        id_material: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materiales.map((m) => (
                        <SelectItem
                          key={m.id_material}
                          value={String(m.id_material)}
                        >
                          {m.nombre_item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select
                      value={movimientoForm.tipo_movimiento}
                      onValueChange={(value) =>
                        setMovimientoForm({
                          ...movimientoForm,
                          tipo_movimiento: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="salida">Salida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      value={movimientoForm.cantidad}
                      onChange={(e) =>
                        setMovimientoForm({
                          ...movimientoForm,
                          cantidad: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={movimientoForm.observaciones}
                    onChange={(e) =>
                      setMovimientoForm({
                        ...movimientoForm,
                        observaciones: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={registrarMovimiento}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo material</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input
                    value={materialForm.nombre_item}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        nombre_item: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input
                    value={materialForm.categoria}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        categoria: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Stock minimo</Label>
                    <Input
                      type="number"
                      value={materialForm.stock_minimo}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          stock_minimo: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Stock inicial</Label>
                    <Input
                      type="number"
                      value={materialForm.stock_inicial}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          stock_inicial: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Descripcion</Label>
                  <Textarea
                    value={materialForm.descripcion}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        descripcion: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createMaterial}>Crear</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total unidades</p>
            <p className="text-2xl font-bold">{stats.totalUnidades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Productos</p>
            <p className="text-2xl font-bold">{stats.productos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Stock bajo</p>
            <p className="text-2xl font-bold">{stats.bajo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Movimientos recientes
            </p>
            <p className="text-2xl font-bold">{stats.movimientos}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Materiales</CardTitle>
          <CardDescription>Inventario activo de la institución</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar material..."
            />
            <Select
              value={estadoFilter}
              onValueChange={(val) => setEstadoFilter(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(search, estadoFilter)}>
              Buscar
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Minimo</TableHead>
                  <TableHead>Ultimo movimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiales.map((material) => (
                  <TableRow key={material.id_material}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{material.nombre_item}</p>
                        {!material.estado && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-dashed">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {material.descripcion || "Sin descripcion"}
                      </p>
                    </TableCell>
                    <TableCell>{material.categoria}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          material.stock_actual <= material.stock_minimo
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {material.stock_actual}
                      </Badge>
                    </TableCell>
                    <TableCell>{material.stock_minimo}</TableCell>
                    <TableCell>
                      {material.ultima_fecha_movimiento
                        ? new Date(
                            material.ultima_fecha_movimiento,
                          ).toLocaleString("es-BO")
                        : "Sin movimientos"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingMaterial(material);
                            setEditForm({
                              nombre_item: material.nombre_item,
                              descripcion: material.descripcion || "",
                              categoria: material.categoria,
                              stock_minimo: String(material.stock_minimo),
                            });
                            setEditOpen(true);
                          }}
                          title="Editar material"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMaterialEstado(material)}
                          title={material.estado ? "Desactivar material" : "Activar material"}
                        >
                          {material.estado ? (
                            <EyeOff className="h-4 w-4 text-destructive" />
                          ) : (
                            <Eye className="h-4 w-4 text-emerald-600" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {materiales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay materiales registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>Entradas y salidas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov) => (
                  <TableRow key={mov.id_movimiento}>
                    <TableCell>{mov.nombre_item}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {mov.tipo_movimiento === "entrada" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                      {mov.tipo_movimiento}
                    </TableCell>
                    <TableCell>{mov.cantidad}</TableCell>
                    <TableCell>{mov.usuario}</TableCell>
                    <TableCell>
                      {new Date(mov.fecha_movimiento).toLocaleString("es-BO")}
                    </TableCell>
                  </TableRow>
                ))}
                {movimientos.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Sin movimientos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={editForm.nombre_item}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    nombre_item: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Input
                value={editForm.categoria}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    categoria: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Stock minimo</Label>
              <Input
                type="number"
                value={editForm.stock_minimo}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    stock_minimo: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripcion</Label>
              <Textarea
                value={editForm.descripcion}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    descripcion: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={updateMaterial}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
