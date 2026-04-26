const BASE_URL = '' // same-origin; Vite proxy handles /api → backend

interface RequestOptions {
  method: string
  headers: HeadersInit
  body?: string | FormData
  credentials: RequestCredentials
}

async function request<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  isUpload = false,
): Promise<T> {
  const headers: Record<string, string> = {}

  const opts: RequestOptions = {
    method,
    headers,
    credentials: 'include',
  }

  if (body !== undefined) {
    if (isUpload && body instanceof FormData) {
      // Let browser set Content-Type with boundary
      opts.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE_URL}${url}`, opts)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}: ${body}`)
    this.name = 'ApiError'
  }
}

export const api = {
  get<T = unknown>(url: string): Promise<T> {
    return request<T>(url, 'GET')
  },

  post<T = unknown>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, 'POST', body)
  },

  patch<T = unknown>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, 'PATCH', body)
  },

  delete<T = unknown>(url: string): Promise<T> {
    return request<T>(url, 'DELETE')
  },

  upload<T = unknown>(url: string, file: File): Promise<T> {
    const form = new FormData()
    form.append('file', file)
    return request<T>(url, 'POST', form, true)
  },
}
