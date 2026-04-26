import React, { useState } from "react";
import { useEmployeeStore } from "../store/empStore";
import { registerEmployee, getEmployeeWithWA } from "../services/sorobanService";
import { useWalletContext } from "../context/WalletContext";
import Card from "./Cards";
import Button from "./Button";
import InputField from "./InputField";


const RegistrationCard = ({ onSuccess }) => {
    const { walletAddress } = useWalletContext();
    const setEmpData = useEmployeeStore((state) => state.setEmpData);

    // Remove global loading states that get stuck on app init
    const [isLoading, setIsLoading] = useState(false);

    const [form, setForm] = useState({
        salary: "",
        email: ""
    });

    const [error, setErrors] = useState({
        email: "",
        salary: "",
        general: "",
    });

    const dataValidate = () => {
        const newErrors = { general: "" }; // Clear general error on validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.email || !emailRegex.test(form.email)) {
            newErrors.email = "Please enter a valid email address";
        }
        if (!form.salary || isNaN(form.salary) || form.salary <= 0) {
            newErrors.salary = "Please enter a valid salary";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = async (e) => {
        // user registration is handled here
        e.preventDefault();

        if (!walletAddress) {
            setErrors({ ...error, general: "Connect your Freighter wallet before registering." });
            return;
        }

        if (!dataValidate()) return;
        try {
            setIsLoading(true);
            const salaryInStroops = Math.floor(Number(form.salary) * 10000000);

            console.debug("Attempting employee registration", { walletAddress, salaryInStroops });
            const resp = await registerEmployee(walletAddress, walletAddress, salaryInStroops);
            console.log("registerEmployee response", resp);

            if (!resp.success) {
                setErrors({ ...error, general: "Registration failed. Please try again." });
                return;
            }

            // Fast & Safe Recursive Strategy: The blockchain takes a few seconds to sync.
            // We recursively poll the network without blocking the main event thread.
            const safeSyncProfile = async (attempts = 3) => {
                const data = await getEmployeeWithWA(walletAddress);
                if (data) return data; // Success! Sync caught up.
                if (attempts <= 0) throw new Error("Registration confirmed, but profile failed to sync.");
                await new Promise(res => setTimeout(res, 2000)); // 2-second safe buffer
                return safeSyncProfile(attempts - 1);
            };

            const empData = await safeSyncProfile();

            setEmpData({
                empId: empData?.empId || null,
                salary: Number(form.salary),
                email: form.email,
                isRegistered: true,
            });

            onSuccess?.();
        } catch (error) {
            // Check if the Blockchain rejected it because we are ALREADY registered
            if (error.message?.includes("InvalidAction") || error.message?.includes("UnreachableCodeReached")) {
                try {
                    const existingData = await getEmployeeWithWA(walletAddress);
                    setEmpData({
                        empId: existingData?.empId || null,
                        salary: existingData.rem_salary / 10000000,
                        email: existingData.email,
                        isRegistered: true, // Force Zustand to see us!
                    });
                    if (onSuccess) onSuccess(); // Notify HomePage
                    return; // Crucial early exit
                } catch (readErr) {
                    console.error("Failed to fetch existing profile:", readErr);
                }
            }

            console.error("CRITICAL REGISTRATION ERROR CAUGHT IN UI:", error);
            setErrors({ ...error, general: error.message || "An error occurred during registration. Please try again." });
        }
        finally {
            setIsLoading(false);
        }
    }


    // Modal is controlled by HomePage state now

    return (
        <>
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6">
                <Card className="w-full max-w-md mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-lg">✦</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Register Account</h2>
                            <p className="text-gray-500 text-sm">Set up your employee profile</p>
                        </div>
                    </div>

                    <div className="w-full h-px bg-white/10 mb-8" />

                    <div className="flex flex-col gap-5">                        {error.general && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-red-400 text-sm">{error.general}</p>
                            </div>
                        )}
                        <InputField
                            label="Email Address"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            error={error.email}
                            icon="✉"
                        />

                        <InputField
                            label="Monthly Salary (XLM)"
                            type="number"
                            placeholder="e.g. 5000"
                            value={form.salary}
                            onChange={(e) => setForm({ ...form, salary: e.target.value })}
                            error={error.salary}
                            icon="$"
                        />

                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                            <p className="text-gray-500 text-xs">
                                ⓘ A 1.25% fee applies on each advance withdrawal.
                                Your wallet address will be linked automatically.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 mt-2">
                            <Button
                                onClick={handleSubmit}
                                isLoading={isLoading}
                                disabled={!form.email || !form.salary}
                            >
                                Register ✦
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

        </>
    )
}

export default RegistrationCard;