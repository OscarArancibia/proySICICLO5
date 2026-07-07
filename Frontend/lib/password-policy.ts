export const PASSWORD_HINT =
  "Mínimo 10 caracteres, con mayúscula, minúscula, número y carácter especial."

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 10) {
    return "La contraseña debe tener al menos 10 caracteres."
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una mayúscula."
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una minúscula."
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número."
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un carácter especial."
  }
  return null
}
