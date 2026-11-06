import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "../config/env";
import ElectricBorder from "./ElectricBorder";

type AvailablePlayer = {
  userId: number;
  displayName: string;
  status: "AVAILABLE";
};

type PresenceChange = {
  userId: number;
  displayName: string;
  status: "AVAILABLE" | "IN_GAME" | "OFFLINE";
};

type IncomingInvite = {
  inviteId: string;
  from: { userId: number; displayName: string };
  expiresAt: string;
};

type OutgoingInvite = {
  inviteId: string;
  receiverName: string;
  expiresAt: string;
};

type InviteAck =
  | { ok: true; inviteId: string; expiresAt?: string; gameId?: number; status?: "WAITING" }
  | { ok: false; error: string };

type PendingAcceptanceRecovery = {
  inviteId: string;
  retryUsed: boolean;
};

type OnlinePlayersProps = {
  token: string;
  userId: number;
  onOpenGame: (gameId: number) => void;
  onRefreshHistory: () => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  showDirectory?: boolean;
};

const PRESENCE_LIMIT = 50;
const INVITE_ACK_TIMEOUT_MS = 12_000;

const inviteErrorMessages: Record<string, string> = {
  SELF_INVITE: "No puedes invitarte a ti mismo.",
  USER_NOT_AVAILABLE: "Ese jugador ya no está disponible.",
  OUTGOING_INVITE_PENDING: "Ya tienes una invitación pendiente.",
  INVITE_ALREADY_PENDING: "Ya hay una invitación pendiente entre vosotros.",
  INVITE_RATE_LIMITED: "Has alcanzado el límite de invitaciones. Prueba más tarde.",
  TOO_MANY_PENDING_INVITES: "El jugador ya tiene demasiadas invitaciones pendientes.",
  INVITE_NOT_FOUND: "La invitación ya no está disponible.",
  NOT_INVITE_RECIPIENT: "No puedes responder a esa invitación.",
  NOT_INVITE_SENDER: "No puedes cancelar esa invitación.",
  INVITE_EXPIRED: "La invitación ha caducado.",
  INVITE_NOT_PENDING: "La invitación ya no está pendiente.",
  INVITE_UNAVAILABLE: "La invitación ya no está disponible.",
  VALIDATION_ERROR: "Los datos de la invitación no son válidos.",
  CONFLICT: "No se pudo completar la invitación por un cambio de estado.",
  INTERNAL_ERROR: "No se pudo completar la invitación. Inténtalo de nuevo.",
  CONNECTION_LOST: "Se perdió la conexión. Comprueba el estado de la invitación e inténtalo de nuevo.",
  ACK_TIMEOUT: "El servidor tarda en responder. Comprueba tu conexión e inténtalo de nuevo.",
};

function inviteErrorMessage(code: string) {
  return inviteErrorMessages[code] ?? "No se pudo completar la invitación.";
}

function mergePlayer(players: AvailablePlayer[], player: AvailablePlayer) {
  const index = players.findIndex((current) => current.userId === player.userId);
  if (index < 0) return [...players, player].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return players.map((current) => (current.userId === player.userId ? player : current));
}

