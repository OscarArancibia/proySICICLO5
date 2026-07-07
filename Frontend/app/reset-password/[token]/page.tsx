"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { API_URL } from "@/lib/api"
import { PASSWORD_HINT, validatePasswordStrength } from "@/lib/password-policy"

export default function ResetPasswordPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    
    if (!password || !confirmPassword) {
      setError("Por favor complete todos los campos")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }
    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error al restablecer la contraseña")
      }

      setMessage(data.message)
      setIsSuccess(true)
      
      // Opcionalmente redirigir después de unos segundos
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">EduGestión</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistema de Gestión Escolar</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Restablecer Contraseña</CardTitle>
            <CardDescription className="text-center">
              Ingrese su nueva contraseña
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nueva Contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva Contraseña</Label>
                  <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirma la nueva contraseña"
                      className="pl-10 pr-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Mensajes */}
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                    {message}
                  </div>
                )}

                {/* Submit button */}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Restableciendo...
                    </span>
                  ) : (
                    "Guardar Contraseña"
                  )}
                </Button>
              </form>
            ) : (
               <div className="text-center py-6 space-y-4">
                 <div className="text-green-600 bg-green-50 border border-green-200 p-4 rounded-lg">
                   {message}
                 </div>
                 <p className="text-sm text-muted-foreground">Serás redirigido al inicio de sesión...</p>
                 <Button asChild className="w-full">
                    <Link href="/login">Ir a Iniciar Sesión</Link>
                 </Button>
               </div>
            )}
            
            <div className="mt-6 text-center">
              <Link href="/login" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2025 EduGestión - Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
