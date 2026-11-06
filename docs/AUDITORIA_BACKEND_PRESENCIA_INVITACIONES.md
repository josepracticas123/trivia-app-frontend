# Auditoría backend: presencia e invitaciones

**Fecha de auditoría:** 2026-11-05
**Última revisión de estado:** 2026-11-06
**Alcance:** cambios pendientes de la rama para el historial filtrable, los eventos de partidas y las funciones de presencia/invitaciones, además de los controladores y servicios directamente conectados. No es una revisión exhaustiva de todas las rutas existentes ni una prueba de penetración.  
**Cambios de código realizados durante la auditoría:** ninguno.

## Resumen

La separación entre controladores, servicios, esquemas Prisma y contratos Socket.IO es razonable para la estructura existente. Las invitaciones comprueban en servidor la identidad autenticada, la disponibilidad y el permiso para aceptar/rechazar/cancelar. La migración es aditiva y cuenta con índices para las consultas habituales.

No se observan hallazgos críticos en el alcance revisado. Los hallazgos A-01 y A-02 se corrigieron posteriormente en el commit `412f6e7`. Persisten oportunidades de mejora en el trabajo periódico de expiración, sincronización de presencia y cobertura de concurrencia.

## Hallazgos

### A-01 — Una actualización de presencia puede convertir una operación confirmada en HTTP 500 — Resuelto