function getRemainingTime(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function OnlinePlayers({
  token,
  userId,
  onOpenGame,
  onRefreshHistory,
  isOpen,
  onOpenChange,
  showDirectory = true,
}: OnlinePlayersProps) {
  const socketRef = useRef<Socket | null>(null);
  const acceptedGamesRef = useRef(new Set<number>());
  const acceptanceRecoveryRef = useRef<PendingAcceptanceRecovery | null>(null);
  const ignoredAcceptedInvitesRef = useRef(new Set<string>());
  const recoverAcceptanceRef = useRef<() => void>(() => undefined);
  const lastRequestWasFirstPageRef = useRef(true);
  const requestPresenceRef = useRef<(cursor?: number) => void>(() => undefined);
  const inviteDialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const [players, setPlayers] = useState<AvailablePlayer[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [presenceError, setPresenceError] = useState("");
  const [notice, setNotice] = useState("");
  const [incomingInvites, setIncomingInvites] = useState<IncomingInvite[]>([]);
  const [outgoingInvite, setOutgoingInvite] = useState<OutgoingInvite | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [recoveryInviteId, setRecoveryInviteId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const removeInvite = useCallback((inviteId: string) => {
    setIncomingInvites((current) => current.filter((invite) => invite.inviteId !== inviteId));
    setOutgoingInvite((current) => (current?.inviteId === inviteId ? null : current));
    setBusyInviteId((current) => (current === inviteId ? null : current));
  }, []);

  const completeInviteAcceptance = useCallback((inviteId: string, gameId: number) => {
    removeInvite(inviteId);
    if (acceptanceRecoveryRef.current?.inviteId === inviteId) {
      acceptanceRecoveryRef.current = null;
      setRecoveryInviteId(null);
    }
    if (acceptedGamesRef.current.has(gameId)) return;

    acceptedGamesRef.current.add(gameId);
    onRefreshHistory();
    onOpenGame(gameId);
  }, [onOpenGame, onRefreshHistory, removeInvite]);

  useEffect(() => {
    if (incomingInvites.length === 0 && !outgoingInvite) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [incomingInvites.length, outgoingInvite]);

  useEffect(() => {
    const socket = io(env.socketUrl, { auth: { token } });
    socketRef.current = socket;

    const requestPresence = (cursor?: number) => {
      setIsLoading(true);
      lastRequestWasFirstPageRef.current = cursor === undefined;
      if (cursor === undefined) setPresenceError("");
      socket.emit("presence:request", cursor === undefined ? { limit: PRESENCE_LIMIT } : { limit: PRESENCE_LIMIT, cursor });
    };
    requestPresenceRef.current = requestPresence;
    const requestFirstPage = () => requestPresence();
    const onPresenceAvailable = (payload: { items: AvailablePlayer[]; nextCursor: number | null }) => {
      setPlayers((current) => {
        const incoming = payload.items.filter(
          (player) => player.status === "AVAILABLE" && player.userId !== userId,
        );
        return lastRequestWasFirstPageRef.current ? incoming : incoming.reduce(mergePlayer, current);
      });
      setNextCursor(payload.nextCursor);
      setIsLoading(false);
      setPresenceError("");
    };
    const onPresenceChanged = (player: PresenceChange) => {
      if (player.status === "AVAILABLE" && player.userId !== userId) {
        setPlayers((current) =>
          mergePlayer(current, { ...player, status: "AVAILABLE" }),
        );
        return;
      }
      setPlayers((current) => current.filter((currentPlayer) => currentPlayer.userId !== player.userId));
    };
    const onPresenceError = (payload: { message: string }) => {
      setPresenceError(payload.message || "No se pudo cargar la presencia.");
      setIsLoading(false);
    };
    const onInvite = (invite: IncomingInvite) => {
      setIncomingInvites((current) =>
        current.some((item) => item.inviteId === invite.inviteId) ? current : [...current, invite],
      );
    };
    const onInviteAccepted = (payload: { inviteId: string; gameId: number; status: "WAITING" }) => {
      if (ignoredAcceptedInvitesRef.current.has(payload.inviteId)) return;
      completeInviteAcceptance(payload.inviteId, payload.gameId);
    };
    const onInviteRejected = (payload: { inviteId: string }) => {
      setOutgoingInvite((current) => {
        if (current?.inviteId === payload.inviteId) setNotice("La invitación fue rechazada.");
        return current?.inviteId === payload.inviteId ? null : current;
      });
      setIncomingInvites((current) => current.filter((invite) => invite.inviteId !== payload.inviteId));
      setBusyInviteId((current) => (current === payload.inviteId ? null : current));
    };
    const onInviteCancelled = (payload: { inviteId: string }) => {
      clearAcceptanceRecovery(payload.inviteId);
      removeInvite(payload.inviteId);
      setNotice("La invitación se ha cancelado.");
    };
    const onInviteExpired = (payload: { inviteId: string }) => {
      clearAcceptanceRecovery(payload.inviteId);
      removeInvite(payload.inviteId);
      setNotice("La invitación ha caducado.");
    };

    const onConnect = () => {
      requestFirstPage();
      recoverAcceptanceRef.current();
    };

    socket.on("connect", onConnect);
    socket.on("presence:available", onPresenceAvailable);
    socket.on("presence:changed", onPresenceChanged);
    socket.on("presence:error", onPresenceError);
    socket.on("game:invite", onInvite);
    socket.on("game:invite:accepted", onInviteAccepted);
    socket.on("game:invite:rejected", onInviteRejected);
    socket.on("game:invite:cancelled", onInviteCancelled);
    socket.on("game:invite:expired", onInviteExpired);

    return () => {
      socket.off("connect", onConnect);
      socket.off("presence:available", onPresenceAvailable);
      socket.off("presence:changed", onPresenceChanged);
      socket.off("presence:error", onPresenceError);
      socket.off("game:invite", onInvite);
      socket.off("game:invite:accepted", onInviteAccepted);
      socket.off("game:invite:rejected", onInviteRejected);
      socket.off("game:invite:cancelled", onInviteCancelled);
      socket.off("game:invite:expired", onInviteExpired);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      requestPresenceRef.current = () => undefined;
    };
  }, [completeInviteAcceptance, removeInvite, token, userId]);

  useEffect(() => {
    const expiredIncoming = incomingInvites.filter((invite) => new Date(invite.expiresAt).getTime() <= now);
    if (expiredIncoming.length > 0) {
      const expiredIds = new Set(expiredIncoming.map((invite) => invite.inviteId));
      setIncomingInvites((current) => current.filter((invite) => !expiredIds.has(invite.inviteId)));
    }
  }, [incomingInvites, now]);

  function emitInvite(
    event: "game:invite:send" | "game:invite:accept" | "game:invite:reject" | "game:invite:cancel",
    payload: Record<string, string | number>,
    onLateAck?: (ack: InviteAck) => void,
  ) {
    return new Promise<InviteAck>((resolve) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        resolve({ ok: false, error: "CONNECTION_LOST" });
        return;
      }

      let settled = false;
      const finish = (ack: InviteAck) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        socket.off("disconnect", onDisconnect);
        resolve(ack);
      };
      const onDisconnect = () => finish({ ok: false, error: "CONNECTION_LOST" });
      const timeout = window.setTimeout(
        () => finish({ ok: false, error: "ACK_TIMEOUT" }),
        INVITE_ACK_TIMEOUT_MS,
      );

      socket.on("disconnect", onDisconnect);
      socket.emit(event, payload, (ack: InviteAck | undefined) => {
        const result = ack ?? { ok: false, error: "INTERNAL_ERROR" };
        if (settled) {
          onLateAck?.(result);
          return;
        }
        finish(result);
      });
    });
  }

  function clearAcceptanceRecovery(inviteId: string) {
    if (acceptanceRecoveryRef.current?.inviteId !== inviteId) return;
    acceptanceRecoveryRef.current = null;
    setRecoveryInviteId(null);
  }

  function handleAcceptanceAck(operation: PendingAcceptanceRecovery, ack: InviteAck) {
    if (acceptanceRecoveryRef.current !== operation) return;

    if (ack.ok) {
      if (typeof ack.gameId === "number" && Number.isSafeInteger(ack.gameId) && ack.gameId > 0) {
        completeInviteAcceptance(operation.inviteId, ack.gameId);
        return;
      }

      setRecoveryInviteId(operation.inviteId);
      setNotice("La aceptación pudo confirmarse, pero no se recibió el identificador de la sala. Comprueba tus partidas.");
      return;
    }

    if (
      operation.retryUsed ||
      ack.error === "CONNECTION_LOST" ||
      ack.error === "ACK_TIMEOUT"
    ) {
      setRecoveryInviteId(operation.inviteId);
      setNotice("No se pudo confirmar el resultado de la aceptación. Comprueba tus partidas; no se creará otra sala automáticamente.");
      return;
    }

    clearAcceptanceRecovery(operation.inviteId);
    setNotice(inviteErrorMessage(ack.error));
  }

  function recoverPendingAcceptance() {
    const operation = acceptanceRecoveryRef.current;
    const socket = socketRef.current;
    if (!operation || operation.retryUsed || !socket?.connected) return;

    operation.retryUsed = true;
    setRecoveryInviteId(operation.inviteId);
    setBusyInviteId(operation.inviteId);
    setNotice("Conexión recuperada. Comprobando el resultado de la aceptación…");
    void emitInvite(
      "game:invite:accept",
      { inviteId: operation.inviteId },
      (lateAck) => handleAcceptanceAck(operation, lateAck),
    ).then((ack) => {
      handleAcceptanceAck(operation, ack);
      setBusyInviteId((current) => current === operation.inviteId ? null : current);
    });
  }

  useEffect(() => {
    recoverAcceptanceRef.current = recoverPendingAcceptance;
  });

  function openHistoryForRecovery() {
    const inviteId = recoveryInviteId;
    if (!inviteId) return;

    ignoredAcceptedInvitesRef.current.add(inviteId);
    clearAcceptanceRecovery(inviteId);
    setIncomingInvites((current) => current.filter((invite) => invite.inviteId !== inviteId));
    setBusyInviteId((current) => current === inviteId ? null : current);
    onRefreshHistory();
    onOpenChange(false);
  }

  async function handleSendInvite(player: AvailablePlayer) {
    setNotice("");
    setBusyInviteId(`send-${player.userId}`);
    const ack = await emitInvite("game:invite:send", { receiverId: player.userId });
    setBusyInviteId(null);
    if (!ack.ok || !ack.expiresAt) {
      setNotice(inviteErrorMessage(ack.ok ? "INTERNAL_ERROR" : ack.error));
      return;
    }
    setOutgoingInvite({ inviteId: ack.inviteId, receiverName: player.displayName, expiresAt: ack.expiresAt });
    setNotice("Invitación enviada.");
  }

  async function handleInviteAction(event: "game:invite:accept" | "game:invite:reject" | "game:invite:cancel", inviteId: string) {
    if (event === "game:invite:accept" && acceptanceRecoveryRef.current?.inviteId === inviteId) {
      setNotice("La aceptación sigue pendiente de recuperación. Comprueba tus partidas o espera a que vuelva la conexión.");
      return;
    }

    setNotice("");
    setBusyInviteId(inviteId);
    const operation = event === "game:invite:accept"
      ? { inviteId, retryUsed: false }
      : null;
    if (operation) {
      ignoredAcceptedInvitesRef.current.delete(inviteId);
      acceptanceRecoveryRef.current = operation;
    }

    const ack = await emitInvite(
      event,
      { inviteId },
      operation ? (lateAck) => handleAcceptanceAck(operation, lateAck) : undefined,
    );

    if (operation) {
      handleAcceptanceAck(operation, ack);
      setBusyInviteId((current) => current === inviteId ? null : current);
      return;
    }

    if (!ack.ok) {
      setBusyInviteId(null);
      setNotice(inviteErrorMessage(ack.error));
      return;
    }
    setIncomingInvites((current) => current.filter((invite) => invite.inviteId !== inviteId));
    setOutgoingInvite((current) => (current?.inviteId === inviteId ? null : current));
    setBusyInviteId(null);
  }

  const currentInvite = incomingInvites[0];
  const outgoingExpired = outgoingInvite && new Date(outgoingInvite.expiresAt).getTime() <= now;
  const isRecoveringCurrentInvite = currentInvite?.inviteId === recoveryInviteId;

  useEffect(() => {
    const inviteId = currentInvite?.inviteId;
    if (!inviteId) return;

    const previouslyFocused = document.activeElement;
    previousFocusedElementRef.current =
      previouslyFocused instanceof HTMLElement ? previouslyFocused : null;
    inviteDialogRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();

    return () => {
      previousFocusedElementRef.current?.focus();
      previousFocusedElementRef.current = null;
    };
  }, [currentInvite?.inviteId]);

  function handleInviteDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const inviteId = currentInvite?.inviteId;
    if (!inviteId) return;

    if (event.key === "Escape") {
      if (busyInviteId === inviteId || isRecoveringCurrentInvite) return;
      event.preventDefault();
      void handleInviteAction("game:invite:reject", inviteId);
      return;
    }

    if (event.key !== "Tab") return;
    const actions = Array.from(
      inviteDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (actions.length === 0) return;

    const firstAction = actions[0];
    const lastAction = actions[actions.length - 1];
    if (event.shiftKey && document.activeElement === firstAction) {
      event.preventDefault();
      lastAction.focus();
    } else if (!event.shiftKey && document.activeElement === lastAction) {
      event.preventDefault();
      firstAction.focus();
    }
  }

  return (
    <>
      {showDirectory && (
        <section className="mt-6 rounded-xl border border-[#2B2B2B] bg-[#0D0D0D] p-4" aria-busy={isLoading}>
      <details className="group" open={isOpen} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-left marker:content-none">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#A3E635]">
              JUGADORES DISPONIBLES <span className="ml-1 normal-case tracking-normal text-[#D4D4D4]">· {isLoading ? "buscando jugadores…" : `${players.length} ${players.length === 1 ? "disponible" : "disponibles"}`}</span>
            </p>
            <p className="mt-1 text-sm text-[#A3A3A3]">Invita a alguien disponible a una sala privada.</p>
          </div>
          <span className="text-xl text-[#A3E635] transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>

        <div className="mt-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => requestPresenceRef.current()} className="text-sm font-semibold text-[#A3E635] hover:text-[#BEF264]">
              Actualizar
            </button>
          </div>
          {presenceError && <p className="mt-3 text-sm text-amber-200" role="alert">{presenceError} <button type="button" onClick={() => requestPresenceRef.current()} className="underline">Reintentar</button></p>}
          {notice && <p className="mt-3 text-sm text-[#D4D4D4]" role="status">{notice} {recoveryInviteId && <button type="button" onClick={openHistoryForRecovery} className="ml-1 font-semibold text-[#A3E635] underline">Ver mis partidas</button>}</p>}

          <ul className="mt-4 space-y-2" aria-label="Jugadores disponibles">
        {players.map((player) => (
          <li key={player.userId} className="flex items-center justify-between gap-3 rounded-lg border border-[#2B2B2B] bg-[#141414] px-3 py-2">
            <span className="min-w-0 truncate text-sm font-semibold"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#A3E635]" />{player.displayName}</span>
            <button type="button" onClick={() => void handleSendInvite(player)} disabled={busyInviteId !== null || outgoingInvite !== null} className="shrink-0 rounded-lg border border-[#A3E635] px-3 py-1.5 text-sm font-semibold text-[#A3E635] disabled:cursor-not-allowed disabled:opacity-50">
              {busyInviteId === `send-${player.userId}` ? "Enviando…" : "Invitar"}
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && !presenceError && players.length === 0 && <p className="mt-4 text-sm text-[#A3A3A3]">Ahora mismo no hay jugadores disponibles.</p>}
      {nextCursor !== null && <button type="button" disabled={isLoading} onClick={() => requestPresenceRef.current(nextCursor)} className="mt-4 rounded-lg border border-[#3D3D3D] px-3 py-2 text-sm font-semibold text-[#D4D4D4] disabled:opacity-60">{isLoading ? "Cargando…" : "Ver más jugadores"}</button>}

      {outgoingInvite && !outgoingExpired && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#A3E635]/35 bg-[#A3E635]/10 p-3" role="status"><span className="text-sm">Invitación enviada a <strong>{outgoingInvite.receiverName}</strong> · caduca en {getRemainingTime(outgoingInvite.expiresAt, now)}</span><button type="button" disabled={busyInviteId === outgoingInvite.inviteId} onClick={() => void handleInviteAction("game:invite:cancel", outgoingInvite.inviteId)} className="text-sm font-semibold text-[#A3E635] underline disabled:opacity-60">Cancelar</button></div>}
        </div>
      </details>
        </section>
      )}

      {currentInvite && new Date(currentInvite.expiresAt).getTime() > now && (
        <div ref={inviteDialogRef} onKeyDown={handleInviteDialogKeyDown} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="invite-title" aria-describedby="invite-description" tabIndex={-1}>
          <ElectricBorder color="#A3E635" glowColor="#BEF264" borderRadius={16} className="w-full max-w-sm" style={undefined}>
            <div className="rounded-2xl border border-[#A3E635]/50 bg-[#141414] p-6 shadow-2xl">
              <p className="text-xs font-bold tracking-[0.18em] text-[#A3E635]">INVITACIÓN PRIVADA</p>
              <h3 id="invite-title" className="mt-3 text-xl font-black">{currentInvite.from.displayName} quiere jugar contigo</h3>
              <p id="invite-description" className="mt-2 text-sm text-[#A3A3A3]">La invitación caduca en {getRemainingTime(currentInvite.expiresAt, now)}.</p>
              <div className="mt-6 flex gap-3">
                <button type="button" disabled={busyInviteId === currentInvite.inviteId || isRecoveringCurrentInvite} onClick={() => void handleInviteAction("game:invite:accept", currentInvite.inviteId)} className="rounded-lg bg-[#A3E635] px-4 py-2 text-sm font-bold text-[#090909] disabled:opacity-60">{isRecoveringCurrentInvite ? "Comprobando…" : "Aceptar"}</button>
                <button type="button" disabled={busyInviteId === currentInvite.inviteId || isRecoveringCurrentInvite} onClick={() => void handleInviteAction("game:invite:reject", currentInvite.inviteId)} className="rounded-lg border border-[#3D3D3D] px-4 py-2 text-sm font-semibold disabled:opacity-60">Rechazar</button>
              </div>
            </div>
          </ElectricBorder>
        </div>
      )}
    </>
  );
}
