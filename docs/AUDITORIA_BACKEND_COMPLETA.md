# Auditoría del backend completo

**Fecha de auditoría:** 2026-11-05
**Última revisión de estado:** 2026-11-06
**Alcance:** revisión estática del backend del repositorio: API HTTP, autenticación/autorización, validación, controladores, servicios, Socket.IO, configuración, Prisma y migraciones, documentación y pruebas. No se modificó código ni se accedió a producción.
**Límites:** no es una prueba de penetración, no se realizaron pruebas de carga ni se midió el rendimiento con volúmenes grandes. Los hallazgos de migraciones históricas dependen de la ruta de actualización y de si la tabla ya contiene cuentas.

## Resumen ejecutivo

La aplicación tiene una estructura reconocible de rutas, controladores, servicios y esquemas, usa validación de entradas, Argon2 para contraseñas y JWT para autenticar peticiones. El acceso a partidas verifica participación y existen controles transaccionales y pruebas de concurrencia.

No se observaron indicios de una vulnerabilidad crítica en la lectura realizada. Se identificaron riesgos relevantes de actualización de base de datos, abuso de registro y exposición potencial de JWT en logs de infraestructura. Los hallazgos A-06 y A-07 se corrigieron posteriormente en el commit `412f6e7`; permanecen oportunidades de mejora en presencia, expiración de invitaciones y escalabilidad de ciertas consultas.

## Hallazgos priorizados

### A-01 — Migración de contraseña puede borrar hashes o fallar con usuarios existentes

