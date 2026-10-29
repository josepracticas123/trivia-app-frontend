import { env } from '../config/env'

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown
  token?: string | null
  headers?: HeadersInit
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...requestOptions } = options
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const errorPayload =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? payload.error
        : payload
    const message =
      typeof errorPayload === 'object' && errorPayload !== null && 'message' in errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo completar la operación. Inténtalo de nuevo.'
    const code =
      typeof errorPayload === 'object' && errorPayload !== null && 'code' in errorPayload && typeof errorPayload.code === 'string'
        ? errorPayload.code
        : undefined
    throw new ApiError(message, response.status, code)
  }

  return response.json() as Promise<T>
}
