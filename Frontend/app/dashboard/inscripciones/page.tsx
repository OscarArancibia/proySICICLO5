"use client"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, Search, ArrowRightLeft, UserMinus, Upload } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { inscripcionesApi, estructuraApi, type Inscripcion, type Gestion, type CursoDetalle } from "@/lib/ciclo2Api"
import { estudiantesApi, type Estudiante } from "@/lib/ciclo2Api"
import { cursosApi } from "@/lib/ciclo2Api"

type DialogMode = "nueva" | "retirar" | "trasladar" | "masiva" | null

export default function InscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [gestFiltro, setGestFiltro] = useState("all")
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [cursos, setCursos] = useState<CursoDetalle[]>([])
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [mode, setMode] = useState<DialogMode>(null)
  const [selected, setSelected] = useState<Inscripcion | null>(null)
  const [form, setForm] = useState({ id_estudiante: 0, id_curso: 0, id_gestion: 0, motivo: "", estado: "retirado" as "retirado" | "trasladado", id_curso_destino: 0 })
  const [csvText, setCsvText] = useState("")
  const [csvResult, setCsvResult] = useState<{ exitosos: unknown[]; errores: unknown[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (gestFiltro && gestFiltro !== "all") params.id_gestion = gestFiltro
      const r = await inscripcionesApi.getAll(params)
      setInscripciones(r.inscripciones)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [gestFiltro])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    Promise.all([estructuraApi.getGestiones(), cursosApi.getAll()]).then(([gs, cs]) => {
      setGestiones(gs); setCursos(cs)
      const activa = gs.find(g => g.estado === "activa")
      if (activa) setForm(f => ({ ...f, id_gestion: activa.id_gestion }))
    })
  }, [])

  const searchEstudiantes = async (q: string) => {
    if (q.length < 2) return
    const r = await estudiantesApi.getAll({ search: q, estado: "activo" })
    setEstudiantes(r)
  }

  const handleInscribir = async () => {
    if (!form.id_estudiante || !form.id_curso || !form.id_gestion) return toast.error("Complete todos los campos")
    setSaving(true)
    try {
      const r = await inscripcionesApi.inscribir({ id_estudiante: form.id_estudiante, id_curso: form.id_curso, id_gestion: form.id_gestion })
      toast.success(r.message)
      if (r.advertencia) toast.warning(r.advertencia)
      setMode(null); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleRetirar = async () => {
    if (!selected || !form.motivo) return toast.error("El motivo es obligatorio")
    setSaving(true)
    try {
      await inscripcionesApi.retirar(selected.id_inscripcion, { estado: form.estado, motivo: form.motivo })
      toast.success("Estado actualizado")
      setMode(null); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleTrasladar = async () => {
    if (!selected || !form.id_curso_destino || !form.motivo) return toast.error("Complete todos los campos")
    setSaving(true)
    try {
      const r = await inscripcionesApi.trasladar(selected.id_inscripcion, { id_curso_destino: form.id_curso_destino, motivo: form.motivo })
      toast.success(r.message)
      setMode(null); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleMasiva = async () => {
    if (!csvText || !form.id_curso || !form.id_gestion) return toast.error("Complete todos los campos")
    setSaving(true)
    try {
      const r = await inscripcionesApi.masivaCsv({ id_curso: form.id_curso, id_gestion: form.id_gestion, csv_text: csvText })
      setCsvResult(r.resultados)
      toast.success(`${r.resumen.exitosos} inscritos, ${r.resumen.errores} errores`)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = { inscrito: "bg-green-100 text-green-700", retirado: "bg-red-100 text-red-700", trasladado: "bg-yellow-100 text-yellow-700", egresado: "bg-gray-100 text-gray-500" }
    return map[estado] ?? ""
  }

  const filtered = inscripciones.filter(i => (i.estudiante ?? "").toLowerCase().includes(search.toLowerCase()) || (i.estudiante_ci ?? "").includes(search))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-muted-foreground">{filtered.length} inscripciones</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setMode("masiva")} className="gap-2"><Upload className="h-4 w-4" />Masiva CSV</Button>
          <Button onClick={() => setMode("nueva")} className="gap-2"><Plus className="h-4 w-4" />Nueva Inscripción</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar estudiante o CI..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={gestFiltro} onValueChange={setGestFiltro}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todas las gestiones" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {gestiones.map(g => <SelectItem key={g.id_gestion} value={String(g.id_gestion)}>{g.anio}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center text-muted-foreground">Cargando...</div> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead><TableHead>CI</TableHead><TableHead>Curso</TableHead>
                    <TableHead>Turno</TableHead><TableHead>Gestión</TableHead><TableHead>Estado</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin inscripciones</TableCell></TableRow>
                  ) : filtered.map(i => (
                    <TableRow key={i.id_inscripcion}>
                      <TableCell className="font-medium">{i.estudiante}</TableCell>
                      <TableCell className="font-mono text-sm">{i.estudiante_ci ?? "—"}</TableCell>
                      <TableCell className="text-sm">{i.nombre_grado} {i.paralelo}</TableCell>
                      <TableCell><Badge variant="outline">{i.turno}</Badge></TableCell>
                      <TableCell>{i.anio}</TableCell>
                      <TableCell><Badge variant="secondary" className={estadoBadge(i.estado)}>{i.estado}</Badge></TableCell>
                      <TableCell>
                        {i.estado === "inscrito" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelected(i); setForm(f => ({ ...f, motivo: "", estado: "trasladado" })); setMode("trasladar") }}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />Trasladar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelected(i); setForm(f => ({ ...f, motivo: "", estado: "retirado" })); setMode("retirar") }} className="text-destructive">
                                <UserMinus className="h-4 w-4 mr-2" />Retirar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Dialog nueva inscripción */}
      <Dialog open={mode === "nueva"} onOpenChange={() => setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva Inscripción</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Buscar estudiante</Label>
              <Input placeholder="Nombre o CI..." onChange={e => searchEstudiantes(e.target.value)} />
              {estudiantes.length > 0 && (
                <Select value={String(form.id_estudiante)} onValueChange={v => setForm(f => ({ ...f, id_estudiante: +v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar estudiante" /></SelectTrigger>
                  <SelectContent>{estudiantes.map(e => <SelectItem key={e.id_estudiante} value={String(e.id_estudiante)}>{e.nombre} {e.apellido} — {e.ci ?? "sin CI"}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Gestión</Label>
              <Select value={String(form.id_gestion)} onValueChange={v => setForm(f => ({ ...f, id_gestion: +v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{gestiones.map(g => <SelectItem key={g.id_gestion} value={String(g.id_gestion)}>{g.anio} {g.estado === "activa" ? "✓" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Curso</Label>
              <Select value={String(form.id_curso)} onValueChange={v => setForm(f => ({ ...f, id_curso: +v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                <SelectContent>{cursos.map(c => <SelectItem key={c.id_curso} value={String(c.id_curso)}>{c.nombre_grado} {c.paralelo} – {c.turno} ({c.inscritos ?? 0}/{c.capacidad ?? "?"})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button>
            <Button onClick={handleInscribir} disabled={saving}>{saving ? "Inscribiendo..." : "Confirmar Inscripción"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog retirar */}
      <Dialog open={mode === "retirar"} onOpenChange={() => setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Retiro</DialogTitle><DialogDescription>{selected?.estudiante}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as "retirado" | "trasladado" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retirado">Retirado</SelectItem>
                  <SelectItem value="trasladado">Trasladado (sin curso destino)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Motivo *</Label><Textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ingrese el motivo..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRetirar} disabled={saving}>{saving ? "Procesando..." : "Confirmar Retiro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog trasladar */}
      <Dialog open={mode === "trasladar"} onOpenChange={() => setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Trasladar Estudiante</DialogTitle><DialogDescription>{selected?.estudiante}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Curso destino</Label>
              <Select value={String(form.id_curso_destino)} onValueChange={v => setForm(f => ({ ...f, id_curso_destino: +v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                <SelectContent>{cursos.filter(c => c.id_curso !== selected?.id_curso).map(c => <SelectItem key={c.id_curso} value={String(c.id_curso)}>{c.nombre_grado} {c.paralelo} – {c.turno}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Motivo *</Label><Textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Motivo del traslado..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button>
            <Button onClick={handleTrasladar} disabled={saving}>{saving ? "Procesando..." : "Confirmar Traslado"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog masiva CSV */}
      <Dialog open={mode === "masiva"} onOpenChange={() => { setMode(null); setCsvResult(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Inscripción Masiva CSV</DialogTitle><DialogDescription>CSV con columna &quot;ci&quot; requerida</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gestión</Label>
                <Select value={String(form.id_gestion)} onValueChange={v => setForm(f => ({ ...f, id_gestion: +v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{gestiones.map(g => <SelectItem key={g.id_gestion} value={String(g.id_gestion)}>{g.anio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Curso destino</Label>
                <Select value={String(form.id_curso)} onValueChange={v => setForm(f => ({ ...f, id_curso: +v }))}>
                  <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
                  <SelectContent>{cursos.map(c => <SelectItem key={c.id_curso} value={String(c.id_curso)}>{c.nombre_grado} {c.paralelo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Contenido CSV</Label>
              <Textarea rows={6} placeholder={"ci,nombre\n12345678,Juan Perez\n87654321,Maria Lopez"} value={csvText} onChange={e => setCsvText(e.target.value)} className="font-mono text-sm" />
            </div>
            {csvResult && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <p className="font-semibold">Resultados: {(csvResult.exitosos as unknown[]).length} exitosos, {(csvResult.errores as unknown[]).length} errores</p>
                {(csvResult.errores as { fila: number; ci: string; error: string }[]).map((e, i) => (
                  <p key={i} className="text-destructive">Fila {e.fila} (CI {e.ci}): {e.error}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMode(null); setCsvResult(null) }}>Cerrar</Button>
            <Button onClick={handleMasiva} disabled={saving}>{saving ? "Procesando..." : "Procesar CSV"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
