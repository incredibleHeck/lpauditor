import { auth, db } from "./firebase";

export function createClient() {
  return { auth, db };
}
