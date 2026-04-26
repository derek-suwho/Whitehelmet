let csrfToken = ''

export function setCsrfToken(t: string) {
  csrfToken = t
}

function csrfHeader(): Record<string, string> {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(),
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}
