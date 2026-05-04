import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Next.js Middleware for Route Protection
 *
 * TENANT ISOLATION (Frontend):
 * This middleware ensures that only authenticated users can access the dashboard.
 * It uses the 'jose' library which is compatible with the Edge runtime.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip public routes and assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // matches static files like .png, .css
  ) {
    return NextResponse.next();
  }

  // 2. Check for the 'jwt' cookie
  const token = req.cookies.get('jwt')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    // 3. Verify the JWT signature
    // In production, ensure JWT_SECRET is set in environment variables
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    );

    await jwtVerify(token, secret);

    return NextResponse.next();
  } catch (error) {
    // Token is invalid or expired
    console.error('Middleware Auth Error:', error);
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('jwt');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
