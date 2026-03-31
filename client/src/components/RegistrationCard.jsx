import React, { useState } from "react";
import { useEmployeeStore } from "../store/empStore";
import {  registerEmployee, getEmployeeWithWA } from "../services/sorobanService";
import { useWalletContext } from "../context/WalletContext";
import Card from "./Cards";
import Button from "./Button";
import InputField from "./InputField";


const RegistrationCard = ({ onSuccess, onSkip }) => {
    const { walletAddress } = useWalletContext();
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setError = useEmployeeStore((state) => state.setError);
    const isRegistered = useEmployeeStore((state) => state.isRegistered);
    // Remove global loading states that get stuck on app init
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const [form, setForm] = useState({
        salary: "",
        email: ""
    });

    const [error, setErrors] = useState({
        email: "",
        salary: "",
    });

    const dataValidate = () => {
        const newErrors = {};
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
        if (!dataValidate()) return;
        try {
            setIsLoading(true);
            const salaryInStroops = Math.floor(Number(form.salary) * 10000000);
            const resp = await registerEmployee(walletAddress, walletAddress, salaryInStroops);

            if (!resp.success) {
                setError("Registration failed. Please try again.");
                return;
            }

            // Store what we know locally — no need to re-query the contract immediately
            setEmpData({
                empId: null,
                salary: Number(form.salary),
                email: form.email,
                isRegistered: true,
            });

            setSuccessMsg("Registration successful! Redirecting to dashboard...");
            setTimeout(() => onSuccess?.(), 1500);
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
            setError(error.message || "An error occurred during registration. Please try again.");
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
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <span className="text-lg">✦</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">Register Account</h2>
                                <p className="text-gray-500 text-sm">Set up your employee profile</p>
                            </div>
                        </div>
                        {onSkip && (
                            <button
                                onClick={onSkip}
                                className="text-gray-500 hover:text-gray-300 transition-colors text-sm underline"
                                title="Go to dashboard without registering"
                            >
                                Skip →
                            </button>
                        )}
                    </div>

                    <div className="w-full h-px bg-white/10 mb-8" />

                    <div className="flex flex-col gap-5">
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
                            {successMsg && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm text-center">
                                    ✓ {successMsg}
                                </div>
                            )}
                            <Button
                                onClick={handleSubmit}
                                isLoading={isLoading}
                                disabled={!form.email || !form.salary || !!successMsg}
                            >
                                Register ✦
                            </Button>
                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={onSkip}
                                    className="text-gray-500 hover:text-gray-300 transition-colors text-sm text-center py-1"
                                >
                                    Already registered? Go to Dashboard →
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

        </>
    )
}

export default RegistrationCard;