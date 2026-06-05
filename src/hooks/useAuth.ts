import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  type User as FirebaseUser,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

export type AppRole = "admin" | "customer" | "driver" | "company";

interface AuthState {
  user: FirebaseUser | null;
  role: AppRole | null;
  isLoading: boolean;
  emailVerificationRequired: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    role: null,
    isLoading: true,
    emailVerificationRequired: false,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState({ user: null, role: null, isLoading: false, emailVerificationRequired: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() as { role?: AppRole; emailVerificationRequired?: boolean } | undefined;
        const emailVerificationRequired = data?.emailVerificationRequired ?? false;

        // Reload to get fresh emailVerified status from the server for users
        // who are subject to email verification (avoids stale cached token).
        if (emailVerificationRequired && !user.emailVerified) {
          await user.reload();
        }

        setAuthState({
          user: auth.currentUser ?? user,
          role: data?.role ?? null,
          isLoading: false,
          emailVerificationRequired,
        });
      } catch (err) {
        console.error("Error fetching user role:", err);
        setAuthState({ user, role: null, isLoading: false, emailVerificationRequired: false });
      }
    });
    return () => unsub();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return {
    ...authState,
    signOut,
    isAuthenticated: !!authState.user,
    // Reads auth.currentUser.emailVerified directly (always fresh after reload())
    // so navigation after polling detection works without waiting for onAuthStateChanged.
    // Grandfathered users (no emailVerificationRequired flag) always pass.
    isEmailVerified: !authState.emailVerificationRequired || !!auth.currentUser?.emailVerified,
  };
}