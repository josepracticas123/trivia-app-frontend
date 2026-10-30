/* Componente raíz: gestiona las pantallas (home, registro, login) y el token en memoria. */

import { useCallback, useState } from "react";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { GameLobby } from "./components/GameLobby";
import { GameRoom } from "./components/GameRoom";
import FlyingButton from "./components/FlyingButton";
import LetterGlitch from "./components/LetterGlitch";
import SplitFlapText from "./components/SplitFlapText";

type Screen = "welcome" | "home" | "register" | "login" | "lobby" | "room";

function AppBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <LetterGlitch
        className="absolute inset-0"
        glitchColors={["#FFFFFF", "#61DCA3"]}
        baseColor="#FFFFFF"
        baseOpacity={0.16}
        glitchAmount={0.5}
        density={0.9}
        speed={1}
        interactive={false}
        centerFade={0}
        backgroundColor="#090909"
        dpr={undefined}
        style={undefined}
      />
    </div>
  );
}

function App() {
  // Estado temporal para navegar sin instalar un router.
  const [screen, setScreen] = useState<Screen>("welcome");
  const [loginNotice, setLoginNotice] = useState("");

  // El JWT vive en React y se pierde al recargar la página.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const handleAuthenticationError = useCallback(() => {
    setSessionToken(null);
    setSessionUserId(null);
    setSelectedGameId(null);
    setLoginNotice("Tu sesión ha caducado. Inicia sesión de nuevo.");
    setScreen("login");
  }, []);
  const handleEnter = () => {
    if (isEntering) return;

    setIsEntering(true);
    window.setTimeout(() => setScreen("home"), 3200);
  };
  // Con sesión iniciada, mostramos las partidas del usuario.

  if (screen === "welcome") {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909] px-4 py-6 text-[#F8FAFC]">
        <AppBackground />

        <div className="absolute inset-0 z-30">
          <FlyingButton
            onClick={handleEnter}
            trigger="click"
            carryCursor={false}
            buttonColor="#A3E635"
            textColor="#090909"
            thrustColor="#BEF264"
            smokeColor="#F8FAFC"
            hoverTime={1}
            lateralDrift={72}
            groundClearance={0}
            groundClearanceRatio={0.22}
            size="large"
            radius={undefined}
            rampColor={undefined}
            className="h-full min-h-0"
            style={{ minHeight: "100%" }}
          >
            {isEntering ? "Despegando..." : "Entrar a trivia"}
          </FlyingButton>
        </div>

        <section className="pointer-events-none relative z-20 mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col items-center justify-start pt-8 text-center sm:pt-12">
          <p className="text-xl font-black tracking-tight">
            trivia<span className="text-[#A3E635]">.</span>
          </p>
          <p className="mt-12 text-xs font-bold tracking-[0.32em] text-[#A3E635]">
            PARTIDA EN TIEMPO REAL
          </p>
          <div className="mt-5 max-w-full overflow-hidden px-2">
            <SplitFlapText
              text="TRIVIA"
              loop={false}
              padTo={6}
              align="center"
              fontSize={52}
              tileColor="#141414"
              textColor="#A3E635"
              flipDuration={0.15}
              stagger={0.1}
              flipsPerChar={7}
              glare={0.18}
              depth={0.65}
              style={{ "--split-flap-font-size": "clamp(3rem, 13vw, 5.5rem)" }}
            />
          </div>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#D4D4D4]">
            Entra, crea una sala y reta a quien más sabe.
          </p>

        </section>
      </main>
    );
  }

  if (screen === "room" && selectedGameId && sessionToken && sessionUserId !== null) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
        <AppBackground />
        <div className="relative z-10 mx-auto max-w-4xl">
          <GameRoom
            gameId={selectedGameId}
            token={sessionToken}
            userId={sessionUserId}
            onBack={() => setScreen("lobby")}
            onAuthenticationError={handleAuthenticationError}
          />
        </div>
      </main>
    );
  }

  if (screen === "lobby" && sessionToken) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
        <AppBackground />
        <div className="relative z-10 mx-auto max-w-4xl">
          <GameLobby
            token={sessionToken}
            onLogout={() => {
              setSessionToken(null);
              setScreen("home");
              setSessionUserId(null);
            }}
            onOpenGame={(gameId) => {
              setSelectedGameId(gameId);
              setScreen("room");
            }}
            onAuthenticationError={handleAuthenticationError}
          />
        </div>
      </main>
    );
  }
  //Sección de acceso a crear cuenta, con sus inputs.
  if (screen !== "home") {
    const isRegister = screen === "register";

    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
        <AppBackground />
        <section className="ambient-card relative z-10 mx-auto max-w-md rounded-3xl border border-[#2B2B2B] bg-[#141414] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <button
            type="button"
            onClick={() => setScreen("home")}
            className="text-sm font-semibold text-[#A3A3A3] hover:text-[#A3E635]"
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
            <RegisterForm
              onRegistered={() => {
                setLoginNotice("Cuenta creada. Inicia sesión para continuar.");
                setScreen("login");
              }}
            />
          ) : (
            <LoginForm
              notice={loginNotice}
              onLoggedIn={(response) => {
                // Guardamos el token para usarlo en las peticiones autenticadas.
                setSessionToken(response.token);
                setSessionUserId(response.user.id);
                // Quitamos el aviso de registro después del login.
                setLoginNotice("");

                // Volvemos a la portada.
                setScreen("lobby");
              }}
            />
          )}
        </section>
      </main>
    );
  }
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
      <AppBackground />
      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-10 flex items-center justify-between">
          <p className="text-xl font-black tracking-tight">
            trivia<span className="text-[#A3E635]">.</span>
          </p>

          <span className="rounded-full border border-[#2B2B2B] bg-[#141414] px-3 py-1 text-xs font-semibold text-[#A3A3A3]">
            MULTIJUGADOR
          </span>
        </header>

        <section className="ambient-card rounded-3xl border border-[#2B2B2B] bg-[#141414] shadow-2xl shadow-black/30">
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

              <p className="mt-5 max-w-md text-base leading-7 text-[#A3A3A3]">
                Crea una partida, comparte el código y demuestra quién sabe más.
              </p>
              {sessionToken ? (
                <div className="mt-9 space-y-3">
                  <p className="text-sm text-[#A3E635]" role="status">
                    Sesión iniciada correctamente.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSessionToken(null)}
                    className="rounded-xl border border-[#3D3D3D] bg-[#1A1A1A] px-5 py-3.5 font-bold text-[#F8FAFC] transition hover:border-[#A3E635] hover:bg-[#242424]"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setScreen("register")}
                    className="rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#D4D4D4] to-[#A3A3A3] px-5 py-3.5 font-bold text-[#090909] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#D4D4D4]"
                  >
                    Crear cuenta
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen("login")}
                    className="rounded-xl border border-[#3D3D3D] bg-[#1A1A1A] px-5 py-3.5 font-bold text-[#F8FAFC] transition hover:border-[#A3E635] hover:bg-[#242424]"
                  >
                    Iniciar sesión
                  </button>
                </div>
              )}
            </div>

            <aside className="border-t border-[#2B2B2B] bg-[#0D0D0D] p-8 lg:border-t-0 lg:border-l sm:p-10">
              <p className="text-sm font-semibold text-[#A3A3A3]">
                VISTA PREVIA
              </p>
              <div className="mt-6 rounded-2xl border border-[#2B2B2B] bg-[#141414] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#A3E635]">
                    TU TURNO
                  </span>
                  <span className="rounded-md bg-[#202020] px-2 py-1 text-xs text-[#A3A3A3]">
                    Ronda 2
                  </span>
                </div>

                <p className="mt-5 text-lg font-bold">
                  ¿Cuál es el planeta más grande del sistema solar?
                </p>

                <div className="mt-5 space-y-2">
                  <div className="rounded-lg border border-[#3D3D3D] px-3 py-2 text-sm text-[#D4D4D4]">
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
