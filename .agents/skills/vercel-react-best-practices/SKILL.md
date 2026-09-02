---
name: vercel-react-best-practices
description: Best practices for React 19, Server Components, Server Actions, suspense boundaries, and rendering performance in Next.js applications.
license: MIT
---

# React 19 & Next.js Best Practices

## 1. Server Components vs Client Components
- Keep the component tree primarily React Server Components (RSC).
- Use `"use client"` only at the leaf nodes that require interactive state (e.g., event handlers, hooks like `useState`, `useEffect`, `useDropzone`).
- Pass server data directly to client components via serializable props rather than triggering unnecessary client-side fetch waterfalls.

## 2. Server Actions
- Declare Server Actions with `"use server"` at the top of the file or function.
- Always authenticate and authorize the caller using secure server session helpers (e.g. `getAuthenticatedUser()`).
- Always validate incoming arguments using Zod schemas at the action boundary.
- Catch errors gracefully and return structured response objects: `{ success: boolean, data?: T, error?: string }`.
- Never trust client-supplied user IDs; retrieve user identity from verified server-side session cookies or tokens.

## 3. State Management & Real-Time Sync
- Use Firestore `onSnapshot` listeners inside `useEffect` for real-time live data, ensuring proper cleanup on unmount.
- Provide optimistic UI updates or clear loading states with spinners/skeletons during async operations.
- Use Sonner toasts (`toast.success`, `toast.error`, `toast.warning`) for immediate user feedback.

## 4. Error Boundaries & Fallbacks
- Wrap complex dynamic views and dashboard sections in `<ErrorBoundary>` to isolate failures without crashing the whole application.
- Provide graceful empty states and clear recovery actions when queries return zero results.
