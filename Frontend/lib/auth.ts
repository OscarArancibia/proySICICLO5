import { API_URL } from "@/lib/api"

export async function logoutSession(): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (_error) {
    // Si falla la petición de logout, igual limpiamos sesión local.
  } finally {
    if (typeof window !== "undefined") {
      localStorage.clear()
      window.location.href = "/login"
    }
  }
}
