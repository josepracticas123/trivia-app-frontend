/* Sala de partida: muestra estado y permite jugar. */

import { useEffect, useState } from "react";
import {
  createMultiplayerGame,
  getMyGames,
  joinMultiplayerGame,
  type GameHistoryItem,
} from "../api/games";
import { ApiError } from "../api/http";

type GameLobbyProps = {
  token: string;
  onLogout: () => void;
  onOpenGame: (gameId: number) => void;
  onAuthenticationError: () => void;
};

export function GameLobby({
  token,
  onLogout,
  onOpenGame,
  onAuthenticationError,
}: GameLobbyProps) {
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  //Evitar crear varias salas mientras la petición está pendiente
  const [isCreating, setIsCreating] = useState(false);
  //Guardamos el cóigo para mostrásrselo al usuario después de crear la sala.
  const [createdRoomCode, setCreatedRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Evita actualizar el componente si el usuario sale durante la petición.
    let isCancelled = false;

    async function loadGames() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getMyGames(token);

        if (!isCancelled) {
          setGames(response.items);
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
  }, [onAuthenticationError, token, reloadKey]);
  async function handleCreateRoom() {
    setError("");
    setCreatedRoomCode("");
    setIsCreating(true);
    try {
      const game = await createMultiplayerGame(token);

      // Mostramos el código de invitación devuelto por el backend.
      setCreatedRoomCode(game.code);

      //Actualizamos el historial para incluir la sala reciente creada.
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
  async function handleJoinRoom() {
    setError("");
    setIsJoining(true);

    try {
      const game = await joinMultiplayerGame(token, joinCode.trim());
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

  function getStatusLabel(status: GameHistoryItem["status"]) {
    if (status === "WAITING") return "Esperando rival";
    if (status === "ACTIVE") return "En curso";
    return "Finalizada";
  }

  return (
    <section className="ambient-card rounded-3xl border border-[#2B2B2B] bg-[#141414] p-6 sm:p-8">
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
      <div className="mt-5 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-5 rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-bold text-[#090909] disabled:cursor-wait disabled:opacity-60"
        >
          {isCreating ? "Creando sala…" : "Crear sala"}
        </button>

        {createdRoomCode && (
          <p className="mt-3 text-sm text-[#A3E635]" role="status">
            Sala creada. Código para invitar a otro jugador:{" "}
            <strong>{createdRoomCode}</strong>
          </p>
        )}

        <button
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
          className="mt-5 rounded-lg border border-[#3D3D3D] px-4 py-2 text-sm font-semibold hover:border-[#A3E635] disabled:opacity-60"
        >
          {isLoading ? "Cargando…" : "Actualizar"}
        </button>
        <input
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="Código de sala"
          maxLength={32}
          className="rounded-lg border border-[#3D3D3D] bg-[#0D0D0D] px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={handleJoinRoom}
          disabled={isJoining || joinCode.trim().length === 0}
          className="rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {isJoining ? "Entrando…" : "Unirse"}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && games.length === 0 && (
        <p className="mt-6 text-sm text-[#A3A3A3]">
          Todavía no tienes partidas.
        </p>
      )}

      {games.length > 0 && (
        <ul className="mt-6 space-y-3">
          {games.map((game) => (
            <li
              key={game.id}
              className="ambient-card rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4"
            >
              <p className="font-semibold">Partida #{game.id}</p>
              <p className="mt-1 text-sm text-[#A3A3A3]">
                {getStatusLabel(game.status)} · Puntuación: {game.score}
              </p>
                            <button
                type="button"
                onClick={() => onOpenGame(game.id)}
                className="mt-3 rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold text-[#A3E635] transition hover:bg-[#A3E635]/10"
              >
                Abrir sala
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
