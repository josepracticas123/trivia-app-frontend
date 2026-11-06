import type { GamePlayer } from "../api/games";

type GameResultProps = {
  isMultiplayer: boolean;
  finalMessage: string;
  score: number;
  currentPlayer?: GamePlayer;
  opponent?: GamePlayer;
  opponentName: string;
  onBack: () => void;
  onPlayAgain?: () => void;
  isPlayingAgain?: boolean;
};

// Cierra una partida sin calcular el ganador: solo presenta datos del backend.
export function GameResult({
  isMultiplayer,
  finalMessage,
  score,
  currentPlayer,
  opponent,
  opponentName,
  onBack,
  onPlayAgain,
  isPlayingAgain = false,
}: GameResultProps) {
  return (
    <section
      className="mt-6 rounded-xl border border-[#A3E635]/40 bg-[#A3E635]/10 p-5"
      role="status"
    >
      <h3 className="text-xl font-black text-[#A3E635]">
        {isMultiplayer ? finalMessage : "Partida finalizada"}
      </h3>

      {isMultiplayer ? (
        <>
          <p className="mt-3">
            Tú ({currentPlayer?.displayName}):{" "}
            <strong>{currentPlayer?.score ?? 0} puntos</strong>
          </p>
          <p className="mt-1">
            {opponentName}: <strong>{opponent?.score ?? 0} puntos</strong>
          </p>
        </>
      ) : (
        <p className="mt-3">
          Tu puntuación final: <strong>{score} puntos</strong>
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {!isMultiplayer && onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={isPlayingAgain}
            className="rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-semibold text-[#090909] disabled:opacity-60"
          >
            {isPlayingAgain ? "Creando partida…" : "Jugar otra partida"}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#A3E635] px-4 py-2 text-sm font-semibold text-[#A3E635]"
        >
          Volver a mis partidas
        </button>
      </div>
    </section>
  );
}
