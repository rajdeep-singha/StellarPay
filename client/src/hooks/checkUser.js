import { getEmployeeWithWA } from "../services/sorobanService.js";
import { useCallback } from "react";
import { useEmployeeStore } from "../store/empStore.js";

//creating a custom hook to check if a user
//is registered or not in a system

export function useCheckUser() {
    //using zustand here 
    //to manage state
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setLoading = useEmployeeStore((state) => state.setLoading);

    const checkUser = useCallback(async (address) => {
        if (!address) {
            return { isRegistered: false };
        }

        try {
            setLoading(true)
            const empData = await getEmployeeWithWA(address);

            if (!empData) {
                return { isRegistered: false };
            }

            setEmpData({
                empId: empData.empId,
                salary: empData.rem_salary / 10000000,
                email: empData.email,
            })
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
            }

            return { isRegistered: false };
        }
        finally {
            setLoading(false);
        }
    }, []);

    return { checkUser }
}