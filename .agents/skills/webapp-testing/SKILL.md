---
name: webapp-testing
description: Comprehensive testing practices for Next.js, React 19, Server Actions, and utilities using Jest and React Testing Library.
license: MIT
---

# Web App Testing Guidelines

## 1. Unit & Integration Testing Strategy
- Place tests in `__tests__/` mirroring source files.
- Isolate external cloud dependencies (Firebase Admin, Gemini API, Inngest, Telegram) using `jest.mock()`.
- Test positive and negative edge cases:
  - Unauthorized / forbidden access
  - Malformed or missing payload validation
  - Correct formatting and business logic calculation

## 2. Server Action Testing
- Mock Next.js headers (`cookies`) and auth helpers.
- Test server action return structure: `{ success: true, data }` or `{ success: false, error }`.
- Verify database queries and third-party dispatches are called with expected parameters.
