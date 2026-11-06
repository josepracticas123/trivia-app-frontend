import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { ApiError } from "../api/http";
import { env } from "../config/env";
import { GameParticipants } from "./GameParticipants";
import { GameResult } from "./GameResult";
import { GameScoreboard } from "./GameScoreboard";
import { OnlinePlayers } from "./OnlinePlayers";
import {
  createIndividualGame,
  getGame,
  startMultiplayerGame,
  submitAnswer,
  type GameQuestion,
  type GameDetails,
} from "../api/games";
import "./QuestionCrumple.css";
type GameRoomProps = {
  gameId: number;
  onBack: () => void;
  token: string;
  userId: number;
  onAuthenticationError: () => void;
  onOpenGame: (gameId: number) => void;
};

// Evento privado que emite el backend a los participantes de una sala borrada.
type GameDeletedEvent = { id: number };

export function GameRoom({
  gameId,
  token,
  userId,
  onBack,
  onAuthenticationError,
  onOpenGame,
}: GameRoomProps) {
  const [game, setGame] = useState<GameDetails | null>(null);
  // Impide que una respuesta HTTP más antigua reemplace un estado más reciente.
  const latestTurnVersion = useRef(-1);
  const deletedRoomTimeoutRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isCreatingNextGame, setIsCreatingNextGame] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [isAnswerSending, setIsAnswerSending] = useState(false);
  const [isQuestionCrumpling, setIsQuestionCrumpling] = useState(false);
  const [isFinalQuestionCrumpling, setIsFinalQuestionCrumpling] =
    useState(false);
  const [exitingQuestion, setExitingQuestion] = useState<GameQuestion | null>(null);
  const [socketNotice, setSocketNotice] = useState("");
  // Evita pulsar varias veces mientras recuperamos el estado de la partida.
  const [isRefreshingGame, setIsRefreshingGame] = useState(false);

  const returnAfterRoomDeleted = useCallback(() => {
    setError("El creador ha eliminado la sala. Volviendo a tus partidas…");

    // El evento Socket.IO y un GET posterior pueden llegar casi a la vez.
    // Programamos una única vuelta al listado.
    if (deletedRoomTimeoutRef.current !== null) return;

    deletedRoomTimeoutRef.current = window.setTimeout(() => {
      deletedRoomTimeoutRef.current = null;
      onBack();
    }, 1200);
  }, [onBack]);

  useEffect(() => {
    return () => {
      if (deletedRoomTimeoutRef.current !== null) {
        window.clearTimeout(deletedRoomTimeoutRef.current);
      }
    };
  }, []);

  const loadGame = useCallback(async () => {
    try {
      const response = await getGame(token, gameId);
      if (response.turnVersion >= latestTurnVersion.current) {
        latestTurnVersion.current = response.turnVersion;
        setGame(response);
      }
      setError("");
      setSocketNotice("");
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }

      if (requestError instanceof ApiError && requestError.status === 404) {
        returnAfterRoomDeleted();
        return;
      }

      if (!navigator.onLine) {
        setSocketNotice(
          "Sin conexión. Conservamos el estado actual y lo actualizaremos al reconectar.",
        );
        return;
      }

      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo cargar la partida.",
      );
    }
  }, [gameId, onAuthenticationError, returnAfterRoomDeleted, token]);
  /* Recupera el snapshop persistido del backend tras un error
  LoadGame y atrata 401, 404, conexión y mensajes de API */

  async function handleRefreshGame() {
    setIsRefreshingGame(true);

    try {
      await loadGame();
    } finally {
      setIsRefreshingGame(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadGame);
  }, [loadGame]);

  useEffect(() => {
    function handleOnline() {
      setSocketNotice("Conexión recuperada. Actualizando la partida…");
      void loadGame();
    }

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [loadGame]);

  useEffect(() => {
    const socket = io(env.socketUrl, {
      auth: { token },
    });

    function isAuthenticationSocketError(socketError: {
      message?: string;
      data?: unknown;
    }) {
      const data =
        typeof socketError.data === "object" && socketError.data !== null
          ? socketError.data
          : {};

      const status =
        "status" in data && typeof data.status === "number"
          ? data.status
          : undefined;

      const code =
        "code" in data && typeof data.code === "string" ? data.code : undefined;

      const message = socketError.message?.toLowerCase() ?? "";

      return (
        status === 401 ||
        code === "UNAUTHORIZED" ||
        code === "INVALID_TOKEN" ||
        code === "TOKEN_EXPIRED" ||
        message.includes("unauthorized") ||
        message.includes("jwt") ||
        message.includes("token")
      );
    }

    socket.on("connect", () => {
      setSocketNotice("Conexión recuperada. Actualizando la partida…");
      socket.emit("join:game", gameId);
    });

    socket.on("connect_error", (socketError) => {
      if (isAuthenticationSocketError(socketError)) {
        onAuthenticationError();
        return;
      }

      setSocketNotice("Se ha perdido la conexión. Reintentando conectar…");
    });

    socket.on("disconnect", (reason) => {
      // El backend fuerza esta desconexión cuando vence el JWT. Socket.IO no
      // reintenta automáticamente una desconexión ordenada por el servidor.
      if (reason === "io server disconnect") {
        onAuthenticationError();
        return;
      }

      // Una desconexión iniciada por el desmontaje del componente no requiere aviso.
      if (reason === "io client disconnect") return;

      // El resto son cortes temporales (red, transporte o servidor reiniciando).
      setSocketNotice("Se ha perdido la conexión. Reintentando conectar…");
    });

    socket.on("joined:game", () => {
      setSelectedChoiceId(null);
      void loadGame();
    });

    socket.on("game:updated", (event: { turnVersion: number }) => {
      // Una unión puede conservar turnVersion. Recuperamos el snapshot
      // persistido también en ese caso; loadGame evita retroceder.
      if (event.turnVersion >= latestTurnVersion.current) {
        void loadGame();
      }
    });

    socket.on("error:game", ({ message }: { message: string }) => {
      setError(message);
    });

    function onGameDeleted({ id }: GameDeletedEvent) {
      if (id !== gameId) return;
      returnAfterRoomDeleted();
    }

    socket.on("game:deleted", onGameDeleted);

    return () => {
      socket.off("game:deleted", onGameDeleted);
      socket.disconnect();
    };
  }, [gameId, loadGame, onAuthenticationError, returnAfterRoomDeleted, token]);

  /* Añadimos la acción de iniciar la sala, el bcak decide si el usuario puede hacerlo
si o es creador o falta un jugador, muestra error*/

  async function handleStart() {
    setError("");
    setIsStarting(true);

    try {
      await startMultiplayerGame(token, gameId);
      await loadGame();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo iniciar la partida",
      );
    } finally {
      setIsStarting(false);
    }
  }

  const isMultiplayer = game?.mode === "MULTIPLAYER";
  // En individual no hay currentTurn: nextQuestionId identifica la pregunta propia.
  const currentQuestionId = isMultiplayer
    ? game?.currentTurn?.gameQuestionId
    : game?.nextQuestionId;
  const currentQuestion = game?.questions.find(
    (question) => question.id === currentQuestionId,
  );
  // La posición solo ordena la presentación; al enviar siempre usamos choice.id.
  const totalQuestions = game?.questions.length ?? 0;
  const currentQuestionNumber = currentQuestion
    ? currentQuestion.position + 1
    : totalQuestions;
  const questionProgress =
    totalQuestions > 0
      ? Math.min(100, Math.round((currentQuestionNumber / totalQuestions) * 100))
      : 0;

  const isYourTurn = isMultiplayer
    ? game?.currentTurn?.userId === userId
    : game?.status === "ACTIVE";
  const currentPlayer = game?.players?.find(
    (player) => player.userId === userId,
  );
  const opponent = game?.players?.find((player) => player.userId !== userId);
  const opponentName = opponent?.displayName ?? "tu rival";

  const finalMessage = game?.isDraw
    ? "Empate"
    : game?.winnerUserId === userId
      ? "Ganaste"
      : "Perdiste";
  const ignoreInvitationDirectoryState = useCallback(
    (_isOpen: boolean) => undefined,
    [],
  );
  const refreshHistoryAfterInvite = useCallback(() => undefined, []);

  async function handleAnswer(choiceId: number) {
    if (!currentQuestion || isAnswerSending) return;

    setError("");
    setSelectedChoiceId(choiceId);
    setExitingQuestion(currentQuestion);
    setIsAnswerSending(true);
    try {
      const response = await submitAnswer(
        token,
        gameId,
        currentQuestion.id,
        choiceId,
      );
      const shouldCrumple =
        (isMultiplayer && currentQuestionNumber === totalQuestions) ||
        ("finished" in response && response.finished);

      if (shouldCrumple) {
        setIsFinalQuestionCrumpling(false);
        setIsQuestionCrumpling(true);
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, 620),
        );
        setIsQuestionCrumpling(false);
        setIsFinalQuestionCrumpling(false);
        setExitingQuestion(null);
      } else {
        setSelectedChoiceId(null);
        setExitingQuestion(null);
      }
      await loadGame();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo enviar la respuesta.",
      );
      setIsQuestionCrumpling(false);
      setIsFinalQuestionCrumpling(false);
      setExitingQuestion(null);
    } finally {
      setIsAnswerSending(false);
    }
  }

  async function handlePlayAgain() {
    setError("");
    setIsCreatingNextGame(true);

    try {
      const nextGame = await createIndividualGame(token);
      onOpenGame(nextGame.id);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "No se pudo crear otra partida.",
      );
    } finally {
      setIsCreatingNextGame(false);
    }
  }

  const displayedQuestion = exitingQuestion ?? currentQuestion;
  const displayedChoices = displayedQuestion
    ? [...displayedQuestion.choices].sort((a, b) => a.position - b.position)
    : [];

  return (
    <section className="ambient-card relative z-10 rounded-3xl border border-[#2B2B2B] bg-[#141414] p-4 shadow-2xl shadow-black/30 sm:p-8">
      <OnlinePlayers
        token={token}
        userId={userId}
        onOpenGame={onOpenGame}
        onRefreshHistory={refreshHistoryAfterInvite}
        isOpen={false}
        onOpenChange={ignoreInvitationDirectoryState}
        showDirectory={false}
      />
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-[#A3A3A3] transition hover:text-[#A3E635]"
      >
        ← Volver
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black sm:text-2xl">Sala #{gameId}</h2>
        {game && (
          <span className="rounded-full border border-[#3D3D3D] bg-[#0D0D0D] px-3 py-1 text-xs font-bold text-[#A3E635]">
            {game.status}
          </span>
        )}
      </div>

      {error && (
        <div
          className="mt-5 rounded-lg bg-red-950/60 p-3 text-sm text-red-200"
          role="alert"
        >
          <p>{error}</p>

          {/* Recupera el estado antes de que el usuario vuelva a intentar una acción. */}
          <button
            type="button"
            onClick={() => void handleRefreshGame()}
            disabled={isRefreshingGame || isStarting || isAnswerSending}
            className="mt-3 rounded border border-red-200/60 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900/50 disabled:cursor-wait disabled:opacity-60"
          >
            {isRefreshingGame ? "Actualizando…" : "Actualizar estado"}
          </button>
        </div>
      )}
      {socketNotice && (
        <p
          className="mt-5 rounded-lg border border-amber-400/40 bg-amber-950/30 p-3 text-sm text-amber-100"
          role="status"
        >
          {socketNotice}
        </p>
      )}

      {!error && !game && <p>Cargando sala…</p>}

      {game?.status === "WAITING" && (
        <div className="mt-6 space-y-4">
          <GameParticipants currentPlayer={currentPlayer} opponent={opponent} />
          {currentPlayer?.isReady ? (
            <p className="text-sm text-[#A3A3A3]" role="status">
              Esperando a tu rival.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting}
                className="rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-bold text-[#090909] transition hover:bg-[#BEF264] disabled:cursor-wait disabled:opacity-60"
              >
                {isStarting ? "Confirmando..." : "Prepararme"}
              </button>
            </>
          )}
        </div>
      )}

      {game?.status === "ACTIVE" && isMultiplayer && (
        <GameScoreboard
          currentPlayer={currentPlayer}
          opponent={opponent}
          opponentName={opponentName}
        />
      )}

      {(game?.status === "ACTIVE" || exitingQuestion) &&
        displayedQuestion &&
        (isYourTurn || exitingQuestion) && (
        <article
          className={`question-card ambient-card mx-auto mt-6 max-w-xl rounded-2xl border border-[#2B2B2B] bg-[#0D0D0D] p-4 sm:p-6 ${
            isQuestionCrumpling ? "question-card--crumpling" : ""
          } ${isFinalQuestionCrumpling ? "question-card--final-fold" : ""}`}
          aria-busy={isQuestionCrumpling}
        >
          <h3 className="text-lg font-bold text-[#A3E635]">Tu pregunta</h3>
          <p className="mt-1 text-sm text-[#A3A3A3]">
            Pregunta {currentQuestionNumber} de {totalQuestions} · Tu turno
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2B2B2B]"
            role="progressbar"
            aria-label="Progreso de la partida"
            aria-valuemin={1}
            aria-valuemax={totalQuestions}
            aria-valuenow={currentQuestionNumber}
          >
            <div
              className="h-full rounded-full bg-[#A3E635] transition-[width] duration-300"
              style={{ width: `${questionProgress}%` }}
            />
          </div>
          <p className="mt-3 text-base text-[#F8FAFC] sm:text-lg">
            {displayedQuestion.statement}
          </p>

          <div className="mt-5 grid gap-3">
            {/* No usamos el índice: texto, posición e id proceden de la misma GameChoice. */}
            {displayedChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={isAnswerSending}
                onClick={() => handleAnswer(choice.id)}
                className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition sm:px-4 sm:text-base ${
                  selectedChoiceId === choice.id
                    ? "border-[#A3E635] bg-[#A3E635]/10 text-[#F8FAFC]"
                    : "border-[#3D3D3D] bg-[#141414] text-[#D4D4D4] hover:border-[#A3E635]"
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

      {game?.status === "ACTIVE" && isMultiplayer && !isYourTurn && (
        <p className="mt-6 text-center text-sm font-semibold text-[#A3A3A3]">
          Turno de {opponentName}. Esperando su respuesta…
        </p>
      )}

      {game?.status === "FINISHED" && !exitingQuestion && (
        <GameResult
          isMultiplayer={isMultiplayer}
          finalMessage={finalMessage}
          score={game.score}
          currentPlayer={currentPlayer}
          opponent={opponent}
          opponentName={opponentName}
          onBack={onBack}
          onPlayAgain={isMultiplayer ? undefined : () => void handlePlayAgain()}
          isPlayingAgain={isCreatingNextGame}
        />
      )}
    </section>
  );
}
