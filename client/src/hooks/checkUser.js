import { getEmployeeByWallet } from "../services/sorobanService.js";
import { useCallback } from "react";
import { useEmployeeStore } from "../store/empStore.js";

//creating a custom hook to check if a user
//is registered or not in a system

export function useCheckUser() {
    //using zustand here
    //to manage state
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setError = useEmployeeStore((state) => state.setError);
    const setLoading = useEmployeeStore((state) => state.setLoading);

    const checkUser = useCallback(async (address) => {
        if (!address) {
            return { isRegistered: false };
        }

        try {
            setLoading(true);
            // Use the new two-step query: wallet → emp_id → employee details
            // Replaces the removed getEmployeeWithWA function (issue #18)
            const result = await getEmployeeByWallet(address, address);
            if (!result) {
                return { isRegistered: false };
            }
            const { empId, details } = result;
            setEmpData({
                empId,
                salary: details.rem_salary / 10000000,
                email: details.email,
            });
            return { isRegistered: true, empData: details };

        } catch (error) {
            console.error("checkUser error details:", error);
            const isNotRegistered =
                error.message?.includes("WasmVm") ||
                error.message?.includes("InvalidAction") ||
                error.message?.includes("simulation failed") ||
                error.message?.includes("Wallet not registered");

            if (!isNotRegistered) {
                console.error("checkUser caught an unexpected bug, NOT a simple 'wallet missing' error:", error);
            }

            return { isRegistered: false };
        } finally {
            setLoading(false);
        }
    }, []);

    return { checkUser };
}
