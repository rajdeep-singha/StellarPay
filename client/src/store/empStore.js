import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useEmployeeStore = create(
    persist(
        (set) => ({
            empId: null,
            salary: null,
            email: null,
            isRegistered: false,
            isLoading: true,
            error: null,
            walletAddress: null,

            setEmpData: (data) => set((state) => ({
                ...state,
                empId: data.empId,
                salary: data.salary,
                email: data.email,
                walletAddress: data.walletAddress || state.walletAddress,
                isRegistered: true,
                isLoading: false,
                error: null,
            })),

            setLoading: (value) => set((state) => ({
                ...state,
                isLoading: value,
            })),

            setError: (error) => set((state) => ({
                ...state,
                error: error,
                isLoading: false,
            })),

            setWalletAddress: (address) => set((state) => ({
                ...state,
                walletAddress: address,
            })),

            clearEmpData: () => set((state) => ({
                ...state,
                empId: null,
                salary: null,
                email: null,
                walletAddress: null,
                isRegistered: false,
                isLoading: false,
                error: null,
            })),
        }),
        {
            name: "stellarpay-employee-storage",
            partialize: (state) => ({
                empId: state.empId,
                salary: state.salary,
                email: state.email,
                isRegistered: state.isRegistered,
                walletAddress: state.walletAddress,
            }),
        }
    )
);