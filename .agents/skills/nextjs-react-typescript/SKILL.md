---
name: nextjs-react-typescript
description: Architectural guidelines and clean TypeScript coding patterns for Next.js App Router applications.
license: MIT
---

# Next.js App Router & TypeScript Guidelines

## 1. Directory Structure & App Router Conventions
- Place routes in `app/` using `page.tsx`, `layout.tsx`, `loading.tsx`, and `error.tsx`.
- Place API route handlers in `app/api/<route>/route.ts`.
- Place edge middleware in root `middleware.ts`.
- Place shared utilities in `lib/` and reusable UI components in `components/`.

## 2. TypeScript Best Practices
- Strict null checks: Avoid `any`. Use strict TypeScript types or `unknown` with runtime type narrowing.
- Single source of truth: Export shared interfaces and union types in `lib/types.ts`.
- Runtime Validation: Couple TypeScript types with Zod schemas (`z.infer<typeof Schema>`).
- Explicit typing on Next.js Route Handlers (`NextRequest`, `NextResponse`).

## 3. Session & Edge Middleware
- Use Next.js `middleware.ts` for edge cookie validation and route redirects.
- Ensure static assets (`_next/static`, `_next/image`, `favicon.ico`) and public APIs are excluded via matcher regex.
