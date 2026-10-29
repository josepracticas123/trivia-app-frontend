import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { ApiError } from "../api/http";
import {
  getGame,
  startMultiplayerGame,
  submitAnswer,
  type GameDetails,
} from "../api/games";
type GameRoomProps = {
  gameId: number;
  onBack: () => void;
  token: string;
  userId: number;
};

export function GameRoom({ gameId, token, userId, onBack }: GameRoomProps) {
  const [game, setGame] = useState<GameDetails | null>(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [isAnswerSending, setIsAnswerSending] = useState(false);
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
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
    });

    socket.on("connect", () => {
      socket.emit("join:game", gameId);
    });
    socket.on("game:updated", async ({ id }) => {
      if (id !== gameId) return;

      try {
        setGame(await getGame(token, gameId));
        setSelectedChoiceId(null);
      } catch {
        setError("No se pudo actualizar la partida.");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId, token]);
  /* Añadimos la acción de iniciar la sala, el bcak decide si el usuario puede hacerlo
si o es creador o falta un jugador, muestra error*/

  async function handleStart() {
    setError("");
    setIsStarting(true);

    try {
      await startMultiplayerGame(token, gameId);
      setGame(await getGame(token, gameId));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo iniciar la partida",
      );
    } finally {
      setIsStarting(false);
    }
  }

  const currentQuestion = game?.questions.find(
    (question) => question.id === game.currentTurn?.gameQuestionId,
  );
  const isYourTurn = game?.currentTurn?.userId === userId;

  async function handleAnswer(choiceId: number) {
    if (!currentQuestion || isAnswerSending) return;

    setError("");
    setSelectedChoiceId(choiceId);
    setIsAnswerSending(true);
    try {
      await submitAnswer(token, gameId, currentQuestion.id, choiceId);
      setGame(await getGame(token, gameId));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo enviar la respuesta.",
      );
    } finally {
      setIsAnswerSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#2A344A] bg-[#151B2B] p-4 shadow-2xl shadow-black/30 sm:p-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-[#94A3B8] transition hover:text-[#A3E635]"
      >
        ← Volver
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black sm:text-2xl">Sala #{gameId}</h2>
        {game && (
          <span className="rounded-full border border-[#3A4660] bg-[#101625] px-3 py-1 text-xs font-bold text-[#A3E635]">
            {game.status}
          </span>
        )}
      </div>

      {error && (
        <p
          className="mt-5 rounded-lg bg-red-950/60 p-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && !game && <p>Cargando sala…</p>}

      {game?.status === "WAITING" && (
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting}
          className="mt-6 rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-bold text-[#0B0F1A] transition hover:bg-[#BEF264] disabled:cursor-wait disabled:opacity-60"
        >
          {isStarting ? "Iniciando..." : "Iniciar partida"}
        </button>
      )}
      {game?.status === "ACTIVE" && currentQuestion && isYourTurn && (
        <article className="mx-auto mt-6 max-w-xl rounded-2xl border border-[#2A344A] bg-[#101625] p-4 sm:p-6">
          <h3 className="text-lg font-bold text-[#A3E635]">Tu pregunta</h3>
          <p className="mt-3 text-base text-[#F8FAFC] sm:text-lg">
            {currentQuestion.statement}
          </p>

          <div className="mt-5 grid gap-3">
            {currentQuestion.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={isAnswerSending}
                onClick={() => handleAnswer(choice.id)}
                className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition sm:px-4 sm:text-base ${
                  selectedChoiceId === choice.id
                    ? "border-[#A3E635] bg-[#A3E635]/10 text-[#F8FAFC]"
                    : "border-[#3A4660] bg-[#151B2B] text-[#CBD5E1] hover:border-[#A3E635]"
                }`}
              >
                {choice.text}
              </button>
            ))}
          </div>

          {selectedChoiceId !== null && (
            <p className="mt-4 text-sm font-semibold text-[#A3E635]">
              Respuesta seleccionada.
            </p>
          )}
        </article>
      )}

      {game?.status === "ACTIVE" && !isYourTurn && (
        <p className="mt-6 text-center text-sm font-semibold text-[#94A3B8]">
          Esperando a que el otro jugador responda...
        </p>
      )}
    </section>
  );
}
