import { getEmployeeWithWA } from "../services/sorobanService.js";
import { useCallback } from "react";
import { useEmployeeStore } from "../store/empStore.js";

const CONTRACT_WAGE = import.meta.env.VITE_CONTRACT_WAGE;

export function useCheckUser() {
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setError = useEmployeeStore((state) => state.setError);
    const setLoading = useEmployeeStore((state) => state.setLoading);

    const checkUser = useCallback(async (address) => {
        if (!address) {
            return { isRegistered: false };
        }

        // No contract configured — skip check, treat as registered so dashboard loads
        if (!CONTRACT_WAGE) {
            console.warn("VITE_CONTRACT_WAGE not set — skipping registration check.");
            return { isRegistered: true, empData: null };
        }

        try {
            setLoading(true);
            const empData = await getEmployeeWithWA(address);
            setEmpData({
                empId: empData.empId,
                salary: empData.rem_salary / 10000000,
                email: empData.email,
            });
            return { isRegistered: true, empData };

        } catch (error) {
            console.error("checkUser error details:", error);
            const isNotRegistered =
                error.message?.includes("WasmVm") ||
                error.message?.includes("InvalidAction") ||
                error.message?.includes("simulation failed") ||
                error.message?.includes("Wallet not registered");

            if (!isNotRegistered) {
                console.error("checkUser caught an unexpected error:", error);
                // Unknown error (network, RPC down, etc.) — don't block the user
                return { isRegistered: true, empData: null };
            }

            return { isRegistered: false };
        } finally {
            setLoading(false);
        }
    }, []);

    return { checkUser };
}