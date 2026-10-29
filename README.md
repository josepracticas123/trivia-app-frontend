# Trivia App — Frontend

Interfaz React para el reto 20: registro, inicio de sesión y una partida de trivia de dos personas.

## Tecnologías

- React + Vite + TypeScript
- Socket.IO Client para actualizaciones en tiempo real
- API HTTP con JWT en la cabecera `Authorization`

## Arranque local

1. Copia `.env.example` como `.env.local`.
2. Ajusta `VITE_API_URL` y `VITE_SOCKET_URL` a la URL del backend.
3. Instala y arranca el proyecto:

   ```bash
   npm install
   npm run dev
   ```

Comprobaciones requeridas:

```bash
npm run typecheck
npm run build
```

## Estructura actual

- `src/api/`: cliente HTTP y errores de API.
- `src/config/`: configuración pública procedente de variables Vite.
- `src/components/`: formularios y controles reutilizables.
- `src/features/`: módulos de partidas (se crearán al integrar ese flujo).
- `src/socket/`: conexión Socket.IO autenticada (se añadirá con los eventos reales del backend).

No se guardan credenciales de base de datos ni `JWT_SECRET` en este repositorio. El token de sesión se mantendrá solamente en memoria.

## Contratos del backend revisados

- Registro: `POST /api/auth/register` recibe `{ email, password }` y responde `201 { id, email }`.
- Login: `POST /api/auth/login` recibe `{ email, password }` y responde `{ token, expiresIn, user }`.
- Los errores usan `{ error: { code, message } }`.
- Socket.IO autentica con `auth: { token }`. Para volver a una sala se emite `join:game`; después de `joined:game`, el cliente recupera el estado con `GET /api/games/:id`.

Falta implementar en el frontend el login, el listado y ciclo de partidas, la sala, las jugadas y el flujo completo de reconexión. Para desarrollo local, configura `FRONTEND_ORIGIN=http://localhost:5173` en el backend y las URLs `VITE_API_URL`/`VITE_SOCKET_URL` en `.env.local`.
