"use client"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, FileDown, AlertTriangle, CheckCircle2, User, BookOpen, CalendarDays, Users, CreditCard } from "lucide-react"
import { expedienteApi, estudiantesApi, type Estudiante, type Expediente } from "@/lib/ciclo2Api"

function ExpedientesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQ, setSearchQ] = useState("")
  const [results, setResults] = useState<Estudiante[]>([])
  const [searching, setSearching] = useState(false)
  const [expediente, setExpediente] = useState<Expediente | null>(null)
  const [loadingExp, setLoadingExp] = useState(false)
  const [userRole, setUserRole] = useState<number>(1)

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    if (role) setUserRole(+role)
    const id = searchParams.get("id")
    if (id) loadExpediente(+id)
  }, [searchParams])

  const doSearch = async (q: string) => {
    setSearchQ(q)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try { setResults(await estudiantesApi.getAll({ search: q })) }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSearching(false) }
  }

  const loadExpediente = async (id: number) => {
    setLoadingExp(true)
    try { setExpediente(await expedienteApi.get(id)); setResults([]) }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error al cargar expediente") }
    finally { setLoadingExp(false) }
  }

  const handleExportPdf = async () => {
    if (!expediente) return
    try {
      const res = await expedienteApi.exportarPdf(expediente.datos_personales.id_estudiante)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `expediente_${expediente.datos_personales.apellido}.pdf`; a.click()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error al generar PDF") }
  }

  const est = expediente?.datos_personales
  const estadoColor = (s: string) => ({ activo: "bg-green-100 text-green-700", inactivo: "bg-red-100 text-red-700", retirado: "bg-yellow-100 text-yellow-700", egresado: "bg-gray-100 text-gray-600" })[s] ?? ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expedientes Digitales</h1>
          <p className="text-muted-foreground">Búsqueda y consulta de expedientes académicos</p>
        </div>
        {expediente && (
          <Button onClick={handleExportPdf} className="gap-2"><FileDown className="h-4 w-4" />Exportar PDF</Button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar estudiante por nombre o CI..." className="pl-9 text-base" value={searchQ} onChange={e => doSearch(e.target.value)} />
      </div>

      {/* Resultados de búsqueda */}
      {results.length > 0 && (
        <Card>
          <CardContent className="p-2">
            {results.map(e => (
              <button key={e.id_estudiante} className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted text-left transition-colors" onClick={() => loadExpediente(e.id_estudiante)}>
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{e.nombre[0]}{e.apellido[0]}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{e.nombre} {e.apellido}</p>
                  <p className="text-xs text-muted-foreground">CI: {e.ci ?? "—"}</p>
                </div>
                <Badge variant="secondary" className={estadoColor(e.estado)}>{e.estado}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      {searching && <p className="text-center text-muted-foreground text-sm">Buscando...</p>}

      {/* Expediente */}
      {loadingExp && <div className="py-12 text-center text-muted-foreground">Cargando expediente...</div>}

      {expediente && est && (
        <div className="space-y-4">
          {/* Header estudiante */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{est.nombre[0]}{est.apellido[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <h2 className="text-xl font-bold">{est.nombre} {est.apellido}</h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>CI: {est.ci ?? "No registrado"}</span>
                  <span>·</span>
                  <span>RUDE: {est.rude ?? "No registrado"}</span>
                  <span>·</span>
                  <span>Género: {est.genero}</span>
                  {est.edad && <><span>·</span><span>{est.edad} años</span></>}
                </div>
              </div>
              <Badge variant="secondary" className={`text-sm ${estadoColor(est.estado)}`}>{est.estado.toUpperCase()}</Badge>
            </CardContent>
          </Card>

          <Tabs defaultValue="personal">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="personal" className="gap-1"><User className="h-3.5 w-3.5" />Personal</TabsTrigger>
              <TabsTrigger value="inscripciones" className="gap-1"><BookOpen className="h-3.5 w-3.5" />Inscripciones</TabsTrigger>
              <TabsTrigger value="tutores" className="gap-1"><Users className="h-3.5 w-3.5" />Tutores</TabsTrigger>
              <TabsTrigger value="asistencias" className="gap-1"><CalendarDays className="h-3.5 w-3.5" />Asistencias</TabsTrigger>
              <TabsTrigger value="calificaciones" className="gap-1"><BookOpen className="h-3.5 w-3.5" />Calificaciones</TabsTrigger>
              {(userRole === 1 || userRole === 2 || userRole === 4) && (
                <TabsTrigger value="pagos" className="gap-1"><CreditCard className="h-3.5 w-3.5" />Pagos</TabsTrigger>
              )}
            </TabsList>

            {/* Datos Personales */}
            <TabsContent value="personal">
              <Card><CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                {[["Nombre", est.nombre], ["Apellido", est.apellido], ["CI", est.ci ?? "—"], ["RUDE", est.rude ?? "—"], ["Género", est.genero], ["Edad", est.edad ? `${est.edad} años` : "—"], ["Fecha nacimiento", est.fecha_nacimiento ? new Date(est.fecha_nacimiento).toLocaleDateString("es-BO") : "—"], ["Estado", est.estado], ["Observaciones", est.observaciones ?? "—"]].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </CardContent></Card>
            </TabsContent>

            {/* Inscripciones */}
            <TabsContent value="inscripciones">
              <Card><CardContent className="p-4">
                {expediente.inscripciones.length === 0 ? <p className="text-muted-foreground text-sm">Sin inscripciones</p> : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Gestión</TableHead><TableHead>Grado</TableHead><TableHead>Paralelo</TableHead><TableHead>Turno</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {expediente.inscripciones.map(i => (
                          <TableRow key={i.id_inscripcion}>
                            <TableCell>{i.anio}</TableCell>
                            <TableCell>{i.nombre_grado}</TableCell>
                            <TableCell>{i.paralelo}</TableCell>
                            <TableCell><Badge variant="outline">{i.turno}</Badge></TableCell>
                            <TableCell><Badge variant="secondary">{i.estado}</Badge></TableCell>
                            <TableCell className="text-sm">{i.fecha_inscripcion ? new Date(i.fecha_inscripcion).toLocaleDateString("es-BO") : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>

            {/* Tutores */}
            <TabsContent value="tutores">
              <Card><CardContent className="p-4 space-y-3">
                {expediente.tutores.length === 0 ? <p className="text-muted-foreground text-sm">Sin tutores registrados</p> : expediente.tutores.map(t => (
                  <div key={t.id_tutor} className="flex items-start gap-3 rounded-lg border p-3">
                    <Avatar className="h-10 w-10"><AvatarFallback className="bg-secondary text-secondary-foreground">{t.nombre[0]}{t.apellido[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{t.nombre} {t.apellido} <span className="text-muted-foreground">({t.parentesco})</span></p>
                      <p className="text-muted-foreground">CI: {t.ci} · Tel: {t.telefono ?? "—"}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {t.autorizado_recoger && <Badge className="bg-green-100 text-green-700 text-xs">Autorizado recoger</Badge>}
                      {t.contacto_emergencia && <Badge className="bg-red-100 text-red-700 text-xs">Emergencia</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent></Card>
            </TabsContent>

            {/* Asistencias */}
            <TabsContent value="asistencias">
              <div className="space-y-3">
                {expediente.asistencias.length === 0 ? <Card><CardContent className="p-4 text-muted-foreground text-sm">Sin registros de asistencia</CardContent></Card>
                : expediente.asistencias.map(a => (
                  <Card key={a.id_curso} className={a.alerta_inasistencia ? "border-destructive/50" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{a.nombre_grado} {a.paralelo} — {a.anio}</p>
                          <p className="text-xs text-muted-foreground">{a.total_dias} días registrados</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${a.alerta_inasistencia ? "text-destructive" : "text-green-600"}`}>{a.porcentaje_asistencia}%</p>
                          {a.alerta_inasistencia && <div className="flex items-center gap-1 text-destructive text-xs"><AlertTriangle className="h-3 w-3" />Por debajo del 80%</div>}
                        </div>
                      </div>
                      <Progress value={a.porcentaje_asistencia} className={a.alerta_inasistencia ? "[&>div]:bg-destructive" : "[&>div]:bg-green-500"} />
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        {[["Presentes", a.presentes, "text-green-600"], ["Ausentes", a.ausentes, "text-red-600"], ["Tardanzas", a.tardanzas, "text-yellow-600"], ["Justificados", a.justificados, "text-blue-600"]].map(([l, v, c]) => (
                          <div key={String(l)}><p className={`font-bold text-lg ${c}`}>{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Calificaciones */}
            <TabsContent value="calificaciones">
              {expediente.calificaciones.length === 0 ? <Card><CardContent className="p-4 text-muted-foreground text-sm">Sin calificaciones registradas</CardContent></Card>
              : expediente.calificaciones.map(g => (
                <div key={g.anio} className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Gestión {g.anio}</h3>
                  {g.materias.map(m => (
                    <Card key={m.id_materia}>
                      <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm">{m.nombre_materia} <span className="text-muted-foreground font-normal">({m.campo})</span></CardTitle></CardHeader>
                      <CardContent className="px-4 pb-4">
                        <div className="grid gap-2">
                          {m.trimestres.map(t => (
                            <div key={t.trimestre}>
                              <p className="text-xs text-muted-foreground mb-1">Trimestre {t.trimestre}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {t.dimensiones.map(d => (
                                  <div key={d.dimension} className="rounded border p-2 text-sm">
                                    <p className="text-xs text-muted-foreground">{d.dimension}</p>
                                    <p className="font-semibold">{d.total_obtenido}<span className="text-muted-foreground font-normal text-xs">/{d.puntaje_maximo}</span></p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </TabsContent>

            {/* Pagos */}
            {(userRole === 1 || userRole === 2 || userRole === 4) && (
              <TabsContent value="pagos">
                <Card><CardContent className="p-4">
                  {expediente.pagos.length === 0 ? <p className="text-muted-foreground text-sm">Sin registros de pago</p> : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Mes</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead><TableHead>Fecha pago</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {expediente.pagos.map(p => (
                            <TableRow key={p.id_deuda}>
                              <TableCell>{p.nombre_concepto}</TableCell>
                              <TableCell>{p.mes}</TableCell>
                              <TableCell className="font-mono">Bs. {p.monto_deuda}</TableCell>
                              <TableCell><Badge variant="secondary" className={p.estado_deuda === "pagado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{p.estado_deuda}</Badge></TableCell>
                              <TableCell className="text-sm">{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-BO") : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent></Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {!expediente && !loadingExp && !searching && searchQ.length < 2 && (
        <div className="py-24 text-center space-y-3">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Ingrese el nombre o CI del estudiante para buscar su expediente</p>
        </div>
      )}
    </div>
  )
}

export default function ExpedientesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Cargando expedientes...</div>}>
      <ExpedientesContent />
    </Suspense>
  )
}
