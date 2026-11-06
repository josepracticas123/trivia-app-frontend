/* Componente raíz: gestiona las pantallas (home, registro, login) y el token en memoria. */

import { useCallback, useEffect, useState } from "react";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { GameLobby } from "./components/GameLobby";
import { GameRoom } from "./components/GameRoom";
import ElectricBorder from "./components/ElectricBorder";
import FlyingButton from "./components/FlyingButton";
import LetterGlitch from "./components/LetterGlitch";
import SplitFlapText from "./components/SplitFlapText";

type Screen = "welcome" | "home" | "register" | "login" | "lobby" | "room";

type AppRoute = { screen: Screen; gameId: number | null };

function readRoute(): AppRoute {
  const gameMatch = window.location.hash.match(/^#\/games\/(\d+)$/);
  if (gameMatch) return { screen: "room", gameId: Number(gameMatch[1]) };
  if (window.location.hash === "#/games")
    return { screen: "lobby", gameId: null };
  if (window.location.hash === "#/login")
    return { screen: "login", gameId: null };
  if (window.location.hash === "#/register")
    return { screen: "register", gameId: null };
  if (window.location.hash === "#/home")
    return { screen: "home", gameId: null };
  return { screen: "welcome", gameId: null };
}

function hashForRoute(screen: Screen, gameId: number | null) {
  if (screen === "lobby") return "#/games";
  if (screen === "room" && gameId) return `#/games/${gameId}`;
  if (screen === "login") return "#/login";
  if (screen === "register") return "#/register";
  if (screen === "home") return "#/home";
  return "#/";
}

// sessionStorage conserva la sesión al recargar esta pestaña, pero se borra al
// cerrarla. No guardamos historial, puntuación ni el estado de una pregunta.
const SESSION_STORAGE_KEY = "trivia.session";

type StoredSession = {
  token: string;
  userId: number;
  displayName: string;
};

function readStoredSession(): StoredSession | null {
  try {
    const value = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!value) return null;

    const session: unknown = JSON.parse(value);
    if (
      typeof session === "object" &&
      session !== null &&
      "token" in session &&
      typeof session.token === "string" &&
      "userId" in session &&
      typeof session.userId === "number" &&
      "displayName" in session &&
      typeof session.displayName === "string"
    ) {
      return session as StoredSession;
    }
  } catch {
    // Un valor corrupto no debe impedir abrir la aplicación.
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

function saveStoredSession(session: StoredSession) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function AppBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <LetterGlitch
        className="absolute inset-0"
        glitchColors={["#A3E635", "#F8FAFC"]}
        baseColor="#F8FAFC"
        baseOpacity={0.19}
        glitchAmount={0.5}
        density={0.9}
        speed={0.6}
        interactive={false}
        centerFade={0}
        backgroundColor="#090909"
        dpr={undefined}
        style={undefined}
      />
    </div>
  );
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function App() {
  const prefersReducedMotion = useReducedMotion();
  const [restoredSession] = useState(() => readStoredSession());
  const [initialRoute] = useState(() => readRoute());
  // Estado temporal para navegar sin instalar un router.
  const [screen, setScreen] = useState<Screen>(
    restoredSession && ["lobby", "room"].includes(initialRoute.screen)
      ? initialRoute.screen
      : restoredSession
        ? "lobby"
        : initialRoute.screen,
  );
  const [loginNotice, setLoginNotice] = useState("");

  // Se restaura solo para esta pestaña; la API vuelve a validar el JWT al cargar el lobby.
  const [sessionToken, setSessionToken] = useState<string | null>(
    restoredSession?.token ?? null,
  );
  const [sessionUserId, setSessionUserId] = useState<number | null>(
    restoredSession?.userId ?? null,
  );
  const [selectedGameId, setSelectedGameId] = useState<number | null>(
    restoredSession && initialRoute.screen === "room"
      ? initialRoute.gameId
      : null,
  );
  // Nombre público del usuario autenticado, devuelto por POST /api/auth/login.
  const [sessionDisplayName, setSessionDisplayName] = useState<string | null>(
    restoredSession?.displayName ?? null,
  );
  const [isEntering, setIsEntering] = useState(false);
  const navigate = useCallback(
    (nextScreen: Screen, gameId: number | null = null, replace = false) => {
      const hash = hashForRoute(nextScreen, gameId);
      if (window.location.hash !== hash) {
        window.history[replace ? "replaceState" : "pushState"](null, "", hash);
      }
      setScreen(nextScreen);
      setSelectedGameId(nextScreen === "room" ? gameId : null);
    },
    [],
  );
  const clearSession = useCallback(
    (nextScreen: Screen = "home") => {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSessionToken(null);
      setSessionUserId(null);
      setSessionDisplayName(null);
      navigate(nextScreen, null, true);
    },
    [navigate],
  );
  const handleAuthenticationError = useCallback(() => {
    clearSession("login");
    setLoginNotice("Tu sesión ha caducado. Inicia sesión de nuevo.");
  }, [clearSession]);
  const handleDisplayNameUpdated = useCallback(
    (displayName: string) => {
      setSessionDisplayName(displayName);
      if (sessionToken && sessionUserId !== null) {
        saveStoredSession({
          token: sessionToken,
          userId: sessionUserId,
          displayName,
        });
      }
    },
    [sessionToken, sessionUserId],
  );
  const handleEnter = () => {
    if (isEntering) return;

    setIsEntering(true);
    window.setTimeout(() => {
      // Al volver a la portada, el botón debe poder iniciar otra entrada.
      setIsEntering(false);
      navigate("home");
    }, 3200);
  };
  useEffect(() => {
    const restoreRoute = () => {
      const route = readRoute();
      if (
        (route.screen === "lobby" || route.screen === "room") &&
        !sessionToken
      ) {
        navigate("login", null, true);
        return;
      }
      setScreen(route.screen);
      setSelectedGameId(route.screen === "room" ? route.gameId : null);
    };
    window.addEventListener("popstate", restoreRoute);
    window.addEventListener("hashchange", restoreRoute);
    return () => {
      window.removeEventListener("popstate", restoreRoute);
      window.removeEventListener("hashchange", restoreRoute);
    };
  }, [navigate, sessionToken]);
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
              style={{
                "--split-flap-font-size": "clamp(2.25rem, 12vw, 5.5rem)",
                "--split-flap-gap": "clamp(3px, 1.5vw, 6px)",
              }}
            />
          </div>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#D4D4D4]">
            Entra, crea una sala y reta a quien más sabe.
          </p>
        </section>
      </main>
    );
  }

  if (
    screen === "room" &&
    selectedGameId &&
    sessionToken &&
    sessionUserId !== null
  ) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
        <AppBackground />
        <div className="relative z-10 mx-auto max-w-4xl">
          <ElectricBorder
            color="#A3E635"
            glowColor="#BEF264"
            borderRadius={24}
            active={!prefersReducedMotion}
            style={undefined}
          >
            <GameRoom
              key={selectedGameId}
              gameId={selectedGameId}
              token={sessionToken}
              userId={sessionUserId}
              onBack={() => navigate("lobby")}
              onOpenGame={(gameId) => navigate("room", gameId)}
              onAuthenticationError={handleAuthenticationError}
            />
          </ElectricBorder>
        </div>
      </main>
    );
  }

  if (screen === "lobby" && sessionToken) {
    return (
      <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
        <AppBackground />
        <div className="relative z-10 mx-auto max-w-4xl">
          <ElectricBorder
            color="#A3E635"
            glowColor="#BEF264"
            borderRadius={24}
            active={!prefersReducedMotion}
            style={undefined}
          >
            <GameLobby
              token={sessionToken}
              userId={sessionUserId!}
              displayName={sessionDisplayName ?? ""}
              onDisplayNameUpdated={handleDisplayNameUpdated}
              onLogout={() => clearSession()}
              onOpenGame={(gameId) => navigate("room", gameId)}
              onAuthenticationError={handleAuthenticationError}
            />
          </ElectricBorder>
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
        <ElectricBorder
          color="#A3E635"
          glowColor="#BEF264"
          borderRadius={24}
          active={!prefersReducedMotion}
          className="mx-auto max-w-md"
          style={undefined}
        >
          <section className="ambient-card relative z-10 rounded-3xl border border-[#2B2B2B] bg-[#141414] p-6 shadow-2xl shadow-black/30 sm:p-8">
            <button
              type="button"
              onClick={() => navigate("home")}
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
                  setLoginNotice(
                    "Cuenta creada. Inicia sesión para continuar.",
                  );
                  navigate("login");
                }}
              />
            ) : (
              <LoginForm
                notice={loginNotice}
                onLoggedIn={(response) => {
                  // Guardamos la sesión de la pestaña y la recuperamos tras F5.
                  saveStoredSession({
                    token: response.token,
                    userId: response.user.id,
                    displayName: response.user.displayName,
                  });
                  setSessionToken(response.token);
                  setSessionUserId(response.user.id);
                  setSessionDisplayName(response.user.displayName);
                  // Quitamos el aviso de registro después del login.
                  setLoginNotice("");

                  // Volvemos a la portada.
                  navigate("lobby", null, true);
                }}
              />
            )}
          </section>
        </ElectricBorder>
      </main>
    );
  }
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#090909]/90 px-4 py-6 text-[#F8FAFC] sm:py-10">
      <AppBackground />
      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("welcome")}
            className="text-xl font-black tracking-tight transition hover:text-[#A3E635]"
            aria-label="Volver a la portada"
          >
            ← trivia<span className="text-[#A3E635]">.</span>
          </button>

          <span className="rounded-full border border-[#2B2B2B] bg-[#141414] px-3 py-1 text-xs font-semibold text-[#A3A3A3]">
            MULTIJUGADOR
          </span>
        </header>

        <ElectricBorder
          className="relative z-10"
          color="#A3E635"
          glowColor="#BEF264"
          borderRadius={24}
          active={!prefersReducedMotion}
          style={undefined}
        >
          <section className="ambient-card relative z-10 rounded-3xl border border-[#2B2B2B] bg-[#141414] shadow-2xl shadow-black/30">
          <div className="relative z-10 grid overflow-hidden rounded-[23px] lg:grid-cols-[1.2fr_0.8fr]">
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

                  <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("lobby")}
                    className="rounded-xl bg-[#A3E635] px-5 py-3.5 font-bold text-[#090909] transition hover:bg-[#BEF264]"
                  >
                    Ir a tus partidas
                  </button>

                  <button
                    type="button"
                    onClick={() => clearSession()}
                    className="rounded-xl border border-[#3D3D3D] bg-[#1A1A1A] px-5 py-3.5 font-bold text-[#F8FAFC] transition hover:border-[#A3E635] hover:bg-[#242424]"
                  >
                    Cerrar sesión
                  </button>
                  </div>
                </div>
              ) : (
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("register")}
                    className="rounded-xl bg-gradient-to-b from-[#F8FAFC] via-[#D4D4D4] to-[#A3A3A3] px-5 py-3.5 font-bold text-[#090909] shadow-lg shadow-black/20 transition hover:from-white hover:to-[#D4D4D4]"
                  >
                    Crear cuenta
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("login")}
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
        </ElectricBorder>
      </div>
    </main>
  );
}

export default App;
