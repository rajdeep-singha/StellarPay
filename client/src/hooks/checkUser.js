import { getEmployeeWithWA } from "../services/sorobanService.js";
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
            return { isRegistered: false, empData: null };
        }

        try {
            setLoading(true);
            const empData = await getEmployeeWithWA(address);

            if (!empData) {
                return { isRegistered: false, empData: null };
            }

            setEmpData({
                empId: empData.emp_id ?? empData.empId ?? null,
                salary: (empData.rem_salary ?? 0) / 10000000,
                email: empData.email ?? "",
                isRegistered: true,
            });

            return { isRegistered: true, empData };

        } catch (error) {
            console.error("checkUser error details:", error);
            return { isRegistered: false, empData: null };
        }
        finally {
            setLoading(false);
        }
    }, [setEmpData, setLoading]);

    return { checkUser }
}