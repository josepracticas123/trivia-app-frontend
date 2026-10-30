/* Campo de contraseña reutilizable con botón mostrar/ocultar. */

import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  hint?: string;
};

export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  hint,
}: PasswordFieldProps) {
  // Este estado pertenece al campo: App ya no necesita saber si se ve la contraseña.
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        Contraseña
      </label>

      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={8}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-[#3D3D3D] bg-[#0D0D0D] px-4 py-3 pr-12 text-white outline-none transition focus:border-[#A3E635]"
        />

        {/* No envía el formulario: únicamente cambia la visibilidad. */}
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-lg"
        >
          {isVisible ? "🙈" : "👁️"}
        </button>
      </div>

      {hint && <p className="mt-2 text-xs text-[#A3A3A3]">{hint}</p>}
    </div>
  );
}
