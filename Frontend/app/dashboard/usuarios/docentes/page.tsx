"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { GraduationCap, Plus, AlertCircle, Mail, FileText, Edit, MoreHorizontal, UserPlus, CheckCircle2 } from "lucide-react"
import { API_URL } from "@/lib/api"
import { PASSWORD_HINT, validatePasswordStrength } from "@/lib/password-policy"
import { toast } from "sonner"

export default function DocentesPage() {
  const [profesores, setProfesores] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [formError, setFormError] = useState("")
  const [editError, setEditError] = useState("")
  const [linkError, setLinkError] = useState("")
  const [linkSuccess, setLinkSuccess] = useState("")

  // Create form state
  const [formData, setFormData] = useState({
    nombre: "", apellido: "", ci: "", profesion: "",
    genero: "Masculino", crear_cuenta: false,
    username: "", password: "", email: "", id_usuario: null as number | null
  })

  // Edit form state
  const [editData, setEditData] = useState({
    id_profesor: 0, nombre: "", apellido: "", ci: "", profesion: "", genero: "Masculino"
  })

  // Link account state
  const [linkData, setLinkData] = useState({
    id_profesor: 0, nombre_profesor: "",
    username: "", password: "", email: ""
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/profesores`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Error al cargar docentes")
      setProfesores(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar docentes")
    } finally {
      setIsLoading(false)
    }
  }

  // ── CREAR PROFESOR ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!formData.nombre || !formData.apellido || !formData.ci) {
      setFormError("Nombre, Apellido y CI son obligatorios.")
      return
    }
    if (formData.crear_cuenta && (!formData.username || !formData.password || !formData.email)) {
      setFormError("Para crear cuenta debe ingresar usuario, contraseña y correo electrónico.")
      return
    }
    if (formData.crear_cuenta) {
      const passwordError = validatePasswordStrength(formData.password)
      if (passwordError) {
        setFormError(passwordError)
        return
      }
    }
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/profesores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message || "Error al registrar profesor"); return }
      setIsCreateOpen(false)
      resetCreateForm()
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setFormError(message)
      toast.error(message)
    }
  }

  // ── EDITAR DATOS DEL PROFESOR ──
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError("")
    if (!editData.nombre || !editData.apellido || !editData.ci) {
      setEditError("Nombre, Apellido y CI son obligatorios.")
      return
    }
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/profesores/${editData.id_profesor}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: editData.nombre, apellido: editData.apellido,
          ci: editData.ci, profesion: editData.profesion, genero: editData.genero
        })
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || "Error al actualizar"); return }
      setIsEditOpen(false)
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setEditError(message)
      toast.error(message)
    }
  }

  // ── ASIGNAR CUENTA A PROFESOR SIN CUENTA ──
  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinkError("")
    setLinkSuccess("")
    if (!linkData.username || !linkData.password || !linkData.email) {
      setLinkError("Usuario, contraseña y correo electrónico son obligatorios.")
      return
    }
    const passwordError = validatePasswordStrength(linkData.password)
    if (passwordError) {
      setLinkError(passwordError)
      return
    }
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/api/profesores/${linkData.id_profesor}/cuenta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: linkData.username, password: linkData.password, email: linkData.email })
      })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.message || "Error al vincular cuenta"); return }
      setLinkSuccess("Cuenta creada y vinculada correctamente.")
      fetchData()
      setTimeout(() => { setIsLinkOpen(false); setLinkSuccess("") }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión."
      setLinkError(message)
      toast.error(message)
    }
  }

  const openEditModal = (prof: any) => {
    setEditData({
      id_profesor: prof.id_profesor, nombre: prof.nombre, apellido: prof.apellido,
      ci: prof.ci, profesion: prof.profesion || "", genero: prof.genero || "Masculino"
    })
    setEditError("")
    setIsEditOpen(true)
  }

  const openLinkModal = (prof: any) => {
    setLinkData({
      id_profesor: prof.id_profesor,
      nombre_profesor: `${prof.nombre} ${prof.apellido}`,
      username: "", password: "", email: ""
    })
    setLinkError("")
    setLinkSuccess("")
    setIsLinkOpen(true)
  }

  const resetCreateForm = () => {
    setFormData({
      nombre: "", apellido: "", ci: "", profesion: "",
      genero: "Masculino", crear_cuenta: false,
      username: "", password: "", email: "", id_usuario: null
    })
    setFormError("")
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            Personal Docente
          </h1>
          <p className="text-muted-foreground mt-1">
            Registro y seguimiento de los profesores e instructores educativos.
          </p>
        </div>

        {/* ── DIÁLOGO CREAR ── */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2"><Plus className="h-4 w-4" /> Nuevo Docente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Registrar Docente</DialogTitle>
              <DialogDescription>Ingrese la ficha técnica del profesor. Puede crear su acceso inmediatamente.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombres *</Label>
                  <Input value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input value={formData.apellido} onChange={(e) => setFormData({...formData, apellido: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cédula de Identidad *</Label>
                  <Input value={formData.ci} onChange={(e) => setFormData({...formData, ci: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Género *</Label>
                  <Select value={formData.genero} onValueChange={(v) => setFormData({...formData, genero: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Profesión / Especialidad</Label>
                <Input value={formData.profesion} onChange={(e) => setFormData({...formData, profesion: e.target.value})} placeholder="Ej. Profesor de Matemáticas Secundarias" />
              </div>
              <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border">
                <Checkbox id="crear" checked={formData.crear_cuenta} onCheckedChange={(c) => setFormData({...formData, crear_cuenta: !!c})} />
                <Label htmlFor="crear" className="text-secondary-foreground font-semibold cursor-pointer">
                  Generar cuenta de acceso para este Docente ahora
                </Label>
              </div>
              {formData.crear_cuenta && (
                <div className="grid gap-4 bg-muted/30 p-4 border rounded-lg animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Usuario *</Label>
                      <Input value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} placeholder="ej. jperez" />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraseña provisional *</Label>
                      <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                      <Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo Electrónico *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" className="pl-10" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="pt-2">
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit">Registrar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── DIÁLOGO EDITAR ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Datos del Docente</DialogTitle>
            <DialogDescription>Modifique los datos personales. Para cambiar la cuenta de acceso, use el módulo de Usuarios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-4">
            {editError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {editError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombres *</Label>
                <Input value={editData.nombre} onChange={(e) => setEditData({...editData, nombre: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Apellidos *</Label>
                <Input value={editData.apellido} onChange={(e) => setEditData({...editData, apellido: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cédula de Identidad *</Label>
                <Input value={editData.ci} onChange={(e) => setEditData({...editData, ci: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Género *</Label>
                <Select value={editData.genero} onValueChange={(v) => setEditData({...editData, genero: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Profesión / Especialidad</Label>
              <Input value={editData.profesion} onChange={(e) => setEditData({...editData, profesion: e.target.value})} placeholder="Ej. Profesor de Matemáticas Secundarias" />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIÁLOGO ASIGNAR CUENTA ── */}
      <Dialog open={isLinkOpen} onOpenChange={(open) => { setIsLinkOpen(open); if (!open) { setLinkError(""); setLinkSuccess("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Asignar Cuenta de Acceso
            </DialogTitle>
            <DialogDescription>
              Crea y vincula una cuenta para <span className="font-semibold text-foreground">{linkData.nombre_profesor}</span>.
              Esta cuenta le permitirá ingresar al sistema con rol Docente.
            </DialogDescription>
          </DialogHeader>

          {linkSuccess ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-semibold text-green-600">{linkSuccess}</p>
            </div>
          ) : (
            <form onSubmit={handleLink} className="space-y-4 pt-4">
              {linkError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {linkError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Nombre de Usuario *</Label>
                <Input
                  value={linkData.username}
                  onChange={(e) => setLinkData({...linkData, username: e.target.value})}
                  placeholder="ej. jperez"
                />
              </div>
              <div className="space-y-2">
                <Label>Correo Electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-10"
                    value={linkData.email}
                    onChange={(e) => setLinkData({...linkData, email: e.target.value})}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contraseña provisional *</Label>
                <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                <Input
                  type="password"
                  value={linkData.password}
                  onChange={(e) => setLinkData({...linkData, password: e.target.value})}
                />
              </div>
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
                💡 El docente podrá cambiar su contraseña desde la recuperación de cuenta.
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" type="button" onClick={() => setIsLinkOpen(false)}>Cancelar</Button>
                <Button type="submit" className="gap-2"><UserPlus className="h-4 w-4" /> Crear y Vincular</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── TABLA ── */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando docentes...</div>
            ) : profesores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay docentes registrados.</div>
            ) : (
              profesores.map((prof) => (
                <div key={prof.id_profesor} className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">{prof.nombre} {prof.apellido}</p>
                  <p className="text-sm"><span className="font-medium">CI:</span> {prof.ci}</p>
                  <p className="text-sm text-muted-foreground">{prof.profesion || "-"}</p>
                  <p className="text-sm">
                    <span className="font-medium">Cuenta:</span> {prof.usuario_activo !== null ? prof.username : "Sin cuenta"}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(prof)} className="flex-1">Editar</Button>
                    {prof.usuario_activo === null && (
                      <Button size="sm" onClick={() => openLinkModal(prof)} className="flex-1">Asignar Cuenta</Button>
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
                <TableHead>Nombre Completo</TableHead>
                <TableHead>CI</TableHead>
                <TableHead className="hidden md:table-cell">Especialidad</TableHead>
                <TableHead>Cuenta Vinculada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando docentes...</TableCell>
                </TableRow>
              ) : profesores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay docentes registrados.</TableCell>
                </TableRow>
              ) : (
                profesores.map((prof) => (
                  <TableRow key={prof.id_profesor}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{prof.nombre} {prof.apellido}</span>
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {prof.genero === "Femenino" ? "♀" : "♂"} · ID: {prof.id_profesor}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{prof.ci}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                      {prof.profesion || "-"}
                    </TableCell>
                    <TableCell>
                      {prof.usuario_activo !== null ? (
                        <div className="inline-flex flex-col">
                          <span className="text-sm font-semibold">{prof.username}</span>
                          <span className={`text-[10px] ${prof.usuario_activo ? 'text-green-600' : 'text-red-500'}`}>
                            {prof.usuario_activo ? 'Activa' : 'Desactivada'}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Sin cuenta
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(prof)}>
                            <Edit className="mr-2 h-4 w-4 text-blue-500" />
                            Editar Datos
                          </DropdownMenuItem>

                          {/* Solo visible si el profesor NO tiene cuenta */}
                          {prof.usuario_activo === null && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openLinkModal(prof)} className="text-amber-600 focus:text-amber-600">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Asignar Cuenta
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled>
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            Ver Expediente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
