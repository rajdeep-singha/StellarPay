import { create } from "zustand";

export const useEmployeeStore = create((set) => ({
    empId: null,
    salary: null,
    email: null,
    name: null,
    position: null,
    department: null,
    isRegistered: false,
    isLoading: true,
    error: null,

    setEmpData: (data) => set((state) => ({
        ...state,
        empId: data.empId,
        salary: data.salary,
        email: data.email,
        name: data.name ?? null,
        position: data.position ?? null,
        department: data.department ?? null,
        isRegistered: true,
        isLoading: false,
        error: null,
    })),

    setLoading:(value)=>set((state)=>({
        ...state,
        isLoading:value,
    })),

    setError: (error) => set((state) => ({
        ...state,
        error: error,
        isLoading: false,
    })),

   clearEmpData: () => set((state) => ({
        ...state,
        empId: null,
        salary: null,
        email: null,
        name: null,
        position: null,
        department: null,
        isRegistered: false,
        isLoading: false,
        error: null,
    })),

}));