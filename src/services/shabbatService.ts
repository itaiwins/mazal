/**
 * Shabbat Mode Service
 *
 * Handles automatic Shabbat detection and app pausing based on zmanim.
 * Uses user's location to calculate accurate candle lighting and havdalah times.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for zmanim
export interface ZmanimData {
  candleLighting: Date;
  havdalah: Date;
  sunrise: Date;
  sunset: Date;
  isShabbat: boolean;
  isYomTov: boolean;
  holidayName?: string;
}

export interface ShabbatSettings {
  isEnabled: boolean;
  minutesBeforeCandles: number;
  minutesAfterHavdalah: number;
  includeYomTov: boolean;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  timezone: string;
}

interface ShabbatState {
  settings: ShabbatSettings;
  currentZmanim: ZmanimData | null;
  isInShabbatMode: boolean;
  lastUpdated: string | null;

  // Actions
  updateSettings: (updates: Partial<ShabbatSettings>) => void;
  setLocation: (lat: number, lng: number, city: string) => void;
  checkShabbatMode: () => boolean;
  refreshZmanim: () => Promise<void>;
}

// Default settings
const DEFAULT_SETTINGS: ShabbatSettings = {
  isEnabled: true,
  minutesBeforeCandles: 18, // Traditional 18 minutes
  minutesAfterHavdalah: 0,
  includeYomTov: true,
  latitude: null,
  longitude: null,
  city: null,
  timezone: 'America/New_York',
};

/**
 * Calculate sunset time for a given date and location
 * Uses simplified solar calculations
 */
function calculateSunset(date: Date, lat: number, lng: number): Date {
  const J2000 = 2451545;
  const daysSinceJ2000 = Math.floor(date.getTime() / 86400000) - 10957 + J2000;

  // Solar calculations
  const meanAnomaly = (357.5291 + 0.98560028 * (daysSinceJ2000 - J2000)) % 360;
  const equationOfCenter =
    1.9148 * Math.sin((meanAnomaly * Math.PI) / 180) +
    0.02 * Math.sin((2 * meanAnomaly * Math.PI) / 180);
  const eclipticLongitude = (meanAnomaly + equationOfCenter + 180 + 102.9372) % 360;
  const obliquity = 23.439;
  const rightAscension =
    (Math.atan2(
      Math.cos((obliquity * Math.PI) / 180) *
        Math.sin((eclipticLongitude * Math.PI) / 180),
      Math.cos((eclipticLongitude * Math.PI) / 180)
    ) *
      180) /
    Math.PI;
  const declination =
    (Math.asin(
      Math.sin((obliquity * Math.PI) / 180) *
        Math.sin((eclipticLongitude * Math.PI) / 180)
    ) *
      180) /
    Math.PI;

  // Hour angle for sunset (when sun is at -0.833 degrees below horizon)
  const hourAngle =
    (Math.acos(
      (Math.sin((-0.833 * Math.PI) / 180) -
        Math.sin((lat * Math.PI) / 180) *
          Math.sin((declination * Math.PI) / 180)) /
        (Math.cos((lat * Math.PI) / 180) *
          Math.cos((declination * Math.PI) / 180))
    ) *
      180) /
    Math.PI;

  // Transit time
  const transit = (daysSinceJ2000 - J2000 + (lng / 360) + 0.5) % 1;

  // Sunset time in hours
  const sunsetHours = (transit + hourAngle / 360) * 24 - (lng / 15);

  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetHours), Math.floor((sunsetHours % 1) * 60), 0, 0);

  return sunset;
}

/**
 * Check if a date is a Jewish holiday (simplified - doesn't account for all Yom Tovim)
 * In production, you'd want to use a proper Hebrew calendar library
 */
function checkYomTov(date: Date): { isYomTov: boolean; name?: string } {
  // This is a simplified check - in production, use a proper Hebrew calendar API
  // For now, return false (the database stores Yom Tov dates)
  return { isYomTov: false };
}

/**
 * Calculate zmanim for a given date and location
 */
