import { getAuthenticatedUser } from '../lib/auth-helpers';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
  }),
}));

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
    verifySessionCookie: jest.fn(),
  },
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Auth Helpers', () => {
  it('should throw an error if no session cookie or id token is provided', async () => {
    await expect(getAuthenticatedUser()).rejects.toThrow('Unauthorized: Missing authentication token.');
  });
});
