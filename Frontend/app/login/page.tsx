"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Eye, EyeOff, Lock, User } from "lucide-react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.username || !formData.password) {
      setError("Por favor complete todos los campos");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      }).catch(() => {
        throw new TypeError(
          "No se pudo conectar con el servidor. Verifique que el backend esté activo.",
        );
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || `Error del servidor: ${response.status}`,
        );
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", String(data.role));
      localStorage.setItem("userNombreRol", data.nombre_rol || "");
      localStorage.setItem("userName", formData.username);
      localStorage.setItem(
        "userFuncionalidades",
        JSON.stringify(data.funcionalidades || []),
      );
      if (data.id_estudiante) {
        localStorage.setItem("idEstudiante", String(data.id_estudiante));
      }

      if (data.nombre_rol === "Estudiante") {
        router.push("/estudiante/mis-pagos");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-22 h-22 rounded-full bg-primary/10 mb-4">
            <img
              src="/logoBuho.webp"
              alt="Logo"
              className="h-22 w-22 rounded-full"
            />
          </div>
          <h1 className="font-sans text-2xl font-bold text-foreground">
            EduGestión
          </h1>
          <p className="font-sans text-muted-foreground text-sm mt-1">
            Sistema de Gestión Escolar
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center">
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Usuario o Correo Electrónico</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="usuario o correo@ejemplo.com"
                    className="pl-10"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su contraseña"
                    className="pl-10 pr-10"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Submit button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 EduGestión - Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
