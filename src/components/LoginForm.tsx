import { useState, type FormEvent } from "react";
import { apiRequest, ApiError } from "../api/http";
import { PasswordField } from "./PasswordField";

/* respuest del POST  /api/auth/login.
El backend devuelve el token y los datos públicos del usuario */
export type LoginResponse = {
  token: string;
  expiresIn: number;
  user: {
    id: number;
    email: string;
  };
};

// App recibirá la respuesta par aguardar el token en memoria.
type LoginFormProps = {
  notice?: string;
  onLoggedIn: (response: LoginResponse) => void;
};
export function LoginForm({ notice, onLoggedIn }: LoginFormProps) {
  // El formulario mantiene email y contraseña mientras el usuario escribe.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  //Estos estados permiten mostrar errores y bloquear envíos repetidos.
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página y envíe el formulario.
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // El contrato del backend recibe email y contraseña en esta ruta.
      const response = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      //App recibe el toen para guardarlo en memoria.
      onLoggedIn(response);
    } catch (requestError) {
      //ApiError contiene los errores que devuelve la API.
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      // Se ejecuta tanto si el loging funciona como si falla.
      setIsSubmitting(false);
    }
  }

  // El formulario devuelto es quien conecta el envío con handleSubmit.
  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="login-email"
          className="mb-2 block text-sm font-semibold"
        >
          Email
        </label>

        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          autoComplete="email"
          className="w-full rounded-lg border border-[#3A4660] bg-[#101625] px-4 py-3 text-white outline-none transition focus:border-[#A3E635]"
        />
      </div>

      <PasswordField
        id="login-password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {notice && (
        <p
          className="rounded-lg bg-[#28364D] p-3 text-sm text-[#F8FAFC]"
          role="status"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-linear-to-b from-[#F8FAFC] via-[#CBD5E1] to-[#94A3B8] px-5 py-3.5 font-bold text-[#0B0F1A] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#A8B1C0] disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
