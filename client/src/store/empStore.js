import { create } from "zustand";
import { persist } from "zustand/middleware";

// Helper function to load from localStorage
const loadFromStorage = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        return defaultValue;
    }
};

// Helper function to save to localStorage
const saveToStorage = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
    }
};

export const useEmployeeStore = create(
    persist(
        (set, get) => ({
            empId: null,
            salary: null,
            email: null,
            tokenSymbol: null,
            walletAddress: null,
            isRegistered: false,
            isLoading: true,
            error: null,

            setEmpData: (data) => {
                const updatedState = {
                    ...get(),
                    empId: data.empId,
                    salary: data.salary,
                    email: data.email,
                    tokenSymbol: data.tokenSymbol || 'XLM',
                    walletAddress: data.walletAddress || null,
                    isRegistered: true,
                    isLoading: false,
                    error: null,
                };
                set(updatedState);
                // Also save to separate localStorage for backward compatibility
                saveToStorage('employeeData', updatedState);
            },

            setLoading: (value) => set((state) => ({
                ...state,
                isLoading: value,
            })),

            setError: (error) => set((state) => ({
                ...state,
                error: error,
                isLoading: false,
            })),

            clearEmpData: () => {
                const clearedState = {
                    ...get(),
                    empId: null,
                    salary: null,
                    email: null,
                    tokenSymbol: null,
                    walletAddress: null,
                    isRegistered: false,
                    isLoading: false,
                    error: null,
                };
                set(clearedState);
                // Clear localStorage
                localStorage.removeItem('employeeData');
                localStorage.removeItem('employeeEmail');
                localStorage.removeItem('selectedToken');
            },

            // Initialize from localStorage on store creation
            initializeFromStorage: () => {
                const savedData = loadFromStorage('employeeData');
                if (savedData && savedData.isRegistered) {
                    set(savedData);
                } else {
                    set({ isLoading: false });
                }
            },
        }),
        {
            name: 'employee-store',
            partialize: (state) => ({
                empId: state.empId,
                salary: state.salary,
                email: state.email,
                tokenSymbol: state.tokenSymbol,
                walletAddress: state.walletAddress,
                isRegistered: state.isRegistered,
            }),
        }
    )
);