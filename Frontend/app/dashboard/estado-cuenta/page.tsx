"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Wallet,
  Receipt,
} from "lucide-react";
import {
  estadoCuentaApi,
  ApiError,
  EstadoCuenta,
  EstadoCuentaBusqueda,
} from "@/lib/Ciclo4api";

const iniciales = (nombre: string, apellido: string) =>
  `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const fmtBs = (n: number) =>
  `${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;

const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—";

const deudaConfig = {
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    badge: "bg-warning/10 text-warning-foreground",
    row: "",
  },
  pagado: {
    label: "Pagada",
    icon: CheckCircle2,
    badge: "bg-success/10 text-success",
    row: "",
  },
  mora: {
    label: "Mora",
    icon: AlertTriangle,
    badge: "bg-destructive/10 text-destructive",
    row: "bg-destructive/5",
  },
} as const;

export default function EstadoCuentaPage() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<EstadoCuentaBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);

  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [cargandoCuenta, setCargandoCuenta] = useState(false);

  // Diálogo de recordatorio
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tutorId, setTutorId] = useState<string>("");
  const [enviando, setEnviando] = useState(false);

  // ── Búsqueda de estudiante ────────────────────────────────────────────────────

  const buscar = async () => {
    if (!query.trim()) {
      toast.error("Ingrese un término de búsqueda");
      return;
    }
    setBuscando(true);
    setBusquedaHecha(true);
    try {
      setResultados(await estadoCuentaApi.buscarEstudiantes(query.trim()));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error en la búsqueda",
      );
    } finally {
      setBuscando(false);
    }
  };

  // ── Estado de cuenta del estudiante ────────────────────────────────────────────

  const verEstadoCuenta = async (idEstudiante: number) => {
    setCargandoCuenta(true);
    setCuenta(null);
    try {
      setCuenta(await estadoCuentaApi.obtener(idEstudiante));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar el estado de cuenta",
      );
    } finally {
      setCargandoCuenta(false);
    }
  };

  // ── Envío de recordatorio ──────────────────────────────────────────────────────

  const tutoresConCorreo =
    cuenta?.tutores.filter((t) => t.correo_electronico) ?? [];

  const abrirRecordatorio = () => {
    setTutorId(
      tutoresConCorreo.length === 1 ? String(tutoresConCorreo[0].id_tutor) : "",
    );
    setDialogOpen(true);
  };

  const enviarRecordatorio = async () => {
    if (!cuenta) return;
    setEnviando(true);
    try {
      const res = await estadoCuentaApi.enviarRecordatorio(
        cuenta.estudiante.id_estudiante,
        tutorId ? Number(tutorId) : undefined,
      );
      toast.success(
        `${res.mensaje} (${res.tutor.nombre} · ${res.tutor.email})`,
      );
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Error al enviar el recordatorio",
      );
    } finally {
      setEnviando(false);
    }
  };

  const totalPagado = cuenta
    ? cuenta.pagos.reduce((acc, p) => acc + parseFloat(p.monto_pagado), 0)
    : 0;
  const enMora = cuenta
    ? cuenta.deudas.filter((d) => d.estado_deuda === "mora").length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estados de Cuenta</h1>
        <p className="text-muted-foreground">
          Consulta de obligaciones económicas por estudiante
        </p>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Buscar estudiante</CardTitle>
          <CardDescription>
            Por nombre, apellido, CI, grado o paralelo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ej: Pérez, 12345678, Kinder..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
              />
            </div>
            <Button onClick={buscar} disabled={buscando}>
              {buscando ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          {/* Resultados de búsqueda */}
          {busquedaHecha && !buscando && (
            <div className="mt-4">
              {resultados.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No se encontraron estudiantes.
                </p>
              ) : (
                <div className="space-y-2">
                  {resultados.map((e) => (
                    <button
                      key={e.id_estudiante}
                      onClick={() => verEstadoCuenta(e.id_estudiante)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {iniciales(e.nombre, e.apellido)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {e.apellido}, {e.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          CI: {e.ci ?? "—"}
                          {e.nombre_grado
                            ? ` · ${e.nombre_grado} "${e.paralelo}"`
                            : ""}
                        </p>
                      </div>
                      <span className="text-xs text-primary">Ver cuenta →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado de cuenta */}
      {cargandoCuenta && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando estado de cuenta...
        </p>
      )}

      {cuenta && !cargandoCuenta && (
        <div className="space-y-6">
          {/* Datos del estudiante + resumen */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardContent className="flex items-center gap-4 p-6">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {iniciales(
                      cuenta.estudiante.nombre,
                      cuenta.estudiante.apellido,
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">
                    {cuenta.estudiante.apellido}, {cuenta.estudiante.nombre}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    CI: {cuenta.estudiante.ci ?? "—"} ·{" "}
                    {cuenta.estudiante.genero}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={abrirRecordatorio}
                  disabled={tutoresConCorreo.length === 0}
                >
                  <Mail className="h-4 w-4" />
                  Enviar recordatorio
                </Button>
              </CardContent>
            </Card>
            <Card
              className={
                cuenta.saldo_pendiente > 0
                  ? "border-l-4 border-l-destructive"
                  : "border-l-4 border-l-success"
              }
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Saldo pendiente
                </div>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    cuenta.saldo_pendiente > 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  {fmtBs(cuenta.saldo_pendiente)}
                </p>
                {enMora > 0 && (
                  <p className="mt-1 text-xs text-destructive">
                    {enMora} deuda(s) en mora
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Deudas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5" />
                Deudas
              </CardTitle>
              <CardDescription>
                Conceptos, montos generados y estado de cada obligación
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cuenta.deudas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin deudas registradas.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Mes</TableHead>
                        <TableHead>Año</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cuenta.deudas.map((d) => {
                        const cfg = deudaConfig[d.estado_deuda];
                        const Icon = cfg.icon;
                        return (
                          <TableRow key={d.id_deuda} className={cfg.row}>
                            <TableCell className="font-medium">
                              {d.nombre_concepto}
                            </TableCell>
                            <TableCell>{d.mes}</TableCell>
                            <TableCell>{d.anio}</TableCell>
                            <TableCell className="text-right font-mono">
                              {fmtBs(parseFloat(d.monto))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`gap-1 ${cfg.badge}`}
                              >
                                <Icon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5" />
                Pagos realizados
              </CardTitle>
              <CardDescription>
                Total pagado: {fmtBs(totalPagado)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cuenta.pagos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin pagos registrados.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha de pago</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Comprobante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cuenta.pagos.map((p) => (
                        <TableRow key={p.id_pago}>
                          <TableCell>{fmtFecha(p.fecha_pago)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtBs(parseFloat(p.monto_pagado))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {p.metodo_pago}
                          </TableCell>
                          <TableCell>
                            {p.archivo_pdf_url ? (
                              <a
                                href={p.archivo_pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
                                {p.numero_comprobante ?? "Ver"}
                              </a>
                            ) : (
                              (p.numero_comprobante ?? "—")
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

      {/* Diálogo de recordatorio */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorio de pago</DialogTitle>
            <DialogDescription>
              Se enviará un correo al tutor con el saldo pendiente del
              estudiante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tutor destinatario</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tutor" />
                </SelectTrigger>
                <SelectContent>
                  {tutoresConCorreo.map((t) => (
                    <SelectItem key={t.id_tutor} value={String(t.id_tutor)}>
                      {t.nombre} {t.apellido} ({t.parentesco}) ·{" "}
                      {t.correo_electronico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="gap-2"
              onClick={enviarRecordatorio}
              disabled={!tutorId || enviando}
            >
              <Mail className="h-4 w-4" />
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
