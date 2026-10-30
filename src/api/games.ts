import { apiRequest } from "./http";
// Campos que incluye en cada partida del historial
export type GameHistoryItem = {
  id: number;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  createdAt: string;
  finishedAt: string | null;
  score: number;
};

// La respuesta completa de GET /api/me/games
type GameHistoryResponse = {
  items: GameHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};
/* Obtiene la página de partidos del usuario autenticado
apirequest añade Authorization: Bearer "token"*/
export function getMyGames(token: string, page = 1, pageSize = 20) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiRequest<GameHistoryResponse>(`/api/me/games?${query}`, {
    token,
  });
}
// Datos que devuelve POST /api/games al crear una sala multijugador.
export type CreatedMultiplayerGame = {
  id: number;
  status: "WAITING";
  code: string;
};

// Crea una sola y envía  el token para auteticar la petición.
export function createMultiplayerGame(token: string) {
  return apiRequest<CreatedMultiplayerGame>("/api/games", {
    method: "POST",
    token,
    body: { mode: "MULTIPLAYER" },
  });
}
export function joinMultiplayerGame(token: string, code: string) {
  
  return apiRequest<{ id: number; status: string }>("/api/games/join", {
    method: "POST",
    token,
    body: { code },
  });
}

export function deleteWaitingGame(token: string, gameId: number) {
  return apiRequest<void>(`/api/games/${gameId}`, {
    method: "DELETE",
    token,
  });
}

export type GameDetails = {
  id: number;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  players: {
    userId: number;
    turnOrder: number;
    score: number;
    isReady: boolean;
  }[];
  currentTurn: {
    userId: number;
    gameQuestionId: number;
  } | null;

  questions: {
    id: number;
    statement: string;
    answered: boolean;
    choices: {
      id: number;
      text: string;
    }[];
  }[];
};
export function getGame(token: string, gameId: number) {
  return apiRequest<GameDetails>(`/api/games/${gameId}`, { token });
}

export function startMultiplayerGame(token: string, gameId: number) {
  return apiRequest<{
    id: number;
    status: "WAITING" | "ACTIVE";
    started: boolean;
  }>(
    `/api/games/${gameId}/start`,
    { method: "POST", token },
  );
}
export function submitAnswer(
  token: string,
  gameId: number,
  gameQuestionId: number,
  choiceId: number,
) {
  return apiRequest<{ roundComplete: boolean }>(
    `/api/games/${gameId}/answers`,
    {
      method: "POST",
      token,
      body: { gameQuestionId, choiceId },
    },
  );
}
