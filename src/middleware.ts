import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth is handled client-side with JWT in localStorage.
  // Middleware only handles root redirect.
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
