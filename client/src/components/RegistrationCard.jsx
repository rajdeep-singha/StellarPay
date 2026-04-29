import React, { useState, useEffect } from "react";
import { useEmployeeStore } from "../store/empStore";
import { registerEmployee, getEmployeeWithWA, SUPPORTED_TOKENS } from "../services/sorobanService";
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
        salary: "",
        email: "",
        selectedToken: SUPPORTED_TOKENS[0] // Default to XLM
    });

    const [registrationStatus, setRegistrationStatus] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const [error, setErrors] = useState({
        email: "",
        salary: "",
        general: "",
    });

    // Load saved data from localStorage on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('employeeEmail');
        const savedToken = localStorage.getItem('selectedToken');
        
        if (savedEmail) {
            setForm(prev => ({ ...prev, email: savedEmail }));
        }
        
        if (savedToken) {
            const token = SUPPORTED_TOKENS.find(t => t.symbol === savedToken);
            if (token) {
                setForm(prev => ({ ...prev, selectedToken: token }));
            }
        }
    }, []);

    const dataValidate = () => {
        const newErrors = { general: "" }; // Clear general error on validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.email || !emailRegex.test(form.email)) {
            newErrors.email = "Please enter a valid email address";
        }
        if (!form.salary || isNaN(form.salary) || form.salary <= 0) {
            newErrors.salary = "Please enter a valid salary";
        }
        
        if (!form.selectedToken) {
            newErrors.general = "Please select a salary token";
        }
        
        setErrors(newErrors);
        return !newErrors.email && !newErrors.salary && !newErrors.general;
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
            setRegistrationStatus('initiating');
            
            // Save email to localStorage
            localStorage.setItem('employeeEmail', form.email);
            localStorage.setItem('selectedToken', form.selectedToken.symbol);
            
            const salaryInStroops = Math.floor(Number(form.salary) * 10000000);
            const tokenAddress = form.selectedToken.isNative ? "native" : form.selectedToken.address;

            console.debug("Attempting employee registration", { 
                walletAddress, 
                salaryInStroops, 
                tokenAddress,
                tokenSymbol: form.selectedToken.symbol 
            });
            
            setRegistrationStatus('signing');
            const resp = await registerEmployee(walletAddress, walletAddress, salaryInStroops, tokenAddress);
            console.log("registerEmployee response", resp);

            if (!resp.success) {
                setErrors({ ...error, general: "Registration failed. Please try again." });
                setRegistrationStatus('failed');
                return;
            }

            setRegistrationStatus('confirming');
            
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
            
            // Save employee data to localStorage for persistence
            localStorage.setItem('employeeData', JSON.stringify({
                empId: empData?.empId || null,
                salary: Number(form.salary),
                email: form.email,
                tokenSymbol: form.selectedToken.symbol,
                isRegistered: true,
                walletAddress
            }));

            setEmpData({
                empId: empData?.empId || null,
                salary: Number(form.salary),
                email: form.email,
                isRegistered: true,
            });
            
            setRegistrationStatus('success');
            setShowConfirmation(true);
            
            // Auto-hide confirmation after 5 seconds
            setTimeout(() => {
                setShowConfirmation(false);
                onSuccess?.();
            }, 5000);
            
        } catch (error) {
            // Check if the Blockchain rejected it because we are ALREADY registered
            if (error.message?.includes("InvalidAction") || error.message?.includes("UnreachableCodeReached")) {
                try {
                    const existingData = await getEmployeeWithWA(walletAddress);
                    if (existingData) {
                        setEmpData({
                            empId: existingData?.empId || null,
                            salary: existingData.rem_salary / 10000000,
                            email: existingData.email,
                            isRegistered: true, // Force Zustand to see us!
                        });
                        if (onSuccess) onSuccess(); // Notify HomePage
                        return; // Crucial early exit
                    }
                } catch (readErr) {
                    console.error("Failed to fetch existing profile:", readErr);
                }
            }

            console.error("CRITICAL REGISTRATION ERROR CAUGHT IN UI:", error);
            setErrors({ ...error, general: error.message || "An error occurred during registration. Please try again." });
            setRegistrationStatus('failed');
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
                            label="Monthly Salary"
                            type="number"
                            placeholder={`e.g. 5000 ${form.selectedToken?.symbol || 'XLM'}`}
                            value={form.salary}
                            onChange={(e) => setForm({ ...form, salary: e.target.value })}
                            error={error.salary}
                            icon="$"
                        />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Salary Token
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {SUPPORTED_TOKENS.map((token) => (
                                    <button
                                        key={token.symbol}
                                        type="button"
                                        onClick={() => setForm({ ...form, selectedToken: token })}
                                        className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                                            form.selectedToken?.symbol === token.symbol
                                                ? "bg-white/10 border-white/30 text-white"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                        }`}
                                    >
                                        <span className="text-lg">{token.icon}</span>
                                        <span className="text-xs font-medium">{token.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                            <p className="text-gray-500 text-xs">
                                ⓘ A 1.25% fee applies on each advance withdrawal.
                                Your wallet address will be linked automatically.
                                Employee ID will be assigned after successful registration.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 mt-2">
                            <Button
                                onClick={handleSubmit}
                                isLoading={isLoading}
                                disabled={!form.email || !form.salary || !form.selectedToken}
                            >
                                {registrationStatus === 'signing' ? 'Signing Transaction...' :
                                 registrationStatus === 'confirming' ? 'Confirming Registration...' :
                                 registrationStatus === 'success' ? 'Registration Successful!' :
                                 'Register ✦'}
                            </Button>
                        </div>
                    </div>
                </Card>
                
                {/* Registration Confirmation Modal */}
                {showConfirmation && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-sm mx-auto text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">✓</span>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Registration Successful!</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Your employee profile has been created and linked to your wallet.
                            </p>
                            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-left">
                                <p className="text-xs text-gray-500 mb-1">Employee ID</p>
                                <p className="text-sm font-mono text-white mb-2">{useEmployeeStore.getState().empId || 'Generating...'}</p>
                                <p className="text-xs text-gray-500 mb-1">Monthly Salary</p>
                                <p className="text-sm text-white">{form.salary} {form.selectedToken?.symbol}</p>
                            </div>
                            <Button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    onSuccess?.();
                                }}
                                className="mt-4"
                            >
                                Continue to Dashboard
                            </Button>
                        </Card>
                    </div>
                )}
            </div>

        </>
    )
}

export default RegistrationCard;