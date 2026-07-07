"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Shield, Plus, Trash2, ShieldCheck, AlertCircle } from "lucide-react"
import { API_URL } from "@/lib/api"
import { toast } from "sonner"

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([])
  const [permisos, setPermisos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form state
  const [nombreRol, setNombreRol] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [selectedFuncionalidades, setSelectedFuncionalidades] = useState<number[]>([])
  const [formError, setFormError] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }
      
      const resRoles = await fetch(`${API_URL}/api/roles`, { headers })
      const resPermisos = await fetch(`${API_URL}/api/roles/permisos`, { headers })
      
      const rolesData = await resRoles.json().catch(() => null)
      const permisosData = await resPermisos.json().catch(() => null)

      if (!resRoles.ok) throw new Error(rolesData?.message || "Error al cargar roles")
      if (!resPermisos.ok) throw new Error(permisosData?.message || "Error al cargar permisos")

      setRoles(rolesData)
      setPermisos(permisosData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar datos")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    
    if (!nombreRol || selectedFuncionalidades.length === 0) {
      setFormError("El nombre del rol y al menos una funcionalidad son requeridos.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_rol: nombreRol,
          descripcion,
          funcionalidades: selectedFuncionalidades
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Error al crear el rol")
        return
      }

      setIsDialogOpen(false)
      setNombreRol("")
      setDescripcion("")
      setSelectedFuncionalidades([])
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  const handleDeleteRole = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este rol? Esta acción no se puede deshacer y fallará si hay usuarios activos con este rol.")) return

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/roles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Error al eliminar el rol")
      } else {
        toast.success(data.message || "Rol eliminado correctamente")
        fetchData()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar el rol")
    }
  }

  const toggleFuncionalidad = (id: number) => {
    setSelectedFuncionalidades(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  // Agrupar permisos por módulo para UI
  const modulos = Array.from(new Set(permisos.map(p => p.modulo)))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Roles y Permisos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestione los niveles de acceso y autoridades del sistema.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="h-4 w-4" /> Nuevo Rol
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Rol</DialogTitle>
              <DialogDescription>
                Defina el nombre del rol y seleccione los accesos permitidos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRole} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre del Rol *</Label>
                <Input 
                  id="nombre" 
                  value={nombreRol}
                  onChange={(e) => setNombreRol(e.target.value)}
                  placeholder="Ej. Secretaria"
                  maxLength={50}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea 
                  id="descripcion" 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Responsabilidades de este rol..."
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label>Funcionalidades del Sistema *</Label>
                <div className="border rounded-md p-4 space-y-4">
                  {modulos.map(modulo => (
                    <div key={modulo} className="space-y-2">
                      <h4 className="font-medium text-sm text-primary capitalize">{modulo}</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {permisos.filter(p => p.modulo === modulo).map(permiso => (
                          <div key={`${modulo}-${permiso.id_permiso}`} className="rounded-md border p-3 space-y-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{permiso.nombre_permiso}</p>
                              {permiso.descripcion && (
                                <p className="text-xs text-muted-foreground">{permiso.descripcion}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {permiso.funcionalidades?.map((funcionalidad: any) => (
                                <div key={funcionalidad.id_funcionalidad} className="flex items-start space-x-2 rounded-md bg-muted/40 p-2">
                                  <Checkbox
                                    id={`funcionalidad-${funcionalidad.id_funcionalidad}`}
                                    checked={selectedFuncionalidades.includes(funcionalidad.id_funcionalidad)}
                                    onCheckedChange={() => toggleFuncionalidad(funcionalidad.id_funcionalidad)}
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0 space-y-1">
                                    <Label
                                      htmlFor={`funcionalidad-${funcionalidad.id_funcionalidad}`}
                                      className="text-xs font-normal cursor-pointer"
                                    >
                                      {funcionalidad.descripcion || funcionalidad.metodo}
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground break-all">
                                      {funcionalidad.metodo}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar Rol</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg">Roles Configurados</CardTitle>
          <CardDescription>
            Lista de roles con la cantidad de autoridades asignadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando roles...</div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay roles configurados.</div>
            ) : (
              roles.map((rol) => (
                <div key={rol.id_rol} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{rol.nombre_rol}</p>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rol.estado ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {rol.estado ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{rol.descripcion || "-"}</p>
                  <p className="text-sm"><span className="font-medium">Funcionalidades:</span> {rol.cantidad_funcionalidades ?? 0}</p>
                  {rol.id_rol !== 1 && (
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteRole(rol.id_rol)} className="w-full">
                      Eliminar
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Descripción</TableHead>
                <TableHead>Funcionalidades</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando roles...
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay roles configurados.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((rol) => (
                  <TableRow key={rol.id_rol}>
                    <TableCell className="font-medium text-muted-foreground">#{rol.id_rol}</TableCell>
                    <TableCell className="font-medium">{rol.nombre_rol}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                      {rol.descripcion || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {rol.cantidad_funcionalidades ?? 0} metodos
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rol.estado ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {rol.estado ? 'Activo' : 'Inactivo'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {rol.id_rol !== 1 && ( // No permitir eliminar SuperUsuario base
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteRole(rol.id_rol)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
    </div>
  )
}