function calculateZmanim(
  date: Date,
  lat: number,
  lng: number,
  settings: ShabbatSettings
): ZmanimData {
  const dayOfWeek = date.getDay();
  const isFriday = dayOfWeek === 5;
  const isSaturday = dayOfWeek === 6;

  // Calculate sunset for the given date
  const sunset = calculateSunset(date, lat, lng);

  // Calculate sunrise (approximately 12 hours before sunset + adjustments)
  const sunrise = new Date(sunset);
  sunrise.setHours(sunset.getHours() - 12);

  // Candle lighting is on Friday, X minutes before sunset
  const candleLighting = new Date(sunset);
  if (isFriday) {
    candleLighting.setMinutes(candleLighting.getMinutes() - settings.minutesBeforeCandles);
  }

  // Havdalah is Saturday night, Y minutes after sunset (typically at nightfall)
  const havdalah = new Date(sunset);
  if (isSaturday) {
    havdalah.setMinutes(havdalah.getMinutes() + 42 + settings.minutesAfterHavdalah); // ~42 min for tzeis
  }

  // Check Yom Tov
  const yomTovCheck = settings.includeYomTov ? checkYomTov(date) : { isYomTov: false };

  // Determine if we're in Shabbat
  const now = new Date();
  let isShabbat = false;

  if (isFriday && now >= candleLighting) {
    isShabbat = true;
  } else if (isSaturday) {
    const saturdayHavdalah = calculateSunset(date, lat, lng);
    saturdayHavdalah.setMinutes(saturdayHavdalah.getMinutes() + 42 + settings.minutesAfterHavdalah);
    isShabbat = now < saturdayHavdalah;
  }

  return {
    candleLighting,
    havdalah,
    sunrise,
    sunset,
    isShabbat,
    isYomTov: yomTovCheck.isYomTov,
    holidayName: yomTovCheck.name,
  };
}

/**
 * Shabbat Mode Store
 */
export const useShabbatStore = create<ShabbatState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      currentZmanim: null,
      isInShabbatMode: false,
      lastUpdated: null,

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
        // Recalculate after settings change
        get().refreshZmanim();
      },

      setLocation: (lat, lng, city) => {
        set((state) => ({
          settings: {
            ...state.settings,
            latitude: lat,
            longitude: lng,
            city,
          },
        }));
        get().refreshZmanim();
      },

      checkShabbatMode: () => {
        const { settings, currentZmanim } = get();

        if (!settings.isEnabled || !currentZmanim) {
          return false;
        }

        const isShabbatMode = currentZmanim.isShabbat || currentZmanim.isYomTov;
        set({ isInShabbatMode: isShabbatMode });
        return isShabbatMode;
      },

      refreshZmanim: async () => {
        const { settings } = get();

        if (!settings.latitude || !settings.longitude) {
          return;
        }

        const now = new Date();
        const zmanim = calculateZmanim(
          now,
          settings.latitude,
          settings.longitude,
          settings
        );

        const isShabbatMode = settings.isEnabled && (zmanim.isShabbat || zmanim.isYomTov);

        set({
          currentZmanim: zmanim,
          isInShabbatMode: isShabbatMode,
          lastUpdated: now.toISOString(),
        });
      },
    }),
    {
      name: 'shabbat-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

/**
 * Hook to get formatted zmanim times
 */
export function useFormattedZmanim() {
  const { currentZmanim, settings } = useShabbatStore();

  if (!currentZmanim) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return {
    candleLighting: formatTime(currentZmanim.candleLighting),
    havdalah: formatTime(currentZmanim.havdalah),
    sunrise: formatTime(currentZmanim.sunrise),
    sunset: formatTime(currentZmanim.sunset),
    isShabbat: currentZmanim.isShabbat,
    isYomTov: currentZmanim.isYomTov,
    holidayName: currentZmanim.holidayName,
    city: settings.city,
  };
}

/**
 * Initialize Shabbat mode checking
 * Call this at app startup
 */
export function initShabbatMode() {
  const { refreshZmanim, checkShabbatMode } = useShabbatStore.getState();

  // Initial check
  refreshZmanim().then(() => {
    checkShabbatMode();
  });

  // Check every minute
  const interval = setInterval(() => {
    checkShabbatMode();
  }, 60000);

  return () => clearInterval(interval);
}

/**
 * ShabbatGuard Component Helper
 * Returns whether the app should be in restricted mode
 */
export function useShabbatGuard(): {
  isRestricted: boolean;
  message: string | null;
  zmanim: ReturnType<typeof useFormattedZmanim>;
} {
  const { isInShabbatMode, settings, currentZmanim } = useShabbatStore();
  const zmanim = useFormattedZmanim();

  if (!settings.isEnabled) {
    return { isRestricted: false, message: null, zmanim };
  }

  if (isInShabbatMode) {
    let message = 'Shabbat Shalom! The app is paused for Shabbat.';

    if (currentZmanim?.isYomTov && currentZmanim.holidayName) {
      message = `Chag Sameach! The app is paused for ${currentZmanim.holidayName}.`;
    }

    if (zmanim) {
      message += ` App will resume after ${zmanim.havdalah}.`;
    }

    return { isRestricted: true, message, zmanim };
  }

  return { isRestricted: false, message: null, zmanim };
}
