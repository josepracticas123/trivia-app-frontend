import { useState, type FormEvent } from "react";
import { PasswordField } from './components/PasswordField'

type Screen = "home" | "register" | "login";

function App() {
  // Estado temporal para navegar sin instalar un router.
  const [screen, setScreen] = useState<Screen>("home");
  // Cada campo controlado guarda su valor en el estado de React.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setLoginMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoginMessage(
      "Formulario válido. En el siguiente paso lo conectaremos al backend.",
    );
  }
  // Por ahora validamos en el navegador. Más adelante enviaremos estos datos a la API.
  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setRegisterMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setRegisterMessage(
      "Formulario válido. En el siguiente paso lo enviaremos al backend.",
    );
  }
  //Sección de acceso a crear cuenta, con sus inputs.
  if (screen !== "home") {
    const isRegister = screen === "register";

    return (
      <main className="min-h-screen bg-[#0B0F1A] px-4 py-6 text-[#F8FAFC] sm:py-10">
        <section className="mx-auto max-w-md rounded-3xl border border-[#2A344A] bg-[#151B2B] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <button
            type="button"
            onClick={() => setScreen("home")}
            className="text-sm font-semibold text-[#94A3B8] hover:text-[#A3E635]"
          >
            ← Volver
          </button>

          <p className="mt-8 text-sm font-bold text-[#A3E635]">
            {isRegister ? "NUEVA CUENTA" : "BIENVENIDO DE NUEVO"}
          </p>

          <h1 className="mt-3 text-3xl font-black">
            {isRegister ? "Crea tu cuenta" : "Inicia sesión"}
          </h1>

          {isRegister ? (
            <form onSubmit={handleRegisterSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-[#3A4660] bg-[#101625] px-4 py-3 text-white outline-none transition focus:border-[#A3E635]"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-[#3A4660] bg-[#101625] px-4 py-3 text-white outline-none transition focus:border-[#A3E635]"
                />
              </div>

              <PasswordField
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint="Mínimo 8 caracteres."
              />

              {registerMessage && (
                <p className="rounded-lg bg-[#28364D] p-3 text-sm text-[#F8FAFC]">
                  {registerMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#CBD5E1] to-[#94A3B8] px-5 py-3.5 font-bold text-[#0B0F1A] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#A8B1C0]"
              >
                Crear cuenta
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="mt-8 space-y-5">
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

              {loginMessage && (
                <p className="rounded-lg bg-[#28364D] p-3 text-sm text-[#F8FAFC]">
                  {loginMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#CBD5E1] to-[#94A3B8] px-5 py-3.5 font-bold text-[#0B0F1A] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#A8B1C0]"
              >
                Iniciar sesión
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#0B0F1A] px-4 py-6 text-[#F8FAFC] sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 flex items-center justify-between">
          <p className="text-xl font-black tracking-tight">
            trivia<span className="text-[#A3E635]">.</span>
          </p>

          <span className="rounded-full border border-[#2A344A] bg-[#151B2B] px-3 py-1 text-xs font-semibold text-[#94A3B8]">
            MULTIJUGADOR
          </span>
        </header>

        <section className="overflow-hidden rounded-3xl border border-[#2A344A] bg-[#151B2B] shadow-2xl shadow-black/30">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8 sm:p-12">
              <div className="mb-8 flex items-center gap-2 text-sm font-bold text-[#A3E635]">
                <span className="h-2 w-2 rounded-full bg-[#A3E635]" />
                PARTIDA EN TIEMPO REAL
              </div>

              <h1 className="max-w-lg text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                La próxima pregunta
                <span className="text-[#A3E635]"> puede cambiarlo todo.</span>
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-[#94A3B8]">
                Crea una partida, comparte el código y demuestra quién sabe más.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setScreen("register")}
                  className="rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#CBD5E1] to-[#94A3B8] px-5 py-3.5 font-bold text-[#0B0F1A] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#A8B1C0]"
                >
                  Crear cuenta
                </button>

                <button
                  type="button"
                  onClick={() => setScreen("login")}
                  className="rounded-xl border border-[#3A4660] bg-[#1D2639] px-5 py-3.5 font-bold text-[#F8FAFC] transition hover:border-[#A3E635] hover:bg-[#27334D]"
                >
                  Iniciar sesión
                </button>
              </div>
            </div>

            <aside className="border-t border-[#2A344A] bg-[#101625] p-8 lg:border-t-0 lg:border-l sm:p-10">
              <p className="text-sm font-semibold text-[#94A3B8]">
                VISTA PREVIA
              </p>
              <div className="mt-6 rounded-2xl border border-[#2A344A] bg-[#151B2B] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#A3E635]">
                    TU TURNO
                  </span>
                  <span className="rounded-md bg-[#28364D] px-2 py-1 text-xs text-[#94A3B8]">
                    Ronda 2
                  </span>
                </div>

                <p className="mt-5 text-lg font-bold">
                  ¿Cuál es el planeta más grande del sistema solar?
                </p>

                <div className="mt-5 space-y-2">
                  <div className="rounded-lg border border-[#3A4660] px-3 py-2 text-sm text-[#CBD5E1]">
                    A. Saturno
                  </div>
                  <div className="rounded-lg border border-[#A3E635] bg-[#A3E635]/10 px-3 py-2 text-sm font-semibold">
                    B. Júpiter
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
