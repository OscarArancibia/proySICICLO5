"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { BookOpen, Plus, AlertCircle, Bookmark } from "lucide-react"
import { API_URL } from "@/lib/api"
import { toast } from "sonner"

export default function MateriasPage() {
  const [materias, setMaterias] = useState<any[]>([])
  const [campos, setCampos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modals state
  const [isCampoOpen, setIsCampoOpen] = useState(false)
  const [isMateriaOpen, setIsMateriaOpen] = useState(false)
  const [formError, setFormError] = useState("")

  // Form states
  const [campoData, setCampoData] = useState({ nombre_campo: "", orden_visualizacion: 1 })
  const [materiaData, setMateriaData] = useState({
    nombre_materia: "",
    descripcion: "",
    id_campo: "",
    aplica_primaria: true,
    estado: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }
      
      const resCampos = await fetch(`${API_URL}/api/materias/campos`, { headers })
      const resMaterias = await fetch(`${API_URL}/api/materias`, { headers })
      
      const camposData = await resCampos.json().catch(() => null)
      const materiasData = await resMaterias.json().catch(() => null)

      if (!resCampos.ok) throw new Error(camposData?.message || "Error al cargar campos")
      if (!resMaterias.ok) throw new Error(materiasData?.message || "Error al cargar materias")

      setCampos(camposData)
      setMaterias(materiasData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar datos")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCampo = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    
    if (!campoData.nombre_campo) {
      setFormError("Nombre de campo es obligatorio.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/materias/campos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(campoData)
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Error al crear campo")
        return
      }

      setIsCampoOpen(false)
      setCampoData({ nombre_campo: "", orden_visualizacion: 1 })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  const handleCreateMateria = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    
    if (!materiaData.nombre_materia || !materiaData.id_campo) {
      setFormError("Nombre y Campo son obligatorios.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/materias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...materiaData,
          id_campo: parseInt(materiaData.id_campo)
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Error al crear materia")
        return
      }

      setIsMateriaOpen(false)
      setMateriaData({ nombre_materia: "", descripcion: "", id_campo: "", aplica_primaria: true, estado: true })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Curricula y Materias
          </h1>
          <p className="text-muted-foreground mt-1">
            Organice las asignaturas y los campos del saber que se imparten en la Unidad Educativa.
          </p>
        </div>
      </div>

      <Tabs defaultValue="materias" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
          <TabsTrigger value="materias">Materias / Asignaturas</TabsTrigger>
          <TabsTrigger value="campos">Campos Curriculares</TabsTrigger>
        </TabsList>
        
        {/* PESTAÑA: MATERIAS */}
        <TabsContent value="materias" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isMateriaOpen} onOpenChange={setIsMateriaOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 gap-2">
                  <Plus className="h-4 w-4" /> Agregar Materia
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Materia</DialogTitle>
                  <DialogDescription>
                    Registre una asignatura y clasifíquela según el campo del saber al que pertenece.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateMateria} className="space-y-4 pt-4">
                  {formError && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> {formError}
                    </div>
                  )}
                  
                  <div className="grid gap-2">
                    <Label>Nombre de Asignatura *</Label>
                    <Input 
                      value={materiaData.nombre_materia}
                      onChange={(e) => setMateriaData({...materiaData, nombre_materia: e.target.value})}
                      placeholder="Ej. Física Fundamental"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Campo de Saber Perteneciente *</Label>
                    <Select value={materiaData.id_campo} onValueChange={(v) => setMateriaData({...materiaData, id_campo: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione campo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campos.map(c => (
                          <SelectItem key={c.id_campo} value={c.id_campo.toString()}>{c.nombre_campo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Descripción Breve</Label>
                    <Textarea 
                      value={materiaData.descripcion}
                      onChange={(e) => setMateriaData({...materiaData, descripcion: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label className="cursor-pointer">Aplica para Primaria Comunitaria Vocacional</Label>
                    <Switch checked={materiaData.aplica_primaria} onCheckedChange={(c) => setMateriaData({...materiaData, aplica_primaria: c})} />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button variant="outline" type="button" onClick={() => setIsMateriaOpen(false)}>Cancelar</Button>
                    <Button type="submit">Guardar Asignatura</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="space-y-3 p-4 md:hidden">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando materias...</div>
                ) : materias.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No hay materias creadas.</div>
                ) : (
                  materias.map((m) => (
                    <div key={m.id_materia} className="rounded-lg border p-4 space-y-2">
                      <p className="font-semibold text-primary">{m.nombre_materia}</p>
                      <p className="text-sm"><span className="font-medium">Campo:</span> {m.nombre_campo}</p>
                      <p className="text-sm text-muted-foreground">{m.descripcion || "-"}</p>
                      <span className={`inline-flex text-xs px-2 py-1 rounded-full ${m.aplica_primaria ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                        {m.aplica_primaria ? "Ambos Niveles" : "Solo Secundaria"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Materia</TableHead>
                    <TableHead>Campo del Saber</TableHead>
                    <TableHead className="hidden md:table-cell">Descripción</TableHead>
                    <TableHead>Niveles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground border-b-0">
                        Cargando materias...
                      </TableCell>
                    </TableRow>
                  ) : materias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground border-b-0">
                        No hay materias creadas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    materias.map((m) => (
                      <TableRow key={m.id_materia}>
                        <TableCell className="font-semibold text-primary">{m.nombre_materia}</TableCell>
                        <TableCell>
                          <div className="inline-flex items-center text-xs px-2 py-1 bg-secondary/40 border border-secondary rounded text-secondary-foreground">
                            {m.nombre_campo}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm truncate max-w-[200px]">
                          {m.descripcion || "-"}
                        </TableCell>
                        <TableCell>
                           {m.aplica_primaria ? (
                             <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Ambos Niveles</span>
                           ) : (
                             <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Solo Secundaria</span>
                           )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA: CAMPOS */}
        <TabsContent value="campos" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isCampoOpen} onOpenChange={setIsCampoOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 gap-2" variant="secondary">
                  <Bookmark className="h-4 w-4" /> Nuevo Campo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Añadir Campo del Saber</DialogTitle>
                  <DialogDescription>
                    Agregue agrupaciones formales para las materias según el currículo nacional.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCampo} className="space-y-4 pt-4">
                  {formError && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> {formError}
                    </div>
                  )}
                  
                  <div className="grid gap-2">
                    <Label>Nombre del Campo *</Label>
                    <Input 
                      value={campoData.nombre_campo}
                      onChange={(e) => setCampoData({...campoData, nombre_campo: e.target.value})}
                      placeholder="Ej. Cosmos y Pensamiento"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Orden Visual (Prioridad) *</Label>
                    <Input 
                      type="number" min="1"
                      value={campoData.orden_visualizacion}
                      onChange={(e) => setCampoData({...campoData, orden_visualizacion: parseInt(e.target.value)})}
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button variant="outline" type="button" onClick={() => setIsCampoOpen(false)}>Cancelar</Button>
                    <Button type="submit">Añadir Campo</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Cargando campos...</div>
            ) : campos.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">No hay campos configurados.</div>
            ) : (
                campos.map(c => (
                  <Card key={c.id_campo} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg leading-tight">{c.nombre_campo}</CardTitle>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Ord.{c.orden_visualizacion}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">ID Interno: {c.id_campo}</p>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