- **Severidad:** Alta, condicionada a la ruta de actualización.
- **Filtros:** Base de datos, testing y fiabilidad.
- **Evidencia:** [migration.sql](../prisma/migrations/20261015143436_fix_user_column/migration.sql#L9) elimina `passwordHas` y crea `passwordHash TEXT NOT NULL` sin copiar los valores. La migración anterior crea la tabla con `passwordHas` en [migration.sql](../prisma/migrations/20261015134420_add_user/migration.sql#L1).
- **Impacto:** si esa migración se aplica sobre una base que ya tiene cuentas, se perderían los hashes existentes; además, añadir una columna `NOT NULL` sin valor por defecto puede hacer que PostgreSQL rechace la migración si hay filas.
- **Recomendación:** confirmar qué migraciones se ejecutaron en cada entorno. Para entornos aún no migrados, probar una migración de renombrado/copia en una copia de una base poblada y validar el login tras la actualización. No reaplicar ni modificar migraciones ya desplegadas sin un procedimiento de recuperación.

### A-02 — El registro público no tiene limitación de frecuencia

- **Severidad:** Media.
- **Filtros:** Seguridad, rendimiento.
- **Evidencia:** `POST /api/auth/register` se monta sin middleware de rate limit en [auth.routes.ts](../src/routes/auth.routes.ts#L17). Cada alta calcula Argon2 en [auth.services.ts](../src/services/auth.services.ts#L7).
- **Impacto:** un cliente puede solicitar repetidamente operaciones costosas de hash y consumir CPU/memoria; también puede generar cuentas no deseadas.
- **Recomendación:** añadir limitación por IP/identidad en el borde o en la aplicación, con configuración coherente detrás del proxy y monitorización de rechazos.

### A-03 — Socket.IO permite JWT en query string

- **Severidad:** Media, dependiente de la infraestructura.
- **Filtros:** Seguridad.
- **Evidencia:** el handshake obtiene el token de `auth.token` o `query.token` en [index.ts](../src/sockets/index.ts#L108).
- **Impacto:** los tokens en URL pueden quedar registrados en logs de proxy, APM o diagnóstico, aunque la aplicación no los escriba explícitamente.
- **Recomendación:** preferir `auth.token` y revisar que proxies, balanceadores y herramientas de observabilidad no registren query strings sensibles. Si se elimina la compatibilidad con `query.token`, coordinarlo con los clientes existentes.

### A-04 — Solicitudes de presencia pueden disparar trabajo de base de datos repetido

- **Severidad:** Media.
- **Filtros:** Seguridad, rendimiento.
- **Evidencia:** cada `presence:request` vuelve a refrescar presencia en [index.ts](../src/sockets/index.ts#L209); el refresco procesa todos los usuarios conectados en [index.ts](../src/sockets/index.ts#L55) y consulta participaciones en [presence.ts](../src/services/presence.ts#L123). No se aprecia limitación de frecuencia del evento.
- **Impacto:** clientes que emitan el evento repetidamente pueden causar consultas y notificaciones más amplias que el usuario solicitante.
- **Recomendación:** limitar o agrupar solicitudes por socket, actualizar el estado cuando cambie la partida y paginar/consultar solo lo necesario.

### A-05 — El barrido de invitaciones vencidas es frecuente y no tiene índice global de expiración

- **Severidad:** Media, dependiente del volumen.
- **Filtros:** Base de datos, rendimiento, fiabilidad.
- **Evidencia:** se ejecuta cada segundo en [index.ts](../src/sockets/index.ts#L449) y busca invitaciones por `status` y `expiresAt` en [game-invitations.ts](../src/services/game-invitations.ts#L399). Los índices de [schema.prisma](../prisma/schema.prisma#L115) no incluyen directamente un índice global para ese filtro.
- **Impacto:** el sondeo puede recorrer repetidamente filas históricas y añadir carga constante a PostgreSQL.
- **Recomendación:** medir con datos representativos; considerar un índice parcial para pendientes por expiración, un intervalo menos frecuente o un trabajo basado en la siguiente fecha de vencimiento, y una política de retención.

### A-06 — La aceptación puede confirmarse en base de datos y devolver error después — Resuelto

- **Severidad original:** Media.
- **Estado:** Resuelto el 2026-11-05 en `412f6e7`.
- **Filtros:** API Design, arquitectura, fiabilidad.
- **Evidencia:** la transacción persiste la aceptación y crea la sala en [game-invitations.ts](../src/services/game-invitations.ts#L166). Después, el handler une sockets, emite eventos y actualiza presencia antes de enviar el ack; los fallos se traducen a `INTERNAL_ERROR` en [index.ts](../src/sockets/index.ts#L279).
- **Impacto:** puede existir ya una sala y estar aceptada la invitación aunque el cliente reciba un error, lo que dificulta reintentos y puede dejar temporalmente al usuario sin navegación.
- **Resolución verificada:** los efectos Socket.IO posteriores se aíslan para que no cambien el resultado persistido, y una aceptación ya confirmada devuelve el resultado canónico de forma idempotente. Se añadieron pruebas de integración y de Socket.IO en el mismo commit.

### A-07 — Fallos de sincronización de presencia pueden producir HTTP 500 tras una mutación confirmada — Resuelto

- **Severidad original:** Media.
- **Estado:** Resuelto el 2026-11-05 en `412f6e7`.
- **Filtros:** API Design, fiabilidad.
- **Evidencia:** se espera `refreshPresenceForOnlineUsers()` después de confirmar crear/unirse/eliminar/finalizar en [game.create.ts](../src/controllers/game.create.ts#L65), [game.join.ts](../src/controllers/game.join.ts#L32), [game.delete.ts](../src/controllers/game.delete.ts#L27) y [game.answer.ts](../src/controllers/game.answer.ts#L72).
- **Impacto:** si falla la sincronización secundaria, la mutación principal ya persistió, pero el cliente puede recibir un error y repetirla.
- **Resolución verificada:** las notificaciones y el refresco de presencia se ejecutan mediante `runPostCommitEffect`, que registra los fallos sin alterar la respuesta HTTP de una mutación ya confirmada. El commit añade pruebas específicas de rutas y sockets.

### A-08 — La presencia puede conservar un nombre público desactualizado

- **Severidad:** Baja.
- **Filtros:** API Design, fiabilidad.
- **Evidencia:** el mapa en memoria guarda `displayName` al conectar en [presence.ts](../src/services/presence.ts#L20); `PATCH /api/me` actualiza la base de datos desde [auth.me.ts](../src/controllers/auth.me.ts#L23), pero no sincroniza la presencia activa.
- **Impacto:** la lista de jugadores y las invitaciones pueden mostrar el nombre anterior hasta una reconexión.
- **Recomendación:** sincronizar el nombre en presencia después de actualizar el perfil o documentar el comportamiento.

### A-09 — Una invitación vencida puede bloquear temporalmente otro envío como duplicado

- **Severidad:** Baja.
- **Filtros:** Base de datos, API Design.
- **Evidencia:** la aplicación trata como vigentes las invitaciones `PENDING` con `expiresAt > now` en [game-invitations.ts](../src/services/game-invitations.ts#L103), pero el índice único parcial bloquea toda fila `PENDING` sin considerar `expiresAt` en [migration.sql](../prisma/migrations/20261105130000_add_game_invitations/migration.sql#L29). El error de unicidad se traduce a `INVITE_ALREADY_PENDING` en [game-invitations.ts](../src/services/game-invitations.ts#L153).
- **Impacto:** en el intervalo entre el vencimiento y el barrido, un nuevo envío puede rechazarse con un código de duplicado.
- **Recomendación:** expirar de forma transaccional las pendientes vencidas relevantes antes de crear, o traducir el conflicto diferenciando el caso expirado.

### A-10 — La selección aleatoria de preguntas puede escalar mal con un catálogo grande

- **Severidad:** Baja, dependiente del volumen.
- **Filtros:** Rendimiento.
- **Evidencia:** [game.queries.ts](../src/services/game.queries.ts#L7) selecciona preguntas usando `ORDER BY RANDOM() LIMIT 5`.
- **Impacto:** PostgreSQL puede tener que asignar orden aleatorio a una parte extensa del catálogo en cada partida.
- **Recomendación:** mantenerlo mientras el catálogo sea pequeño y medirlo antes de cambiarlo; si crece, evaluar una estrategia de muestreo adecuada al tamaño y patrón de inserciones.

### A-11 — Presencia en memoria no sobrevive a reinicios ni se comparte entre instancias

- **Severidad:** Baja en una instancia; Media al escalar horizontalmente.
- **Filtros:** Arquitectura, fiabilidad.
- **Evidencia:** la presencia vive en un `Map` local en [presence.ts](../src/services/presence.ts#L13). La documentación indica despliegue de una instancia; las invitaciones se restauran al reconectar en [index.ts](../src/sockets/index.ts#L190).
- **Impacto:** después de un reinicio, usuarios que aún no reconectaron se consideran offline; una invitación persistida puede reaparecer aunque su emisor todavía no esté disponible. Con varias instancias, cada una tendría una vista incompleta.
- **Recomendación:** validar disponibilidad del emisor al restaurar invitaciones y usar almacenamiento/adaptador compartido si se despliega más de una instancia.

## Evaluación de los siete filtros

| Filtro | Evaluación |
|---|---|
| Arquitectura | Separación por rutas, controladores, servicios, esquemas y acceso a datos clara para un backend de tamaño pequeño/medio. El módulo Socket.IO concentra autenticación, presencia, expiración, invitaciones y salas; conviene vigilar su crecimiento. El estado en memoria limita el escalado horizontal. |
| Clean Code y SOLID | La validación y la persistencia suelen estar separadas. [game.mutations.ts](../src/services/game.mutations.ts) acumula varios casos de uso; los errores identificados comparando `Error.message` son frágiles. Revisar la coexistencia de `startGame` y `confirmGameReady` para evitar flujos divergentes si ambos se mantienen. |
| Seguridad | JWT, roles, permisos de participación, Argon2 y validación de entrada están presentes. Riesgos concretos: registro sin rate limit y posibilidad de JWT en query string. La petición de presencia también necesita control de frecuencia. No se hizo pentest ni se verificó la configuración de proxies/secretos de despliegue. |
| API Design | Rutas y respuestas están documentadas con Swagger; se usan errores consistentes en HTTP. Para invitaciones, los errores Socket.IO son códigos genéricos sin mensaje; el cliente debe mapearlos. Hay que cuidar que errores de efectos secundarios no contradigan mutaciones ya confirmadas. |
| Base de datos | Prisma define relaciones, claves únicas e índices; hay transacciones y migraciones para evolución del esquema. La migración histórica de contraseña debe verificarse contra datos existentes. El barrido de expiración necesita una estrategia indexada acorde al volumen. |
| Rendimiento | Riesgos a vigilar: refresco de presencia completo por evento, barrido de expiración cada segundo y `ORDER BY RANDOM()`. No se midieron latencias ni carga; las observaciones dependen del número de sockets, invitaciones y preguntas. |
| Testing y fiabilidad | Hay pruebas de rutas, autenticación, Socket.IO, puntuación e intercalados concurrentes. Typecheck y tests unitarios actuales pasan. La cobertura puede ampliarse para migraciones sobre datos, fallos tras commits y carreras entre aceptar/cancelar/expirar/desconectar. La guía de pruebas describe un caso de permisos de inicio que debe contrastarse con el comportamiento actual de confirmación por participantes en [tests/README.md](../tests/README.md#L82). |

## Verificaciones realizadas

- `npm run typecheck`: correcto.
- `npm test -- --reporter=dot`: 141 pasadas, 1 omitida.
- No se ejecutó una auditoría dinámica de seguridad, prueba de carga ni validación de migraciones sobre una copia poblada de producción.

## Conclusión

El backend presenta una base ordenada y cuenta con controles importantes de autenticación, permisos, validación e integridad transaccional. Antes de ampliar el uso en producción, priorizar la verificación segura de la migración de contraseñas y controles contra abuso en registro. Los puntos de presencia e invitaciones son principalmente riesgos de fiabilidad y escalabilidad; conviene abordarlos antes de operar con alto volumen o más de una instancia.
