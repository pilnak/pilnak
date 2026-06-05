import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { listenCompany, type CompanyDoc } from "@/services/companyService";

interface CompanyAuthState {
  user: FirebaseUser | null;
  company: CompanyDoc | null;
  companyId: string | null;
  isLoading: boolean;
  isApproved: boolean;
}

export function useCompanyAuth() {
  const [state, setState] = useState<CompanyAuthState>({
    user: null,
    company: null,
    companyId: null,
    isLoading: true,
    isApproved: false,
  });

  useEffect(() => {
    let companyUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      // Clean up previous company listener
      if (companyUnsub) {
        companyUnsub();
        companyUnsub = null;
      }

      if (!user) {
        setState({ user: null, company: null, companyId: null, isLoading: false, isApproved: false });
        return;
      }

      // Listen to company doc in real time
      companyUnsub = listenCompany(user.uid, (company) => {
        setState({
          user,
          company,
          companyId: user.uid,
          isLoading: false,
          isApproved: company?.approvalStatus === "approved",
        });
      });
    });

    return () => {
      authUnsub();
      if (companyUnsub) companyUnsub();
    };
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { ...state, signOut };
}