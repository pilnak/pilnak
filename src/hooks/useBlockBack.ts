import { useEffect } from "react";

/**
 * Prevents the browser back button from leaving the current page.
 * Works by pushing a duplicate history entry on mount, then re-pushing
 * whenever the user tries to go back (popstate).
 */
export function useBlockBack() {
    useEffect(() => {
        // Push a duplicate entry so there's always something ahead in history
        window.history.pushState(null, "", window.location.href);

        const handlePopState = () => {
            // User pressed back — push forward again to cancel it
            window.history.pushState(null, "", window.location.href);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);
}