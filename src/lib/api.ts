export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Support Authorization header fallback for iframe environments where third-party cookies are blocked
  const token = localStorage.getItem('shro_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // sends httpOnly cookies
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errData = await response.json();
      errorMessage = errData.error || errorMessage;
    } catch {
      // ignore
    }

    if (response.status === 401 && endpoint !== '/api/auth/me') {
      localStorage.removeItem('shro_token');
    }

    throw new Error(errorMessage);
  }

  // Handle blob responses (like Excel and ZIP backup exports)
  const contentType = response.headers.get('content-type');
  if (
    contentType && (
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/x-zip-compressed') ||
      contentType.includes('application/octet-stream')
    )
  ) {
    return response.blob();
  }

  return response.json();
}
