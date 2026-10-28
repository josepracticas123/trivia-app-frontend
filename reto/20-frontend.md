# 20 · Conecta un frontend mínimo

**Tu misión:** Construye en un repositorio frontend separado una interfaz mínima para registrarte, iniciar sesión y jugar una partida de dos personas.

**Antes:** El [reto 19](19-reconexion.md) debe estar aprobado e integrado en develop.

**Aprenderás:** Consumo de API, sesión, estados de interfaz y cliente Socket.IO.

## Trabajo por bloques

1. Con el tutor, crea o identifica TriviaApp_front con React y Vite. Su código y sus dependencias viven allí; registra su URL en este README.

2. Crea registro, login, listado de partidas, creación y entrada por código, sala, turno y resultado. Envía JWT por Authorization y al conectar sockets; para esta primera versión mantenlo en memoria y vuelve a iniciar sesión al recargar.

3. Integra avisos y recuperación. Bloquea envíos pendientes y muestra errores sin perder datos. En backend actualiza solo contratos o CORS cuando sea necesario.

## Comprueba tu entrega

- [ ] Dos usuarios en perfiles de navegador distintos completan una partida desde la interfaz.
- [ ] La UI indica espera, turno, envío, error y resultado sin calcular puntos ni soluciones.
- [ ] Una operación fallida conserva el estado y permite recuperación; un doble clic no duplica jugadas.
- [ ] Reconectar consulta estado y vuelve a la sala; JWT caducado lleva a iniciar sesión.
- [ ] El frontend no contiene credenciales de DB ni JWT_SECRET y usa una URL configurable para la API.
- [ ] Hay PR al backend develop para la entrega/documentación y PR al develop del frontend para su código; ambos quedan pendientes de revisión.
- [ ] `npm run typecheck` y `npm run build` pasan; he comprobado que lo anterior sigue funcionando.
- [ ] He actualizado `APRENDIZAJE.md`, anotado las pruebas y abierto el PR hacia `develop` sin hacer merge.

## Demostración al tutor

Recorre una petición en Network. ¿Qué valida el frontend para ayudar al usuario y qué vuelve a validar el backend por seguridad?

## Pistas

No añadas Redux ni un framework visual por obligación. Una interfaz pequeña permite probar todo el recorrido antes del despliegue.

## Documentación

- [React](https://react.dev/learn)
- [Cliente Socket.IO](https://socket.io/docs/v4/client-api/)

## Registro de entrega y revisión

Estado inicial: **Pendiente**. Los checks son la autoevaluación del alumno; el cierre lo confirma el tutor.

- PR y commit revisado: pendiente.
- Prueba correcta (petición/acción y resultado): pendiente.
- Prueba inválida o fallo (petición/acción y resultado): pendiente.
- Comandos y resultados: pendiente.
- Dudas o correcciones: pendiente.
- Revisión y aprobación del tutor: pendiente.
- Merge en `develop`: pendiente.

No empieces el siguiente reto hasta que este PR esté aprobado e integrado. Las correcciones van en la misma rama y el mismo PR.

[Volver al README](../README.md) · [Reto 19](19-reconexion.md) · [Reto 21](21-despliegue.md)
