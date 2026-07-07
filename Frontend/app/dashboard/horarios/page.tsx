"use client"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Clock, Plus, Trash2, CheckCircle2, Calendar } from "lucide-react"
import { horariosApi, materiaAsigApi, cursosApi, estructuraApi, type BloqueHorario, type CursoDetalle } from "@/lib/ciclo2Api"

const DIAS = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
]
const COLORES: Record<string, string> = {
  lunes: "bg-blue-100 text-blue-700 border-blue-200",
  martes: "bg-purple-100 text-purple-700 border-purple-200",
  miercoles: "bg-green-100 text-green-700 border-green-200",
  jueves: "bg-orange-100 text-orange-700 border-orange-200",
  viernes: "bg-pink-100 text-pink-700 border-pink-200",
}

export default function HorariosPage() {
  const [cursos, setCursos] = useState<CursoDetalle[]>([])
  const [idCurso, setIdCurso] = useState<number>(0)
  const [horario, setHorario] = useState<BloqueHorario[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editBloque, setEditBloque] = useState<BloqueHorario | null>(null)
  const [form, setForm] = useState({ id_materia: 0, dia_semana: "", hora_inicio: "", hora_fin: "", actividad: "" })
  const [saving, setSaving] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [materias, setMaterias] = useState<{ id_materia: number; nombre_materia: string }[]>([])

  useEffect(() => { cursosApi.getAll().then(setCursos) }, [])

  const loadMaterias = useCallback(async () => {
    if (!idCurso) { setMaterias([]); return }
    try {
      const data = await materiaAsigApi.getMaterias(idCurso)
      setMaterias(data.asignadas.map(m => ({ id_materia: m.id_materia, nombre_materia: m.nombre_materia })))
    } catch (e: unknown) {
      console.error("Error al cargar materias:", e)
      setMaterias([])
    }
  }, [idCurso])

  useEffect(() => { loadMaterias() }, [loadMaterias])

  const loadHorario = useCallback(async () => {
    if (!idCurso) return
    setLoading(true)
    try {
      const bloques = await horariosApi.getByCurso(idCurso)
      setHorario(bloques)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [idCurso])

  useEffect(() => { loadHorario() }, [loadHorario])

  const openAdd = (dia: string) => {
    setEditBloque(null)
    setForm({ id_materia: 0, dia_semana: dia, hora_inicio: "", hora_fin: "", actividad: "" })
    setShowDialog(true)
  }
  const openEdit = (b: BloqueHorario) => {
    setEditBloque(b)
    setForm({
      id_materia: b.id_materia ?? 0,
      dia_semana: b.dia_semana,
      hora_inicio: b.hora_inicio.slice(0, 5),
      hora_fin: b.hora_fin.slice(0, 5),
      actividad: b.actividad ?? "",
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.dia_semana || !form.hora_inicio || !form.hora_fin) return toast.error("Día y horario son obligatorios")
    if (form.hora_fin <= form.hora_inicio) return toast.error("La hora fin debe ser posterior a la hora inicio")
    setSaving(true)
    try {
      const payload = { id_curso: idCurso, dia_semana: form.dia_semana, hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, id_materia: form.id_materia || undefined, actividad: form.actividad || undefined }
      if (editBloque) {
        await horariosApi.update(editBloque.id_horario, payload)
        toast.success("Bloque actualizado")
      } else {
        await horariosApi.create(payload)
        toast.success("Bloque agregado")
      }
      setShowDialog(false); loadHorario()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este bloque?")) return
    try { await horariosApi.delete(id); toast.success("Bloque eliminado"); loadHorario() }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
  }

  const handlePublicar = async () => {
    if (!idCurso) return
    setPublicando(true)
    try {
      const r = await horariosApi.publicar(idCurso)
      toast.success(r.message)
      loadHorario()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setPublicando(false) }
  }

  const bloquesPorDia = (dia: string) => horario.filter(h => h.dia_semana === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  const curso = cursos.find(c => c.id_curso === idCurso)
  const allPublicado = horario.length > 0 && horario.every(h => h.publicado)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Horarios</h1>
          <p className="text-muted-foreground">Grilla semanal por curso</p>
        </div>
        {idCurso > 0 && (
          <Button onClick={handlePublicar} disabled={publicando || allPublicado} variant={allPublicado ? "secondary" : "default"} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />{allPublicado ? "Horario publicado" : publicando ? "Publicando..." : "Publicar Horario"}
          </Button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Select value={String(idCurso)} onValueChange={v => setIdCurso(+v)}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Seleccionar curso..." /></SelectTrigger>
          <SelectContent>
            {cursos.map(c => <SelectItem key={c.id_curso} value={String(c.id_curso)}>{c.nombre_grado} {c.paralelo} — {c.turno}</SelectItem>)}
          </SelectContent>
        </Select>
        {curso && <Badge variant="outline" className="text-sm">{curso.turno}</Badge>}
      </div>

      {!idCurso ? (
        <div className="py-24 text-center space-y-3">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Seleccione un curso para ver su horario</p>
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-muted-foreground">Cargando horario...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {DIAS.map(dia => (
            <Card key={dia.value} className="flex flex-col">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold">{dia.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 flex-1 space-y-2">
                {bloquesPorDia(dia.value).map(b => (
                  <div key={b.id_horario} className={`rounded-md border p-2 text-xs cursor-pointer group relative ${COLORES[dia.value]}`} onClick={() => openEdit(b)}>
                    <div className="flex items-center gap-1 font-semibold">
                      <Clock className="h-3 w-3" />{b.hora_inicio}–{b.hora_fin}
                    </div>
                    <p className="mt-0.5 truncate">{b.nombre_materia ?? b.actividad ?? "Actividad"}</p>
                    {b.profesor && <p className="text-[10px] opacity-70 truncate">{b.profesor}</p>}
                    {b.publicado && <span className="absolute top-1 right-1 text-[10px]">✓</span>}
                    <button className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={ev => { ev.stopPropagation(); handleDelete(b.id_horario) }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs border border-dashed" onClick={() => openAdd(dia.value)}>
                  <Plus className="h-3 w-3 mr-1" />Agregar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editBloque ? "Editar Bloque" : "Nuevo Bloque"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Día</Label>
              <Select value={form.dia_semana} onValueChange={v => setForm(f => ({ ...f, dia_semana: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Hora inicio</Label><Input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Hora fin</Label><Input type="time" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} /></div>
            </div>
            {materias.length > 0 && (
              <div className="space-y-1">
                <Label>Materia (opcional)</Label>
                <Select value={String(form.id_materia || 0)} onValueChange={v => setForm(f => ({ ...f, id_materia: parseInt(v) || 0 }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar materia..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sin materia</SelectItem>
                    {materias.map(m => <SelectItem key={m.id_materia} value={String(m.id_materia)}>{m.nombre_materia}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {materias.length === 0 && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ℹ️ No hay materias asignadas a este curso. Asigna materias primero.
              </div>
            )}
            <div className="space-y-1"><Label>Actividad libre (opcional)</Label><Input placeholder="Recreo, Educación Física..." value={form.actividad} onChange={e => setForm(f => ({ ...f, actividad: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
