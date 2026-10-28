# 20 · Conecta un frontend mínimo

- Lo que he construido: pendiente.
- Conceptos y explicación propia: pendiente.
- Pruebas y resultados: pendiente.
- Error y solución: pendiente.
- Dudas: pendiente.
- PR y correcciones: pendiente.

## Punto de reanudación — 28/10/2026

- Base creada: React, Vite, TypeScript, Tailwind CSS y Socket.IO Client.
- Interfaz actual: portada responsive, registro y login locales.
- Registro y login: validación de campos obligatorios y contraseña de mínimo ocho caracteres; todavía no consumen la API.
- Componente extraído: `src/components/PasswordField.tsx`, reutilizado en ambos formularios para mostrar u ocultar la contraseña.
- Verificación realizada: `npm run typecheck` pasa.
- Siguiente paso: extraer `RegisterForm.tsx` de `App.tsx` y comprobar que conserva las tres pruebas de registro.
