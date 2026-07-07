"use client"

import { useEffect, useMemo, useState } from "react"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { History, RefreshCcw, Search } from "lucide-react"

type BitacoraRow = {
  id_bitacora: number
  username: string | null
  nombre_modulo: string | null
  metodo: string | null
  accion: string
  tabla_afectada: string | null
  id_registro_afectado: number | null
  descripcion: string | null
  fecha_hora: string
  ip_origen: string | null
}

type Filtros = {
  acciones: string[]
  modulos: { id_modulo: number; nombre_modulo: string }[]
  usuarios: { id_usuario: number; username: string }[]
}

export default function BitacoraPage() {
  const [rows, setRows] = useState<BitacoraRow[]>([])
  const [filtros, setFiltros] = useState<Filtros>({ acciones: [], modulos: [], usuarios: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [accion, setAccion] = useState("todos")
  const [idModulo, setIdModulo] = useState("todos")
  const [idUsuario, setIdUsuario] = useState("todos")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (accion !== "todos") params.set("accion", accion)
    if (idModulo !== "todos") params.set("id_modulo", idModulo)
    if (idUsuario !== "todos") params.set("id_usuario", idUsuario)
    if (fechaDesde) params.set("fecha_desde", fechaDesde)
    if (fechaHasta) params.set("fecha_hasta", fechaHasta)
    params.set("limit", "200")
    return params.toString()
  }, [search, accion, idModulo, idUsuario, fechaDesde, fechaHasta])

  const getHeaders = () => {
    const token = localStorage.getItem("token")
    return { Authorization: `Bearer ${token}` }
  }

  const fetchFiltros = async () => {
    const res = await fetch(`${API_URL}/api/bitacora/filtros`, { headers: getHeaders() })
    if (res.ok) setFiltros(await res.json())
  }

  const fetchBitacora = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_URL}/api/bitacora?${queryString}`, { headers: getHeaders() })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "No se pudo cargar la bitácora.")
        setRows([])
        return
      }
      setRows(data.bitacora || [])
    } catch {
      setError("Error de conexión con el servidor.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiltros()
  }, [])

  useEffect(() => {
    fetchBitacora()
  }, [queryString])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 text-3xl font-bold tracking-tight">
            <History className="h-8 w-8 text-primary" />
            Bitácora
          </h1>
          <p className="mt-1 text-muted-foreground">Auditoría de accesos, cambios y eventos sensibles del sistema.</p>
        </div>
        <Button variant="outline" onClick={fetchBitacora} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Consulta eventos por usuario, módulo, acción o rango de fechas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Usuario, tabla, módulo..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Acción</Label>
            <Select value={accion} onValueChange={setAccion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filtros.acciones.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Módulo</Label>
            <Select value={idModulo} onValueChange={setIdModulo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {filtros.modulos.map(m => <SelectItem key={m.id_modulo} value={String(m.id_modulo)}>{m.nombre_modulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <Select value={idUsuario} onValueChange={setIdUsuario}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {filtros.usuarios.map(u => <SelectItem key={u.id_usuario} value={String(u.id_usuario)}>{u.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-lg">Eventos Registrados</CardTitle>
          <CardDescription>{rows.length} registros visibles.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando bitácora...</TableCell></TableRow>
                ) : error ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">{error}</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay eventos para los filtros seleccionados.</TableCell></TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id_bitacora}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(row.fecha_hora).toLocaleString("es-BO")}
                      </TableCell>
                      <TableCell className="font-medium">{row.username || "Sistema"}</TableCell>
                      <TableCell>{row.nombre_modulo || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{row.accion}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.tabla_afectada || "-"}
                        {row.id_registro_afectado ? <span className="text-muted-foreground"> #{row.id_registro_afectado}</span> : null}
                      </TableCell>
                      <TableCell className="min-w-[260px] max-w-[420px]">
                        <div className="space-y-1">
                          <p className="text-sm">{row.descripcion || "-"}</p>
                          {row.metodo && <p className="text-xs text-muted-foreground">{row.metodo}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{row.ip_origen || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
