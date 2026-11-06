/* Sala de partida: muestra estado y permite jugar. */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io } from "socket.io-client";
import {
  createIndividualGame,
  createMultiplayerGame,
  deleteWaitingGame,
  getMyGames,
  joinMultiplayerGame,
  type GameHistoryItem,
} from "../api/games";
import { apiRequest, ApiError } from "../api/http";
import { env } from "../config/env";
import { OnlinePlayers } from "./OnlinePlayers";

type GameLobbyProps = {
  token: string;
  userId: number;
  displayName: string;
  onDisplayNameUpdated: (newDisplayName: string) => void;
  onLogout: () => void;
  onOpenGame: (gameId: number) => void;
  onAuthenticationError: () => void;
};

// "ALL" no filtra; Los otros estados son los mismos que devuelve el backend.
type GameStatusFilter = "ALL" | GameHistoryItem["status"];

const statusFilters: { value: GameStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "WAITING", label: "En espera" },
  { value: "ACTIVE", label: "En curso" },
  { value: "FINISHED", label: "Finalizadas" },
];

export function GameLobby({
  token,
  userId,
  displayName,
  onDisplayNameUpdated,
  onLogout,
  onOpenGame,
  onAuthenticationError,
}: GameLobbyProps) {
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  // Filtro seleccionado por el usuario. Se conserva al actualizar o paginar.
  const [selectedStatus, setSelectedStatus] = useState<GameStatusFilter>("ALL");
  // El backend pagina el historial; así no se pierden las partidas antiguas.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  //Evitar crear varias salas mientras la petición está pendiente
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingIndividual, setIsCreatingIndividual] = useState(false);
  const [isOnlinePlayersOpen, setIsOnlinePlayersOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<number | null>(null);
  const [confirmingGameId, setConfirmingGameId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState("");
  const copiedCodeTimeoutRef = useRef<number | null>(null);
  const [profileName, setProfileName] = useState(displayName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = profileName.trim();

    if (normalizedName.length < 2 || normalizedName.length > 30) {
      setError("El nombre debe tener entre 2 y 30 caracteres.");
      return;
    }

    setError("");
    setIsSavingProfile(true);
    try {
      const response = await apiRequest<{ user: { displayName: string } }>(
        "/api/me",
        {
          method: "PATCH",
          token,
          body: { displayName: normalizedName },
        },
      );
      onDisplayNameUpdated(response.user.displayName);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo actualizar el nombre.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  useEffect(() => {
    // Evita actualizar el componente si el usuario sale durante la petición.
    let isCancelled = false;

    async function loadGames() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getMyGames(
          token,
          page,
          pageSize,
          selectedStatus === "ALL" ? undefined : selectedStatus,
        );

        if (!isCancelled) {
          setGames(response.items);
          setTotal(response.total);
        }
      } catch (requestError) {
        if (!isCancelled) {
          if (requestError instanceof ApiError && requestError.status === 401) {
            onAuthenticationError();
            return;
          }
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "No se pudieron cargar tus partidas. Revisa la conexión.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadGames();

    return () => {
      isCancelled = true;
    };
  }, [onAuthenticationError, page, reloadKey, selectedStatus, token]);

  useEffect(() => {
    const socket = io(env.socketUrl, { auth: { token } });
    const refreshHistory = () => {
      setReloadKey((current) => current + 1);
    };

    socket.on("game:created", refreshHistory);
    socket.on("game:joined", refreshHistory);

    return () => {
      socket.off("game:created", refreshHistory);
      socket.off("game:joined", refreshHistory);
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (copiedCodeTimeoutRef.current !== null) {
        window.clearTimeout(copiedCodeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      if (copiedCodeTimeoutRef.current !== null) {
        window.clearTimeout(copiedCodeTimeoutRef.current);
      }
      copiedCodeTimeoutRef.current = window.setTimeout(() => {
        setCopiedCode("");
        copiedCodeTimeoutRef.current = null;
      }, 2500);
    } catch {
      setError(
        "No se pudo copiar el código. Selecciónalo y cópialo manualmente.",
      );
    }
  }
  async function handleCreateRoom() {
    setError("");
    setIsCreating(true);
    try {
      await createMultiplayerGame(token);

      //Actualizamos el historial para incluir la sala reciente creada.
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo crear la sala. Revisa la conexión e inténntalo de nuevo.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateIndividualGame() {
    setError("");
    setIsCreatingIndividual(true);

    try {
      const game = await createIndividualGame(token);
      // La partida individual nace activa, así que abrimos directamente su turno.
      onOpenGame(game.id);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo crear la partida individual.",
      );
    } finally {
      setIsCreatingIndividual(false);
    }
  }

  async function handleJoinRoom() {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Introduce un código de sala para poder unirte.");
      return;
    }

    setError("");
    setIsJoining(true);

    try {
      const game = await joinMultiplayerGame(token, normalizedCode);
      setJoinCode("");
      onOpenGame(game.id);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo entrar en la sala.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleJoinRoom();
  }

  async function handleDeleteGame(gameId: number) {
    setError("");
    setDeletingGameId(gameId);
    try {
      await deleteWaitingGame(token, gameId);
      setConfirmingGameId(null);
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo eliminar la sala. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setDeletingGameId(null);
    }
  }

  function getStatusLabel(status: GameHistoryItem["status"]) {
    if (status === "WAITING") return "Esperando rival";
    if (status === "ACTIVE") return "En curso";
    return "Finalizada";
  }

  function getStatusClass(status: GameHistoryItem["status"]) {
    if (status === "WAITING")
      return "border-amber-400/40 bg-amber-400/10 text-amber-200";
    if (status === "ACTIVE")
      return "border-sky-400/40 bg-sky-400/10 text-sky-200";
    return "border-[#A3E635]/40 bg-[#A3E635]/10 text-[#A3E635]";
  }

  function getModeLabel(mode: GameHistoryItem["mode"]) {
    return mode === "MULTIPLAYER"
      ? "Jugado: multijugador"
      : "Jugado: individual";
  }

  function getModeClass(mode: GameHistoryItem["mode"]) {
    return mode === "MULTIPLAYER"
      ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
      : "border-[#A3A3A3]/40 bg-[#A3A3A3]/10 text-[#D4D4D4]";
  }

  function getFilterSummary(status: GameStatusFilter, count: number) {
    if (status === "ALL") return "en total";
    if (status === "WAITING") return "en espera";
    if (status === "ACTIVE") return "en curso";
    return count === 1 ? "finalizada" : "finalizadas";
  }

  function getOpenGameLabel(game: GameHistoryItem) {
    if (game.status === "FINISHED") return "Ver resultado";
    if (game.status === "ACTIVE") return "Continuar partida";
    return "Abrir sala";
  }
  // El backend entrega fechas ISO, el navegador las presenta en la zona local
  function formatDate(value: string) {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
  function getPlayerLabel(player: GameHistoryItem["players"][number]) {
    // Se identifica a uno mismo sin depender un email
    return player.userId === userId
      ? `Tú(${player.displayName})`
      : player.displayName;
  }

  function getFinalResult(game: GameHistoryItem) {
    if (game.status !== "FINISHED") return null;
    if (game.mode === "INDIVIDUAL")
      return `Resultado propio: ${game.score} puntos`;
    if (game.isDraw) return "Empate";
    return game.winnerUserId === userId ? "Ganaste" : "Perdiste";
  }

  function handleStatusFilter(status: GameStatusFilter) {
    setSelectedStatus(status);
    setPage(1);
  }
  const handleRefreshHistory = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);
  // No modificamos los datos recibidos: solo decidimos qué tarjetas mostrar.
  return (
    <section
      className="ambient-card relative z-10 rounded-3xl border border-[#2B2B2B] bg-[#141414] p-6 sm:p-8"
      aria-busy={isLoading}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">Tus partidas</h2>

        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-semibold text-[#A3A3A3] hover:text-[#A3E635]"
        >
          Cerrar sesión
        </button>
      </div>
      <details className="mt-4 rounded-lg border border-[#2B2B2B] bg-[#0D0D0D] px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-[#A3A3A3] hover:text-[#F8FAFC]">
          Nombre visible para jugadores: <span className="text-[#A3E635]">{displayName}</span>
        </summary>
        <form
          onSubmit={handleProfileSubmit}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="text-sm text-[#A3A3A3]">
            Nombre que verán los demás jugadores
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              minLength={2}
              maxLength={30}
              required
              className="mt-1 block rounded-lg border border-[#3D3D3D] bg-[#141414] px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold text-[#A3E635] disabled:opacity-60"
          >
            {isSavingProfile ? "Guardando…" : "Guardar nombre"}
          </button>
        </form>
      </details>
      {/* Filtros visuales del historial. */}
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar partidas">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => handleStatusFilter(filter.value)}
            aria-pressed={selectedStatus === filter.value}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              selectedStatus === filter.value
                ? "border-[#A3E635] bg-[#A3E635]/10 text-[#A3E635]"
                : "border-[#3D3D3D] text-[#A3A3A3] hover:border-[#A3E635]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#A3A3A3]" role="status">
        {isLoading
          ? "Actualizando partidas…"
          : `${total} ${total === 1 ? "partida" : "partidas"} ${getFilterSummary(selectedStatus, total)}`}
      </p>
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4">
          <p className="text-xs font-bold tracking-[0.18em] text-[#A3E635]">MULTIJUGADOR</p>
          <p className="mt-1 text-sm text-[#A3A3A3]">Juega con otra persona por código o con una invitación privada.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleCreateRoom} disabled={isCreating} className="rounded-lg border border-[#A3E635] bg-[#A3E635]/10 p-4 text-left transition hover:bg-[#A3E635]/15 disabled:cursor-wait disabled:opacity-60">
              <span className="block text-sm font-bold text-[#A3E635]">{isCreating ? "Creando sala…" : "Crear sala con código"}</span>
              <span className="mt-1 block text-xs leading-5 text-[#D4D4D4]">Comparte un código con quien quieras jugar.</span>
            </button>
            <button type="button" onClick={() => setIsOnlinePlayersOpen(true)} className="rounded-lg border border-[#3D3D3D] p-4 text-left transition hover:border-[#A3E635] hover:bg-[#141414]">
              <span className="block text-sm font-bold text-[#F8FAFC]">Retar online</span>
              <span className="mt-1 block text-xs leading-5 text-[#A3A3A3]">Elige un jugador disponible y envíale una invitación privada.</span>
            </button>
          </div>
          <OnlinePlayers token={token} userId={userId} onOpenGame={onOpenGame} onRefreshHistory={handleRefreshHistory} isOpen={isOnlinePlayersOpen} onOpenChange={setIsOnlinePlayersOpen} />
        </div>

        <div className="rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4">
          <p className="text-xs font-bold tracking-[0.18em] text-[#A3A3A3]">
            UNIRSE A UNA SALA
          </p>
          <form
            onSubmit={handleJoinSubmit}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              placeholder="Código de sala"
              maxLength={32}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="join-code-help"
              className="min-w-0 flex-1 rounded-lg border border-[#3D3D3D] bg-[#141414] px-3 py-2 text-sm"
            />

            <button
              type="submit"
              disabled={isJoining || joinCode.trim().length === 0}
              className="rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isJoining ? "Entrando…" : "Unirse"}
            </button>
          </form>
          <p
            id="join-code-help"
            className="mt-2 text-xs text-[#A3A3A3]"
            role="status"
          >
            {joinCode.trim()
              ? "Código listo. Pulsa Enter o Unirse."
              : "Pega o escribe el código que te han compartido."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#A3A3A3]">PARTIDA INDIVIDUAL</p>
            <p className="mt-1 text-sm text-[#A3A3A3]">Pon a prueba tus conocimientos a tu ritmo.</p>
          </div>
          <button type="button" onClick={handleCreateIndividualGame} disabled={isCreatingIndividual} className="rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-bold text-[#A3E635] disabled:cursor-wait disabled:opacity-60">
            {isCreatingIndividual ? "Creando partida…" : "Jugar en solitario"}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
            className="rounded-lg border border-[#3D3D3D] px-4 py-2 text-sm font-semibold text-[#A3A3A3] hover:border-[#A3E635] hover:text-[#F8FAFC] disabled:opacity-60"
          >
            {isLoading ? "Cargando…" : "Actualizar partidas"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {isLoading && games.length === 0 && !error && (
        <div className="mt-6" role="status" aria-label="Cargando tus partidas">
          <span className="sr-only">Cargando tus partidas…</span>
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4"
              >
                <div className="h-5 w-28 rounded bg-[#2B2B2B]" />
                <div className="mt-3 h-4 w-3/4 rounded bg-[#202020]" />
                <div className="mt-2 h-4 w-1/2 rounded bg-[#202020]" />
                <div className="mt-4 h-9 w-28 rounded-lg bg-[#2B2B2B]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !error && games.length === 0 && (
        <p className="mt-6 text-sm text-[#A3A3A3]">
          {games.length === 0
            ? "Todavía no tienes partidas."
            : "No hay partidas de este estado en esta página."}
        </p>
      )}

      {games.length > 0 && (
        <ul className="mt-6 space-y-3">
          {games.map((game) => (
            <li
              key={game.id}
              className="ambient-card rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Partida #{game.id}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getModeClass(game.mode)}`}>
                    {getModeLabel(game.mode)}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClass(game.status)}`}>
                    {getStatusLabel(game.status)}
                  </span>
                </div>
              </div>

              <p className="mt-1 text-sm text-[#A3A3A3]">
                Creada el{" "}
                {formatDate(game.createdAt)}
              </p>

              <p className="mt-1 text-sm text-[#A3A3A3]">
                Tus puntos: {game.score}
              </p>

              {game.mode === "MULTIPLAYER" && (
                <ul className="mt-3 space-y-1 text-sm text-[#D4D4D4]">
                  {game.players.map((player) => (
                    <li key={player.userId}>
                      {getPlayerLabel(player)} · {player.score} puntos
                      {game.status === "WAITING" &&
                        ` · ${player.isReady ? "Preparado" : "Pendiente de confirmar"}`}
                    </li>
                  ))}
                </ul>
              )}

              {game.status === "WAITING" && game.code && (
                <p className="mt-3 text-sm text-[#A3E635]">
                  Código de invitación: <strong>{game.code}</strong>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode(game.code!)}
                    className="ml-3 underline"
                  >
                    {copiedCode === game.code ? "Copiado" : "Copiar"}
                  </button>
                </p>
              )}

              {getFinalResult(game) && (
                <p className="mt-3 font-bold text-[#A3E635]">
                  {getFinalResult(game)}
                </p>
              )}

              <button
                type="button"
                onClick={() => onOpenGame(game.id)}
                className="mt-3 w-full rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold text-[#A3E635] sm:w-auto"
              >
                {getOpenGameLabel(game)}
              </button>

              {/* Solo el creador ve la acción; el backend vuelve a comprobar el permiso. */}
              {game.status === "WAITING" &&
                game.players.some(
                  (player) => player.userId === userId && player.isCreator,
                ) && (
                  <div className="mt-3">
                    {confirmingGameId === game.id ? (
                      <div
                        className="rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100"
                        role="alertdialog"
                        aria-label="Confirmar eliminación de sala"
                      >
                        <p>La sala se eliminará y el rival no podrá entrar.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmingGameId(null)}
                            disabled={deletingGameId === game.id}
                            className="rounded-lg border border-[#3D3D3D] px-3 py-1.5 text-xs font-semibold text-[#D4D4D4] disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteGame(game.id)}
                            disabled={deletingGameId === game.id}
                            className="rounded-lg border border-red-400/70 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-60"
                          >
                            {deletingGameId === game.id
                              ? "Eliminando…"
                              : "Sí, eliminar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingGameId(game.id)}
                        disabled={deletingGameId !== null}
                        className="w-full rounded-lg border border-red-400/70 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-60 sm:w-auto"
                      >
                        Eliminar sala…
                      </button>
                    )}
                  </div>
                )}
            </li>
          ))}
        </ul>
      )}

      {total > pageSize && (
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="Paginación de partidas"
        >
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={page === 1 || isLoading}
            className="rounded-lg border border-[#3D3D3D] px-4 py-2 text-sm disabled:opacity-60"
          >
            Anterior
          </button>
          <span className="text-sm text-[#A3A3A3]">
            Página {page} de {Math.ceil(total / pageSize)}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page * pageSize >= total || isLoading}
            className="rounded-lg border border-[#3D3D3D] px-4 py-2 text-sm disabled:opacity-60"
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
