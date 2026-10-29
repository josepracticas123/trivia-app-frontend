import { useEffect, useState } from "react";
import {
  createMultiplayerGame,
  getMyGames,
  type GameHistoryItem,
} from "../api/games";
import { ApiError } from "../api/http";

type GameLobbyProps = {
  token: string;
  onLogout: () => void;
};

export function GameLobby({ token, onLogout }: GameLobbyProps) {
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  //Evitar crear varias salas mientras la petición está pendiente
  const [isCreating, setIsCreating] = useState(false);
  //Guardamos el cóigo para mostrásrselo al usuario después de crear la sala.
  const [createdRoomCode, setCreatedRoomCode] = useState("");

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
  }, [token, reloadKey]);
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
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo crear la sala. Revisa la conexión e inténntalo de nuevo.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function getStatusLabel(status: GameHistoryItem["status"]) {
    if (status === "WAITING") return "Esperando rival";
    if (status === "ACTIVE") return "En curso";
    return "Finalizada";
  }

  return (
    <section className="rounded-3xl border border-[#2A344A] bg-[#151B2B] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">Tus partidas</h2>

        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-semibold text-[#94A3B8] hover:text-[#A3E635]"
        >
          Cerrar sesión
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-5 rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-bold text-[#0B0F1A] disabled:cursor-wait disabled:opacity-60"
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
          className="mt-5 rounded-lg border border-[#3A4660] px-4 py-2 text-sm font-semibold hover:border-[#A3E635] disabled:opacity-60"
        >
          {isLoading ? "Cargando…" : "Actualizar"}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && games.length === 0 && (
        <p className="mt-6 text-sm text-[#94A3B8]">
          Todavía no tienes partidas.
        </p>
      )}

      {games.length > 0 && (
        <ul className="mt-6 space-y-3">
          {games.map((game) => (
            <li
              key={game.id}
              className="rounded-xl border border-[#2A344A] bg-[#101625] p-4"
            >
              <p className="font-semibold">Partida #{game.id}</p>
              <p className="mt-1 text-sm text-[#94A3B8]">
                {getStatusLabel(game.status)} · Puntuación: {game.score}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
