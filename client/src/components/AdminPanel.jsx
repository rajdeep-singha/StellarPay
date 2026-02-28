import React, { useState, useEffect } from "react";
import {
  registerEmployee,
  depositToVault,
  getVaultStats,
  getVaultBalance,
  setMaxWithdrawPercentage,
  CONTRACTS,
} from "../services/sorobanService";

/**
 * AdminPanel Component - Comprehensive employer/admin dashboard
 *
 * Features:
 * - Employee registration
 * - Vault deposit functionality
 * - Vault statistics and health monitoring
 * - Configuration of withdrawal limits
 * - Real-time vault balance tracking
 */
const AdminPanel = ({ walletAddress, isConnected }) => {
  // Employee Registration State
  const [employeeWallet, setEmployeeWallet] = useState("");
  const [employeeSalary, setEmployeeSalary] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Vault Deposit State
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);

  // Vault Stats State
  const [vaultStats, setVaultStats] = useState(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Configuration State
  const [maxWithdrawPct, setMaxWithdrawPct] = useState(80);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Notification State
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchVaultData();
    }
  }, [isConnected, walletAddress]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchVaultData = async () => {
    setIsLoadingStats(true);
    try {
      const [stats, balance] = await Promise.all([
        getVaultStats(walletAddress),
        getVaultBalance(walletAddress),
      ]);

      setVaultStats(stats);
      setVaultBalance(balance / 10000000); // Convert from stroops
      if (stats?.max_withdraw_percentage) {
        setMaxWithdrawPct(stats.max_withdraw_percentage);
      }
    } catch (error) {
      console.error("Error fetching vault data:", error);
      showNotification("Failed to load vault data", "error");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      showNotification("Please connect your wallet first", "error");
      return;
    }

    if (!employeeWallet || !employeeSalary) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    setIsRegistering(true);
    try {
      const salaryInStroops = Math.floor(parseFloat(employeeSalary) * 10000000);

      const result = await registerEmployee(
        walletAddress,
        employeeWallet,
        salaryInStroops
      );

      showNotification(
        `Employee registered successfully! Employee ID: ${result.hash?.substring(0, 8)}...`,
        "success"
      );

      setEmployeeWallet("");
      setEmployeeSalary("");
    } catch (error) {
      console.error("Registration failed:", error);
      showNotification(
        error.message || "Failed to register employee. Please try again.",
        "error"
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDepositToVault = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      showNotification("Please connect your wallet first", "error");
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    setIsDepositing(true);
    try {
      const amountInStroops = Math.floor(parseFloat(depositAmount) * 10000000);

      await depositToVault(walletAddress, amountInStroops);

      showNotification(
        `Successfully deposited $${parseFloat(depositAmount).toFixed(2)} to vault`,
        "success"
      );

      setDepositAmount("");
      fetchVaultData(); // Refresh vault stats
    } catch (error) {
      console.error("Deposit failed:", error);
      showNotification(
        error.message || "Failed to deposit to vault. Please try again.",
        "error"
      );
    } finally {
      setIsDepositing(false);
    }
  };

  const handleUpdateMaxWithdraw = async () => {
    if (!isConnected) {
      showNotification("Please connect your wallet first", "error");
      return;
    }

    if (maxWithdrawPct < 0 || maxWithdrawPct > 100) {
      showNotification("Percentage must be between 0 and 100", "error");
      return;
    }

    setIsUpdatingConfig(true);
    try {
      await setMaxWithdrawPercentage(walletAddress, maxWithdrawPct);

      showNotification(
        `Maximum withdrawal limit updated to ${maxWithdrawPct}%`,
        "success"
      );

      fetchVaultData(); // Refresh stats
    } catch (error) {
      console.error("Update failed:", error);
      showNotification(
        error.message || "Failed to update configuration",
        "error"
      );
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Panel</h2>
        <p className="text-gray-600">
          Please connect your wallet to access admin features
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-lg ${
            notification.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage employees, vault, and system configuration
        </p>
      </div>

      {/* Vault Statistics */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Vault Health</h2>
          <button
            onClick={fetchVaultData}
            disabled={isLoadingStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoadingStats ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-blue-600">
              ${vaultBalance.toFixed(2)}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Deposited</p>
            <p className="text-2xl font-bold text-green-600">
              ${((vaultStats?.total_deposited || 0) / 10000000).toFixed(2)}
            </p>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Withdrawn</p>
            <p className="text-2xl font-bold text-orange-600">
              ${((vaultStats?.total_withdrawn || 0) / 10000000).toFixed(2)}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Max Withdraw %</p>
            <p className="text-2xl font-bold text-purple-600">
              {vaultStats?.max_withdraw_percentage || maxWithdrawPct}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Registration */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Register New Employee
          </h2>

          <form onSubmit={handleRegisterEmployee} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Wallet Address
              </label>
              <input
                type="text"
                value={employeeWallet}
                onChange={(e) => setEmployeeWallet(e.target.value)}
                placeholder="GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRegistering}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Salary (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={employeeSalary}
                onChange={(e) => setEmployeeSalary(e.target.value)}
                placeholder="5000.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isRegistering}
              />
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {isRegistering ? "Registering..." : "Register Employee"}
            </button>
          </form>
        </div>

        {/* Vault Deposit */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Deposit to Vault
          </h2>

          <form onSubmit={handleDepositToVault} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deposit Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="1000.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isDepositing}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                Current vault balance: ${vaultBalance.toFixed(2)}
              </p>
            </div>

            <button
              type="submit"
              disabled={isDepositing}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isDepositing ? "Depositing..." : "Deposit Funds"}
            </button>
          </form>
        </div>
      </div>

      {/* System Configuration */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          System Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Withdrawal Percentage (0-100%)
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                min="0"
                max="100"
                value={maxWithdrawPct}
                onChange={(e) => setMaxWithdrawPct(parseInt(e.target.value) || 0)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isUpdatingConfig}
              />
              <button
                onClick={handleUpdateMaxWithdraw}
                disabled={isUpdatingConfig}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {isUpdatingConfig ? "Updating..." : "Update Limit"}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Controls how much of their salary employees can withdraw early.
              Current: {maxWithdrawPct}%
            </p>
          </div>
        </div>
      </div>

      {/* Contract Information */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Contract Addresses
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Wage Contract:</span>
            <span className="font-mono text-gray-800">
              {CONTRACTS.WAGE.substring(0, 12)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Token Contract:</span>
            <span className="font-mono text-gray-800">
              {CONTRACTS.TOKEN.substring(0, 12)}...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
