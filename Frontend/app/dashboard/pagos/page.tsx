"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  pagosApi,
  estudiantesApi,
  estructuraApi,
  BulkDeudasResponse,
} from "@/lib/ciclo2Api";
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
import { CreditCard, DollarSign, Plus, Layers } from "lucide-react";

interface DeudaPago {
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
  estado_deuda: "pendiente" | "pagado" | "mora";
  id_pago?: number;
  monto_pagado?: string;
  metodo_pago?: string;
  estado_pago?: string;
  fecha_pago?: string;
}

interface Concepto {
  id_concepto: number;
  nombre_concepto: string;
}

interface Estudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  ci?: string;
}

interface Gestion {
  id_gestion: number;
  anio: number;
  estado: string;
}

export default function PagosPage() {
  const [deudas, setDeudas] = useState<DeudaPago[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("todos");
  const [deudaOpen, setDeudaOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState<DeudaPago | null>(null);
  const [deudaForm, setDeudaForm] = useState({
    id_estudiante: "",
    id_gestion: "",
    id_concepto: "",
    monto: "",
    mes: "",
  });
  const [pagoForm, setPagoForm] = useState({
    monto_pagado: "",
    metodo_pago: "efectivo",
    observaciones: "",
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ id_concepto: "", mes: "" });
  const [bulkResult, setBulkResult] = useState<BulkDeudasResponse | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (estado !== "todos") params.estado = estado;

    try {
      const [deudasData, conceptosData, estudiantesData, gestionesData] =
        await Promise.all([
          pagosApi.getDeudas(params),
          pagosApi.getConceptos(),
          estudiantesApi.getAll(),
          estructuraApi.getGestiones(),
        ]);
      setDeudas(deudasData);
      setConceptos(conceptosData);
      setEstudiantes(estudiantesData);
      setGestiones(gestionesData);
      const activa =
        gestionesData.find((g: Gestion) => g.estado === "activa") ||
        gestionesData[0];
      if (activa && !deudaForm.id_gestion)
        setDeudaForm((prev) => ({
          ...prev,
          id_gestion: String(activa.id_gestion),
        }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar pagos",
      );
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const stats = useMemo(() => {
    return {
      cobrado: deudas
        .filter((d) => d.estado_deuda === "pagado")
        .reduce((acc, d) => acc + Number(d.monto_pagado || d.monto), 0),
      pendiente: deudas
        .filter((d) => d.estado_deuda !== "pagado")
        .reduce((acc, d) => acc + Number(d.monto), 0),
      pagadas: deudas.filter((d) => d.estado_deuda === "pagado").length,
      mora: deudas.filter((d) => d.estado_deuda === "mora").length,
    };
  }, [deudas]);

  const createDeuda = async () => {
    try {
      await pagosApi.createDeuda({
        id_estudiante: Number(deudaForm.id_estudiante),
        id_gestion: Number(deudaForm.id_gestion),
        id_concepto: Number(deudaForm.id_concepto),
        monto: Number(deudaForm.monto),
        mes: deudaForm.mes,
      });
      toast.success("Deuda generada");
      setDeudaOpen(false);
      setDeudaForm((prev) => ({
        ...prev,
        id_estudiante: "",
        id_concepto: "",
        monto: "",
        mes: "",
      }));
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al generar deuda",
      );
    }
  };

  const openPago = (deuda: DeudaPago) => {
    setSelectedDeuda(deuda);
    setPagoForm({
      monto_pagado: String(deuda.monto),
      metodo_pago: "efectivo",
      observaciones: "",
    });
    setPagoOpen(true);
  };

  const registrarPago = async () => {
    if (!selectedDeuda) return;
    try {
      await pagosApi.registrarPago({
        id_deuda: selectedDeuda.id_deuda,
        monto_pagado: Number(pagoForm.monto_pagado),
        metodo_pago: pagoForm.metodo_pago,
        estado: "validado",
        observaciones: pagoForm.observaciones,
      });
      toast.success("Pago registrado");
      setPagoOpen(false);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al registrar pago",
      );
    }
  };

  const generateBulk = async () => {
    const activa = gestiones.find((g) => g.estado === "activa") || gestiones[0];
    if (!activa) {
      toast.error("No hay gestión activa");
      return;
    }
    if (!bulkForm.id_concepto || !bulkForm.mes.trim()) {
      toast.error("Seleccione concepto y mes");
      return;
    }
    setBulkLoading(true);
    try {
      const result = await pagosApi.generateBulkDeudas({
        id_gestion: activa.id_gestion,
        id_concepto: Number(bulkForm.id_concepto),
        mes: bulkForm.mes.trim(),
      });
      setBulkResult(result);
      toast.success(result.message);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al generar deudas",
      );
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Control de Pagos
          </h1>
          <p className="text-muted-foreground">
            Deudas, mensualidades y registro de pagos
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={bulkOpen}
            onOpenChange={(open) => {
              setBulkOpen(open);
              if (!open) setBulkResult(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Layers className="h-4 w-4" />
                Generar masivo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generar deudas masivas</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Concepto</Label>
                  <Select
                    value={bulkForm.id_concepto}
                    onValueChange={(value) =>
                      setBulkForm({ ...bulkForm, id_concepto: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      {conceptos.map((c) => (
                        <SelectItem
                          key={c.id_concepto}
                          value={String(c.id_concepto)}
                        >
                          {c.nombre_concepto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Mes</Label>
                  <Input
                    value={bulkForm.mes}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, mes: e.target.value })
                    }
                    placeholder="Enero, Febrero..."
                  />
                </div>
                {bulkResult && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p className="font-medium">{bulkResult.message}</p>
                    <p>
                      Nuevas deudas:{" "}
                      <span className="font-semibold">
                        {bulkResult.resumen.nuevas_deudas}
                      </span>
                    </p>
                    <p>
                      Ya existían:{" "}
                      <span className="font-semibold">
                        {bulkResult.resumen.ya_existentes}
                      </span>
                    </p>
                    <p>
                      Sin arancel configurado:{" "}
                      <span className="font-semibold">
                        {bulkResult.resumen.sin_arancel_configurado}
                      </span>
                    </p>
                    <p>
                      Total procesados:{" "}
                      <span className="font-semibold">
                        {bulkResult.resumen.total_procesados}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={generateBulk}
                  disabled={bulkLoading}
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  {bulkLoading ? "Procesando..." : "Generar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={deudaOpen} onOpenChange={setDeudaOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Generar deuda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva deuda</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Estudiante</Label>
                  <Select
                    value={deudaForm.id_estudiante}
                    onValueChange={(value) =>
                      setDeudaForm({ ...deudaForm, id_estudiante: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estudiante" />
                    </SelectTrigger>
                    <SelectContent>
                      {estudiantes.map((e) => (
                        <SelectItem
                          key={e.id_estudiante}
                          value={String(e.id_estudiante)}
                        >
                          {e.apellido} {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Concepto</Label>
                  <Select
                    value={deudaForm.id_concepto}
                    onValueChange={(value) =>
                      setDeudaForm({ ...deudaForm, id_concepto: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      {conceptos.map((c) => (
                        <SelectItem
                          key={c.id_concepto}
                          value={String(c.id_concepto)}
                        >
                          {c.nombre_concepto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      value={deudaForm.monto}
                      onChange={(e) =>
                        setDeudaForm({ ...deudaForm, monto: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Mes</Label>
                    <Input
                      value={deudaForm.mes}
                      onChange={(e) =>
                        setDeudaForm({ ...deudaForm, mes: e.target.value })
                      }
                      placeholder="Mayo"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createDeuda}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cobrado</p>
            <p className="text-2xl font-bold">Bs. {stats.cobrado.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pendiente</p>
            <p className="text-2xl font-bold">
              Bs. {stats.pendiente.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pagadas</p>
            <p className="text-2xl font-bold">{stats.pagadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">En mora</p>
            <p className="text-2xl font-bold">{stats.mora}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deudas y pagos</CardTitle>
          <CardDescription>Busca por estudiante, CI o concepto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
            />
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="mora">Mora</SelectItem>
                <SelectItem value="pagado">Pagados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load}>
              Buscar
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deudas.map((deuda) => (
                  <TableRow key={deuda.id_deuda}>
                    <TableCell>
                      <p className="font-medium">{deuda.estudiante}</p>
                      <p className="text-xs text-muted-foreground">
                        {deuda.estudiante_ci || "Sin CI"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {deuda.nombre_concepto} · {deuda.mes} {deuda.anio}
                    </TableCell>
                    <TableCell className="font-mono">
                      Bs. {Number(deuda.monto).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          deuda.estado_deuda === "pagado"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {deuda.estado_deuda}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deuda.id_pago
                        ? `${deuda.metodo_pago} · Bs. ${Number(deuda.monto_pagado).toFixed(2)}`
                        : "Sin pago"}
                    </TableCell>
                    <TableCell className="text-right">
                      {deuda.estado_deuda !== "pagado" && (
                        <Button
                          size="sm"
                          onClick={() => openPago(deuda)}
                          className="gap-2"
                        >
                          <CreditCard className="h-4 w-4" />
                          Registrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {deudas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay deudas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              {selectedDeuda?.estudiante} · {selectedDeuda?.nombre_concepto}
            </div>
            <div className="grid gap-2">
              <Label>Monto pagado</Label>
              <Input
                type="number"
                value={pagoForm.monto_pagado}
                onChange={(e) =>
                  setPagoForm({ ...pagoForm, monto_pagado: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Metodo</Label>
              <Select
                value={pagoForm.metodo_pago}
                onValueChange={(value) =>
                  setPagoForm({ ...pagoForm, metodo_pago: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="QR">QR</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea
                value={pagoForm.observaciones}
                onChange={(e) =>
                  setPagoForm({ ...pagoForm, observaciones: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={registrarPago} className="gap-2">
              <DollarSign className="h-4 w-4" />
              Guardar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
