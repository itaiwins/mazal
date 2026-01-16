/**
 * UI Store
 *
 * Manages global UI state like modals, sheets, toasts
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEV_BYPASS_PREMIUM } from '@/lib/config/revenuecat';

// Modal types
export type ModalType =
  | 'profile-preview'
  | 'report-user'
  | 'block-user'
  | 'unmatch'
  | 'delete-account'
  | 'photo-viewer'
  | 'filter'
  | 'location-picker'
  | 'safta-invite'
  | 'premium-upsell';

// Bottom sheet types
export type SheetType =
  | 'swipe-actions'
  | 'profile-options'
  | 'message-options'
  | 'photo-options'
  | 'icebreakers'
  | 'giphy'
  | 'settings';

// Toast types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface UIState {
  // Modal
  activeModal: ModalType | null;
  modalData: Record<string, unknown>;

  // Bottom Sheet
  activeSheet: SheetType | null;
  sheetData: Record<string, unknown>;

  // Toasts
  toasts: Toast[];

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Network status
  isOnline: boolean;

  // Keyboard
  keyboardVisible: boolean;
  keyboardHeight: number;

  // Theme
  isDarkMode: boolean;

  // Orthodox Mode
  isOrthodoxMode: boolean;
  hasOrthodoxSubscription: boolean;

  // Shabbat Mode
  isShabbatModeEnabled: boolean;
  isShabbatModeActive: boolean;
  shabbatStartTime: string | null;
  shabbatEndTime: string | null;

  // Demo Mode (for App Store screenshots)
  isDemoMode: boolean;

  // Actions
  showModal: (type: ModalType, data?: Record<string, unknown>) => void;
  hideModal: () => void;
  showSheet: (type: SheetType, data?: Record<string, unknown>) => void;
  hideSheet: () => void;
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  clearToasts: () => void;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  setOnline: (isOnline: boolean) => void;
  setKeyboard: (visible: boolean, height: number) => void;
  setDarkMode: (isDarkMode: boolean) => void;
  setOrthodoxMode: (isOrthodoxMode: boolean) => void;
  setOrthodoxSubscription: (hasSubscription: boolean) => void;
  setShabbatModeEnabled: (enabled: boolean) => void;
  setShabbatModeActive: (active: boolean) => void;
  setShabbatTimes: (startTime: string | null, endTime: string | null) => void;
  setDemoMode: (isDemoMode: boolean) => void;
  reset: () => void;
}

const initialState = {
  activeModal: null,
  modalData: {},
  activeSheet: null,
  sheetData: {},
  toasts: [],
  globalLoading: false,
  loadingMessage: null,
  isOnline: true,
  keyboardVisible: false,
  keyboardHeight: 0,
  isDarkMode: true, // Default to dark theme (navy/gold)
  isOrthodoxMode: false, // Only true when user explicitly selects Orthodox mode
  hasOrthodoxSubscription: DEV_BYPASS_PREMIUM, // DEV: Auto-grant subscription for testing
  isShabbatModeEnabled: false,
  isShabbatModeActive: false,
  shabbatStartTime: null,
  shabbatEndTime: null,
  isDemoMode: false,
};

let toastId = 0;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...initialState,

      showModal: (type, data = {}) =>
        set({
          activeModal: type,
          modalData: data,
        }),

      hideModal: () =>
        set({
          activeModal: null,
          modalData: {},
        }),

      showSheet: (type, data = {}) =>
        set({
          activeSheet: type,
          sheetData: data,
        }),

      hideSheet: () =>
        set({
          activeSheet: null,
          sheetData: {},
        }),

      showToast: (toast) => {
        const id = `toast-${++toastId}`;
        const newToast: Toast = {
          ...toast,
          id,
          duration: toast.duration ?? 4000,
        };

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }));

        // Auto-dismiss
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().hideToast(id);
          }, newToast.duration);
        }
      },

      hideToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),

      setGlobalLoading: (globalLoading, loadingMessage) =>
        set({ globalLoading, loadingMessage: loadingMessage ?? null }),

      setOnline: (isOnline) => set({ isOnline }),

      setKeyboard: (keyboardVisible, keyboardHeight) =>
        set({ keyboardVisible, keyboardHeight }),

      setDarkMode: (isDarkMode) => set({ isDarkMode }),

      setOrthodoxMode: (isOrthodoxMode) => set({ isOrthodoxMode }),

      setOrthodoxSubscription: (hasOrthodoxSubscription) => set({ hasOrthodoxSubscription }),

      setShabbatModeEnabled: (isShabbatModeEnabled) => set({ isShabbatModeEnabled }),

      setShabbatModeActive: (isShabbatModeActive) => set({ isShabbatModeActive }),

      setShabbatTimes: (shabbatStartTime, shabbatEndTime) => set({ shabbatStartTime, shabbatEndTime }),

      setDemoMode: (isDemoMode) => set({ isDemoMode }),

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist Orthodox mode flags - transient UI state should not be persisted
      partialize: (state) => ({
        isOrthodoxMode: state.isOrthodoxMode,
        hasOrthodoxSubscription: state.hasOrthodoxSubscription,
        isShabbatModeEnabled: state.isShabbatModeEnabled,
      }),
    }
  )
);

// Helper hooks
export const useModal = () => {
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const showModal = useUIStore((s) => s.showModal);
  const hideModal = useUIStore((s) => s.hideModal);

  return { activeModal, modalData, showModal, hideModal };
};

export const useSheet = () => {
  const activeSheet = useUIStore((s) => s.activeSheet);
  const sheetData = useUIStore((s) => s.sheetData);
  const showSheet = useUIStore((s) => s.showSheet);
  const hideSheet = useUIStore((s) => s.hideSheet);

  return { activeSheet, sheetData, showSheet, hideSheet };
};

export const useToasts = () => {
  const toasts = useUIStore((s) => s.toasts);
  const showToast = useUIStore((s) => s.showToast);
  const hideToast = useUIStore((s) => s.hideToast);
  const clearToasts = useUIStore((s) => s.clearToasts);

  return { toasts, showToast, hideToast, clearToasts };
};
