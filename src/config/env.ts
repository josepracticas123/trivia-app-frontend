const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('Falta VITE_API_URL. Crea un archivo .env.local a partir de .env.example.')
}

export const env = {
  apiUrl: removeTrailingSlash(apiUrl),
  socketUrl: removeTrailingSlash(import.meta.env.VITE_SOCKET_URL || apiUrl),
}
