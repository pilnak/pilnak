import { useState, useEffect, useCallback, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

const SESSION_KEY = "pilnak_location_granted";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
  isPermissionGranted: boolean | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  updateInterval?: number;
  saveToDatabase?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    updateInterval = 0,
    saveToDatabase = false,
  } = options;

  const lastSaveRef = useRef<number>(0);

  // Check sessionStorage on init — if granted this session, start as true
  const sessionGranted = sessionStorage.getItem(SESSION_KEY) === "true";

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: sessionGranted,          // loading only if we expect to auto-start
    isPermissionGranted: sessionGranted ? true : null,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const saveLocation = useCallback(
    async (latitude: number, longitude: number, accuracy: number | null) => {
      if (!saveToDatabase) return;
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        await addDoc(collection(db, "locations"), {
          userId: uid,
          latitude,
          longitude,
          accuracy,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Error saving location:", err);
      }
    },
    [saveToDatabase],
  );

  const requestPermission = useCallback(async (): Promise<
    { latitude: number; longitude: number } | false
  > => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
        isLoading: false,
        isPermissionGranted: false,
      }));
      return false;
    }

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });

      if (permission.state === "denied") {
        setState((prev) => ({
          ...prev,
          error: "Location permission denied",
          isLoading: false,
          isPermissionGranted: false,
        }));
        return false;
      }

      return new Promise<{ latitude: number; longitude: number } | false>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              setState({
                latitude,
                longitude,
                accuracy,
                error: null,
                isLoading: false,
                isPermissionGranted: true,
              });
              // Persist grant for this browser session
              sessionStorage.setItem(SESSION_KEY, "true");
              saveLocation(latitude, longitude, accuracy);
              resolve({ latitude, longitude });
            },
            (error) => {
              setState((prev) => ({
                ...prev,
                error: error.message,
                isLoading: false,
                isPermissionGranted: false,
              }));
              resolve(false);
            },
            { enableHighAccuracy, timeout, maximumAge },
          );
        },
      );
    } catch {
      setState((prev) => ({
        ...prev,
        error: "Failed to request location permission",
        isLoading: false,
        isPermissionGranted: false,
      }));
      return false;
    }
  }, [enableHighAccuracy, timeout, maximumAge, saveLocation]);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setState((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          isLoading: false,
          isPermissionGranted: true,
        }));
        const now = Date.now();
        if (updateInterval <= 0 || now - lastSaveRef.current >= updateInterval) {
          lastSaveRef.current = now;
          saveLocation(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          );
        }
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
      },
      { enableHighAccuracy, timeout, maximumAge },
    );

    setWatchId(id);
  }, [enableHighAccuracy, timeout, maximumAge, saveLocation]);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    // Also clear session flag so user is asked again next session
    sessionStorage.removeItem(SESSION_KEY);
  }, [watchId]);

  // Auto-start watching if location was already granted this session
  useEffect(() => {
    if (sessionGranted && watchId === null) {
      startWatching();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    ...state,
    requestPermission,
    startWatching,
    stopWatching,
    isWatching: watchId !== null,
  };
}