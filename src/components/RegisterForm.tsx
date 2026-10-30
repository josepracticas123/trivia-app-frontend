/* Formulario de registro: crea cuenta y notifica a App al completar. */

import { useState, type FormEvent } from 'react'
import { apiRequest, ApiError } from '../api/http'
import { PasswordField } from './PasswordField'

type RegisterResponse = {
  id: number
  email: string
}

type RegisterFormProps = {
  onRegistered: (email: string) => void
}

export function RegisterForm({ onRegistered }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await apiRequest<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      })
      onRegistered(user.email)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="register-email" className="mb-2 block text-sm font-semibold">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          autoComplete="email"
          className="w-full rounded-lg border border-[#3D3D3D] bg-[#0D0D0D] px-4 py-3 text-white outline-none transition focus:border-[#A3E635]"
        />
      </div>

      <PasswordField
        id="register-password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
      />

      {error && (
        <p className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#D4D4D4] to-[#A3A3A3] px-5 py-3.5 font-bold text-[#090909] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#D4D4D4] disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

    </form>
  )
}