- **Severidad original:** Media
- **Estado:** Resuelto el 2026-11-05 en `412f6e7`.
- **Filtros:** API Design, Testing y fiabilidad
- **Evidencia:** después de confirmar la creación, unión, eliminación o finalización, los controladores esperan a `refreshPresenceForOnlineUsers()`: [game.create.ts](../src/controllers/game.create.ts#L65), [game.join.ts](../src/controllers/game.join.ts#L32), [game.delete.ts](../src/controllers/game.delete.ts#L27), [game.answer.ts](../src/controllers/game.answer.ts#L72).
- **Impacto:** si falla la consulta de presencia o la cancelación de invitaciones, la mutación de partida ya quedó guardada, pero la petición puede responder con error. El frontend podría reintentar una operación que sí se aplicó.
- **Resolución verificada:** los efectos posteriores al commit se ejecutan mediante `runPostCommitEffect`; sus errores se registran sin transformar una mutación persistida en HTTP 500. El commit incorpora pruebas de rutas y sockets.

### A-02 — La aceptación puede confirmarse en la base y fallar después como si no se hubiera aceptado — Resuelto

- **Severidad original:** Media
- **Estado:** Resuelto el 2026-11-05 en `412f6e7`.
- **Filtros:** Arquitectura, API Design, Testing y fiabilidad
- **Evidencia:** la transacción de aceptación se completa en [game-invitations.ts](../src/services/game-invitations.ts#L166); luego el handler agrega sockets, emite eventos, actualiza presencia y solo entonces envía el ack positivo, dentro del `try/catch` de [sockets/index.ts](../src/sockets/index.ts#L279).
- **Impacto:** un error posterior al commit puede producir `INTERNAL_ERROR` aunque la sala exista y la invitación figure como aceptada. Un reintento ya no será equivalente a la primera aceptación.
- **Resolución verificada:** el resultado confirmado se trata por separado de las notificaciones Socket.IO y una invitación ya aceptada devuelve de nuevo su sala canónica. Se añadieron pruebas de integración y Socket.IO para este flujo.

### A-03 — El barrido de expiración consulta la tabla cada segundo y no tiene un índice específico por caducidad

- **Severidad:** Media
- **Filtros:** Base de datos, Rendimiento
- **Evidencia:** el intervalo se ejecuta cada segundo en [sockets/index.ts](../src/sockets/index.ts#L449); busca expiradas por `status` y `expiresAt` en [game-invitations.ts](../src/services/game-invitations.ts#L399). Los índices definidos son por emisor/fecha, receptor/estado/caducidad y partida, pero no por estado/caducidad global en [schema.prisma](../prisma/schema.prisma#L115).
- **Impacto:** conforme crece el historial de invitaciones, el proceso periódico puede recorrer más filas de las necesarias y mantiene actividad de base constante incluso sin invitaciones pendientes.
- **Recomendación:** medir el plan de consulta con volumen representativo; considerar un índice parcial para invitaciones pendientes por caducidad y un mecanismo de barrido menos frecuente o basado en la siguiente fecha de expiración. Definir también una política de retención/limpieza del historial.

### A-04 — El nombre público en presencia puede quedar desactualizado al cambiar el perfil

- **Severidad:** Baja
- **Filtros:** API Design, Testing y fiabilidad
- **Evidencia:** el mapa en memoria conserva `displayName` hasta registrar otro socket en [presence.ts](../src/services/presence.ts#L20); la actualización del perfil solo escribe y responde desde [auth.me.ts](../src/controllers/auth.me.ts#L23).
- **Impacto:** usuarios ya conectados pueden seguir apareciendo con el nombre anterior y las invitaciones pueden incluirlo hasta que reconecten.
- **Recomendación:** sincronizar el nombre público en los sockets online después de modificar el perfil o documentar que el cambio se refleja al reconectar.

### A-05 — Una invitación expirada puede recibir temporalmente el error de duplicada

- **Severidad:** Baja
- **Filtros:** Base de datos, API Design
- **Evidencia:** la lógica de negocio considera pendientes solo las invitaciones con `expiresAt > now` en [game-invitations.ts](../src/services/game-invitations.ts#L103), pero el índice único parcial bloquea cualquier fila cuyo estado siga siendo `PENDING`, independientemente de la fecha, en [migration.sql](../prisma/migrations/20261105130000_add_game_invitations/migration.sql#L29). El error `P2002` se traduce a `INVITE_ALREADY_PENDING` en [game-invitations.ts](../src/services/game-invitations.ts#L153).
- **Impacto:** entre el vencimiento y el siguiente barrido, un nuevo envío puede ser rechazado como duplicado aunque la invitación anterior ya caducó.
- **Recomendación:** al detectar el conflicto, expirar/consultar la fila pendiente vencida antes de devolver el error, o alinear el contrato para que el cliente pueda reintentar tras el barrido.

### A-06 — No se recupera el estado de presencia tras una caída abrupta del proceso

- **Severidad:** Baja
- **Filtros:** Arquitectura, Testing y fiabilidad
- **Evidencia:** la presencia es exclusivamente un `Map` local en [presence.ts](../src/services/presence.ts#L13); las invitaciones sí persisten, y las pendientes se vuelven a enviar al conectar desde [sockets/index.ts](../src/sockets/index.ts#L190).
- **Impacto:** si el proceso cae sin ejecutar las desconexiones, quedan invitaciones persistidas. Tras reiniciar, una persona puede recibir una invitación cuyo emisor aún no reconectó; el servidor impedirá aceptarla, pero la UI puede mostrarla hasta el intento o hasta su caducidad.
- **Recomendación:** al restaurar invitaciones entrantes, verificar que el emisor está actualmente disponible y cancelar/no entregar las que no cumplan la condición.

## Evaluación de los siete filtros

| Filtro | Evaluación |
|---|---|
| Arquitectura | Separación básica adecuada. `sockets/index.ts` concentra autenticación, presencia, invitaciones, expiración y salas; conviene extraer handlers/servicios Socket.IO si sigue creciendo. |
| Clean Code y SOLID | Servicios con responsabilidades reconocibles, pero hay acoplamiento de `game-invitations.ts` a tipos Socket.IO y controladores de juegos a la inicialización de sockets. Los errores internos por `Error.message` son frágiles frente a cambios de texto. |
| Seguridad | JWT verificado en handshake; el actor se deriva de `socket.data.userId`; receptor, permisos, disponibilidad y auto-invitación se validan en backend; el payload de presencia no incluye email ni token. `presence:request` no tiene limitación de frecuencia. No se revisó el sistema completo ni se hizo pentest. |
| API Design | Contratos de eventos están documentados y tipados, pero los errores del ack son `string` genérico y no incluyen `message`; el frontend debe mapear códigos. La presencia se ofrece por Socket.IO, no por endpoint HTTP. |
| Base de datos | Migración aditiva, relaciones e índices principales correctos; la expiración global necesita un índice/estrategia acorde al volumen. Las transacciones serializables y bloqueos de usuario protegen las operaciones competitivas relevantes. |
| Rendimiento | El barrido cada segundo y el refresco completo de usuarios online ante cada petición de presencia son los puntos principales a vigilar. La presencia en memoria solo es válida para una instancia, como ya se documenta. |
| Testing y fiabilidad | Hay pruebas unitarias, de integración y de sockets para los flujos principales. Falta cobertura específica de fallos posteriores al commit y de carreras entre aceptación, cancelación, expiración y creación/unión simultánea a salas. |

## Aspectos positivos observados

- Se mantiene la lógica de partidas existente y las salas por invitación se crean como partidas multijugador `WAITING`.
- Los cambios de esquema son aditivos; las migraciones de `trivia_test` estaban aplicadas al terminar el trabajo.
- Las operaciones de invitación validan permisos en servidor y mantienen en PostgreSQL el estado necesario para rechazos, cancelaciones y expiraciones.
- Las pruebas ejecutadas en el estado revisado: typecheck y build correctos; suite unitaria con 141 pruebas pasadas y 1 omitida; integración con 43 pruebas pasadas.
