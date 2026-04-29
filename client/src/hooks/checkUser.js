import { registerEmployee, getEmployeeWithWA } from "../services/sorobanService.js";
import { useCallback, useEffect } from "react";
import { useEmployeeStore } from "../store/empStore.js";

//creating a custom hook to check if a user
//is registered or not in a system

export function useCheckUser() {
    //using zustand here 
    //to manage state
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setError = useEmployeeStore((state) => state.setError);
    const setLoading = useEmployeeStore((state) => state.setLoading);
    const initializeFromStorage = useEmployeeStore((state) => state.initializeFromStorage);
    const walletAddress = useEmployeeStore((state) => state.walletAddress);
    const isRegistered = useEmployeeStore((state) => state.isRegistered);

    // Initialize store from localStorage on mount
    useEffect(() => {
        initializeFromStorage();
    }, [initializeFromStorage]);

    const checkUser = useCallback(async (address) => {
        if (!address) {
            return { isRegistered: false };
        }

        try {
            setLoading(true);
            
            // First check if we have cached data for this wallet
            if (isRegistered && walletAddress === address) {
                return { isRegistered: true, empData: useEmployeeStore.getState() };
            }
            
            const empData = await getEmployeeWithWA(address);

            if (!empData) {
                return { isRegistered: false };
            }

            setEmpData({
                empId: empData.empId,
                salary: empData.rem_salary / 10000000,
                email: empData.email,
                tokenSymbol: empData.salary_token ? 'XLM' : 'XLM', // Default to XLM for now
                walletAddress: address,
            });
            
            return { isRegistered: true, empData };

        } catch (error) {
            console.error("checkUser error details:", error);

            const isNotRegistered =
                error.message?.includes("WasmVm") ||
                error.message?.includes("InvalidAction") ||
                error.message?.includes("simulation failed") ||
                error.message?.includes("Wallet not registered") ||
                error.message?.includes("Invalid contract ID");

            if (!isNotRegistered) {
                console.error("checkUser caught an unexpected bug, NOT a simple 'wallet missing' error:", error);
                setError(error.message || "An unexpected error occurred while checking registration.");
            }

            return { isRegistered: false };
        }
        finally {
            setLoading(false);
        }
    }, [setEmpData, setError, setLoading, isRegistered, walletAddress, initializeFromStorage]);

    return { checkUser }
}