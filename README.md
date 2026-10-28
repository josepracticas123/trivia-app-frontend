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

## Estructura inicial

- `src/api/`: cliente HTTP y errores de API.
- `src/config/`: configuración pública procedente de variables Vite.
- `src/features/`: módulos de autenticación y partidas (se crearán al integrar los contratos del backend).
- `src/socket/`: conexión Socket.IO autenticada (se añadirá con los eventos reales del backend).

No se guardan credenciales de base de datos ni `JWT_SECRET` en este repositorio. El token de sesión se mantendrá solamente en memoria.

## Pendiente de integración

Antes de implementar las pantallas necesitamos confirmar en el backend del reto 19:

- Rutas y cuerpos de registro, login, lista/creación/unión de partidas y envío de jugadas.
- Forma de las respuestas y de los errores.
- URL, namespace, eventos y formato de autenticación de Socket.IO.
- Orígenes CORS autorizados para el servidor de Vite.
