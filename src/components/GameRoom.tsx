import { useEffect, useState } from "react";
import { getGame, type GameDetails } from "../api/games";
import { ApiError } from "../api/http";

type GameRoomProps = {
  gameId: number;
  onBack: () => void;
  token: string;
};

export function GameRoom({ gameId, token, onBack }: GameRoomProps) {
  const [game, setGame] = useState<GameDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadGame() {
      try {
        const response = await getGame(token, gameId);
        setGame(response);
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "No se pudo cargar la partida.",
        );
      }
    }

    void loadGame();
  }, [gameId, token]);

  return (
    <section>
      <button type="button" onClick={onBack}>
        ← Volver
      </button>

      <h2>Sala #{gameId}</h2>

      {error && <p role="alert">{error}</p>}

      {!error && !game && <p>Cargando sala…</p>}

      {game && <p>Estado: {game.status}</p>}
    </section>
  );
}
