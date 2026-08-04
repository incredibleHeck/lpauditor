import { adminAuth, adminDb } from "./firebase-admin";

export async function createClient() {
  return { auth: adminAuth, db: adminDb };
}
