"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, Mail, ArrowLeft } from "lucide-react"
import { API_URL } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    
    if (!email) {
      setError("Por favor ingrese su correo electrónico")
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error al solicitar recuperación")
      }

      setMessage(data.message)
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
            <CardTitle className="text-xl text-center">Recuperar Contraseña</CardTitle>
            <CardDescription className="text-center">
              Ingrese su correo para recibir un enlace de recuperación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    Enviando...
                  </span>
                ) : (
                  "Enviar Enlace"
                )}
              </Button>
            </form>
            
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
