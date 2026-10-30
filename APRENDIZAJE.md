# 20 · Conecta un frontend mínimo

- Lo que he construido: registro y login contra la API, sesión JWT solo en memoria, listado de partidas, creación y entrada por código, sala, inicio y envío de respuestas. La sala se conecta con Socket.IO autenticado y, al recibir `joined:game`, vuelve a pedir el estado actual de la partida.
- Conceptos y explicación propia: el frontend valida la experiencia (campos requeridos y bloquear botones mientras una petición está en curso), pero el backend es quien autoriza cada acción y comprueba que el turno, la partida y la respuesta sean válidos. El JWT se mantiene en estado de React, por lo que se pierde al recargar.
- Pruebas y resultados: `npm.cmd run lint`, `npm.cmd run typecheck` y `npm.cmd run build` pasan el 30/10/2026. El frontend responde `200` en `http://127.0.0.1:5173/`; el backend responde `400 VALIDATION_ERROR` al enviar un login vacío y permite el origen del frontend. En la prueba manual, al terminar una partida la sala mostró el estado de completada y el historial la mostró como finalizada.
- Error y solución: PowerShell bloqueaba `npm.ps1` por la política de ejecución; los comandos se ejecutan como `npm.cmd run ...`.
- Dudas: pendiente.
- PR y correcciones: pendiente.

## Punto de reanudación — 29/10/2026

- Base creada: React, Vite, TypeScript, Tailwind CSS y Socket.IO Client.
- Interfaz actual: portada responsive, registro y login locales.
- Login: validación local; todavía no consume la API.
- Componente extraído: `src/components/PasswordField.tsx`, reutilizado en ambos formularios para mostrar u ocultar la contraseña.
- Se revisaron los contratos del backend actualizado en `develop`: registro acepta solo email y contraseña; errores en `{ error: { code, message } }`.
- `RegisterForm.tsx` se extrajo de `App.tsx` y registra con `POST /api/auth/register`; bloquea envíos duplicados mientras espera, muestra errores de API/red y lleva al login al completar el registro.
- El campo nombre se quitó porque el backend rechaza propiedades adicionales y no guarda ese dato.
- El siguiente paso es conectar el formulario de login a `POST /api/auth/login` y mantener el JWT en memoria.
## Error 500 al registrar usuario

- **Síntoma:** `POST /api/auth/register` devolvía `500 (Internal Server Error)`.
- **Causa real:** `TypeError: Cannot read properties of undefined (reading 'create')` en `registerUser` (`src/services/auth.services.ts`).
- **Motivo:** el cliente de Prisma no estaba generado, por lo que `prisma.user` era `undefined`.
- **Solución:** ejecutar `npm run db:generate` y reiniciar el backend.
- **Otros bloqueos resueltos:** falta de `.env.local` en el frontend, dependencias faltantes (`jsonwebtoken`), variables de entorno del backend (`JWT_SECRET`, `FRONTEND_ORIGIN`, `PORT`), proceso viejo en el puerto 3000.

