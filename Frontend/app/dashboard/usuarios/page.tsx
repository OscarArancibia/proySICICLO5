"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserCog, Plus, MoreHorizontal, Edit, UserX, AlertCircle, Mail, Eye, EyeOff } from "lucide-react"
import { format } from "date-fns"
import { API_URL } from "@/lib/api"
import { PASSWORD_HINT, validatePasswordStrength } from "@/lib/password-policy"
import { toast } from "sonner"

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [formError, setFormError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    id: 0,
    username: "",
    email: "",
    password: "",
    id_rol: "",
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
      
      const resUsers = await fetch(`${API_URL}/api/users`, { headers })
      const resRoles = await fetch(`${API_URL}/api/roles`, { headers })
      
      const usersData = await resUsers.json().catch(() => null)
      const rolesData = await resRoles.json().catch(() => null)

      if (!resUsers.ok) throw new Error(usersData?.message || "Error al cargar usuarios")
      if (!resRoles.ok) throw new Error(rolesData?.message || "Error al cargar roles")

      setUsuarios(usersData)
      setRoles(rolesData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar datos")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    
    if (!formData.username || !formData.email || !formData.password || !formData.id_rol) {
      setFormError("Todos los campos marcados con * son obligatorios.")
      return
    }
    const passwordError = validatePasswordStrength(formData.password)
    if (passwordError) {
      setFormError(passwordError)
      return
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          id_rol: parseInt(formData.id_rol)
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Error al crear usuario")
        return
      }

      setIsCreateOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    
    if (!formData.username || !formData.email || !formData.id_rol) {
      setFormError("Username, Email y Rol son obligatorios.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/users/${formData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          id_rol: parseInt(formData.id_rol),
          estado: formData.estado
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || "Error al actualizar")
        return
      }

      setIsEditOpen(false)
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  const handleDeactivate = async (id: number) => {
    if (!confirm("¿Está seguro de desactivar este usuario?")) return

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Error al desactivar usuario")

      toast.success(data?.message || "Usuario desactivado correctamente")
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al desactivar usuario")
    }
  }

  const resetForm = () => {
    setFormData({ id: 0, username: "", email: "", password: "", id_rol: "", estado: true })
    setFormError("")
  }

  const openEditModal = (user: any) => {
    setFormData({
      id: user.id_usuario,
      username: user.username,
      email: user.email || "",
      password: "", // Not editable here
      id_rol: user.id_rol.toString(),
      estado: user.estado
    })
    setFormError("")
    setIsEditOpen(true)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <UserCog className="h-8 w-8 text-primary" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground mt-1">
            Administre los accesos al sistema, asigne roles y active/desactive cuentas.
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="h-4 w-4" /> Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Usuario</DialogTitle>
              <DialogDescription>
                Cree unas credenciales seguras para acceder al sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="create-username">Nombre de Usuario *</Label>
                <Input 
                  id="create-username" 
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="ej. perez_j"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-email">Correo Electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="create-email"
                    type="email"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-password">Contraseña *</Label>
                <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-rol">Asignar Rol *</Label>
                <Select value={formData.id_rol} onValueChange={(v) => setFormData({...formData, id_rol: v})}>
                  <SelectTrigger id="create-rol">
                    <SelectValue placeholder="Seleccione un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.estado).map(rol => (
                      <SelectItem key={rol.id_rol} value={rol.id_rol.toString()}>{rol.nombre_rol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifique los datos de la cuenta o el rol asignado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
            <div className="grid gap-2">
              <Label htmlFor="edit-username">Nombre de Usuario</Label>
              <Input 
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="edit-email"
                  type="email"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-rol">Rol del Sistema</Label>
              <Select value={formData.id_rol} onValueChange={(v) => setFormData({...formData, id_rol: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(rol => (
                    <SelectItem key={rol.id_rol} value={rol.id_rol.toString()}>{rol.nombre_rol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg mt-2">
              <div className="space-y-0.5">
                <Label>Activo en el Sistema</Label>
                <p className="text-xs text-muted-foreground">Desactivar impedirá que inicie sesión.</p>
              </div>
              <Switch checked={formData.estado} onCheckedChange={(c) => setFormData({...formData, estado: c})} />
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Actualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay usuarios registrados.</div>
            ) : (
              usuarios.map((usr) => (
                <div key={usr.id_usuario} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold truncate">{usr.username}</p>
                    <div className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${usr.estado ? 'border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20' : 'border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20'}`}>
                      {usr.estado ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground break-all">{usr.email || "—"}</p>
                  <p className="text-sm"><span className="font-medium">Rol:</span> {usr.nombre_rol}</p>
                  <div className="flex gap-2 pt-2">
                    {usr.id_rol !== 1 && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditModal(usr)} className="flex-1">Editar</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeactivate(usr.id_usuario)} className="flex-1">Desactivar</Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Usuario</TableHead>
                <TableHead className="hidden lg:table-cell">Correo</TableHead>
                <TableHead>Rol Asignado</TableHead>
                <TableHead className="hidden md:table-cell">Creación</TableHead>
                <TableHead className="hidden md:table-cell">Último Acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((usr) => (
                  <TableRow key={usr.id_usuario}>
                    <TableCell className="font-medium">{usr.username}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {usr.email || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-semibold">
                        {usr.nombre_rol}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground whitespace-nowrap">
                      {usr.fecha_creacion ? format(new Date(usr.fecha_creacion), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {usr.ultimo_acceso ? format(new Date(usr.ultimo_acceso), 'dd/MM HH:mm') : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${usr.estado ? 'border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20' : 'border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20'}`}>
                        {usr.estado ? 'Activo' : 'Inactivo'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {usr.id_rol !== 1 && ( // Impedir editar y eliminar a SuperUsuario para evitar fallas catastróficas
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(usr)}>
                              <Edit className="mr-2 h-4 w-4 text-blue-500" />
                              Editar Cuenta
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeactivate(usr.id_usuario)} className="text-destructive">
                              <UserX className="mr-2 h-4 w-4" />
                              Desactivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
