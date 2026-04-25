import React, { useState } from "react";
import { useEmployeeStore } from "../store/empStore";
import { registerEmployee, getEmployeeWithWA } from "../services/sorobanService";
import { upsertEmployeeProfile, getEmployeeProfile } from "../libs/supabase";
import { useWalletContext } from "../context/WalletContext";
import Card from "./Cards";
import Button from "./Button";
import InputField from "./InputField";


const RegistrationCard = ({ onSuccess }) => {
    const { walletAddress } = useWalletContext();
    const setEmpData = useEmployeeStore((state) => state.setEmpData);
    const setError = useEmployeeStore((state) => state.setError);
    const isRegistered = useEmployeeStore((state) => state.isRegistered);
    // Remove global loading states that get stuck on app init
    const [isLoading, setIsLoading] = useState(false);

    const [form, setForm] = useState({
        name: "",
        email: "",
        position: "",
        department: "",
        salary: "",
    });

    const [error, setErrors] = useState({
        name: "",
        email: "",
        salary: "",
        general: "",
    });

    const dataValidate = () => {
        const newErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.name || form.name.trim().length < 2) {
            newErrors.name = "Please enter your full name";
        }
        if (!form.email || !emailRegex.test(form.email)) {
            newErrors.email = "Please enter a valid email address";
        }
        if (!form.salary || isNaN(form.salary) || form.salary <= 0) {
            newErrors.salary = "Please enter a valid salary";
        }
        setErrors({ ...newErrors, general: "" });
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
                name: form.name.trim(),
                position: form.position.trim() || null,
                department: form.department || null,
                isRegistered: true,
            });

            await upsertEmployeeProfile({
                walletAddress,
                empId: empData?.empId || null,
                name: form.name.trim(),
                position: form.position.trim() || null,
                department: form.department || null,
                email: form.email,
            }).catch(console.error);

            onSuccess?.();
        } catch (error) {
            // Check if the Blockchain rejected it because we are ALREADY registered
            if (error.message?.includes("InvalidAction") || error.message?.includes("UnreachableCodeReached") || error.message?.includes("AlreadyRegistered") || error.message?.includes("Bad union switch")) {
                try {
                    const existingData = await getEmployeeWithWA(walletAddress);
                    if (existingData) {
                        let profile = null;
                        try {
                            const profileResp = await getEmployeeProfile(walletAddress);
                            if (profileResp?.success) {
                                profile = profileResp.data;
                            }
                        } catch (profileErr) {
                            console.warn("Profile hydration failed for existing user:", profileErr);
                        }

                        setEmpData({
                            empId: existingData?.empId || null,
                            salary: existingData.rem_salary / 10000000,
                            email: profile?.email || form.email || null,
                            name: profile?.name || null,
                            position: profile?.position || null,
                            department: profile?.department || null,
                            isRegistered: true,
                        });
                        if (onSuccess) onSuccess();
                        return;
                    }
                } catch (readErr) {
                    console.error("Failed to fetch existing profile:", readErr);
                }
            }

            console.error("CRITICAL REGISTRATION ERROR CAUGHT IN UI:", error);
            setErrors((prev) => ({ ...prev, general: error.message || "An error occurred during registration. Please try again." }));
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
                            label="Full Name"
                            type="text"
                            placeholder="e.g. Jane Doe"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            error={error.name}
                            icon="👤"
                        />

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
                            label="Position / Title"
                            type="text"
                            placeholder="e.g. Software Engineer"
                            value={form.position}
                            onChange={(e) => setForm({ ...form, position: e.target.value })}
                            icon="💼"
                        />

                        <div className="flex flex-col gap-2">
                            <label className="text-gray-500 text-sm font-medium uppercase tracking-wider">Department</label>
                            <select
                                value={form.department}
                                onChange={(e) => setForm({ ...form, department: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-all appearance-none">
                                <option value="" className="bg-[#111]">Select department...</option>
                                {["Engineering", "Finance", "HR", "Marketing", "Operations", "Sales", "Design", "Legal", "Product"].map(d => (
                                    <option key={d} value={d} className="bg-[#111]">{d}</option>
                                ))}
                            </select>
                        </div>

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
                                disabled={!form.name || !form.email || !form.salary}
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