import React, { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  depositToVault,
  getVaultBalance,
  getEmployeeDetails,
  releaseRemainingSalary,
  CONTRACTS,
} from "../services/sorobanService";

const EMPLOYEE_IDS = [1, 2, 3, 4];

const EmployerDashboard = () => {
  const { walletAddress, isConnected, isConnecting, connectWallet, disconnectWallet, formatAddress } = useWallet();

  const [employees, setEmployees] = useState([]);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [releasingId, setReleasingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) fetchDashboardData();
  }, [walletAddress]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const balance = await getVaultBalance(walletAddress, CONTRACTS.TOKEN);
      setVaultBalance(balance / 10000000);

      const results = await Promise.allSettled(
        EMPLOYEE_IDS.map((id) => getEmployeeDetails(walletAddress, id))
      );

      const fetched = results
        .map((r, idx) => {
          if (r.status === "fulfilled" && r.value) {
            const raw = r.value;
            return {
              id: EMPLOYEE_IDS[idx],
              name: `Employee #${EMPLOYEE_IDS[idx]}`,
              walletAddress: raw?.wallet?.toString() || "Unknown",
              salary: Number(raw?.salary || 0) / 10000000,
              withdrawn: Number(raw?.withdrawn || 0) / 10000000,
              status: raw?.active ? "active" : "inactive",
            };
          }
          return null;
        })
        .filter(Boolean);

      setEmployees(fetched);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      showNotification("Failed to load dashboard data.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return showNotification("Enter a valid deposit amount", "error");
    if (!isConnected) return showNotification("Connect your wallet first", "error");
    setIsDepositing(true);
    try {
      await depositToVault(walletAddress, Math.floor(amount * 10000000), CONTRACTS.TOKEN);
      setVaultBalance((prev) => prev + amount);
      setDepositAmount("");
      showNotification(`Successfully deposited ${amount.toLocaleString()} XLM to vault`);
    } catch (err) {
      showNotification(err.message || "Deposit failed. Please try again.", "error");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleReleaseSalary = async (employee) => {
    if (!isConnected) return showNotification("Connect your wallet first", "error");
    setReleasingId(employee.id);
    try {
      await releaseRemainingSalary(walletAddress, employee.id, CONTRACTS.TOKEN, Math.floor(employee.salary * 10000000));
      const released = employee.salary - employee.withdrawn;
      setVaultBalance((prev) => prev - released);
      setEmployees((prev) => prev.map((e) => e.id === employee.id ? { ...e, withdrawn: e.salary } : e));
      showNotification(`Released ${released.toLocaleString()} XLM to ${employee.name}`);
    } catch (err) {
      showNotification(err.message || "Salary release failed. Please try again.", "error");
    } finally {
      setReleasingId(null);
    }
  };

  const totalSalaries = employees.reduce((sum, e) => sum + e.salary, 0);
  const totalWithdrawn = employees.reduce((sum, e) => sum + e.withdrawn, 0);
  const activeEmployees = employees.filter((e) => e.status === "active").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl border transition-all duration-500 ${notification.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{notification.type === "error" ? "⚠️" : "✓"}</span>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <header className="w-full border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0a0a0a]" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" /></svg>
            </div>
            <span className="text-xl font-semibold text-white">StellarPay</span>
            <span className="px-2 py-0.5 rounded-md bg-pink-400/10 border border-pink-400/20 text-pink-400 text-xs font-medium">Employer</span>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-mono text-sm">{formatAddress(walletAddress)}</span>
                </div>
                <button onClick={disconnectWallet} className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button onClick={connectWallet} disabled={isConnecting} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                {isConnecting ? "Connecting..." : "Connect Wallet ✦"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white">Employer Dashboard</h1>
          <p className="text-gray-500 mt-2">Manage employees, vault funds, and salary releases.</p>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-10 text-center">
            <p className="text-gray-400 mb-4">Connect your Freighter wallet to load dashboard data.</p>
            <button onClick={connectWallet} disabled={isConnecting} className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 disabled:opacity-50">
              {isConnecting ? "Connecting..." : "Connect Wallet ✦"}
            </button>
          </div>
        )}

        {/* Loading */}
        {isConnected && isLoading && (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-pink-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {isConnected && !isLoading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <StatCard icon="🏦" label="Vault Balance" value={`${vaultBalance.toLocaleString()} XLM`} accent="pink" />
              <StatCard icon="👥" label="Active Employees" value={employees.length ? `${activeEmployees} / ${employees.length}` : "—"} accent="purple" />
              <StatCard icon="💰" label="Total Payroll" value={employees.length ? `${totalSalaries.toLocaleString()} XLM` : "—"} accent="emerald" />
              <StatCard icon="📤" label="Total Withdrawn" value={employees.length ? `${totalWithdrawn.toLocaleString()} XLM` : "—"} accent="amber" />
            </div>

            <div className="flex gap-1 mb-8 p-1 bg-white/5 rounded-xl w-fit border border-white/[0.08]">
              {["overview", "employees", "deposit"].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-gradient-to-r from-pink-400 to-purple-400 text-black" : "text-gray-400 hover:text-white"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 rounded-2xl bg-[#111] border border-white/[0.08] p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Vault Status</h2>
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-sm uppercase tracking-wider mb-2">Current Balance</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{vaultBalance.toLocaleString()}</p>
                    <p className="text-gray-500 mt-1">XLM</p>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mb-2">
                    <span>Payroll Coverage</span>
                    <span>{totalSalaries > 0 ? Math.min(100, (vaultBalance / totalSalaries) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full transition-all duration-700"
                      style={{ width: `${totalSalaries > 0 ? Math.min(100, (vaultBalance / totalSalaries) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-gray-600">Total payroll: {totalSalaries.toLocaleString()} XLM</p>
                  <button onClick={() => setActiveTab("deposit")} className="w-full mt-6 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 text-sm">
                    + Deposit Funds
                  </button>
                </div>

                <div className="lg:col-span-2 rounded-2xl bg-[#111] border border-white/[0.08] p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-white">Employees</h2>
                    <button onClick={() => setActiveTab("employees")} className="text-sm text-pink-400 hover:text-pink-300">View all →</button>
                  </div>
                  {employees.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-600 text-sm">No employees found on contract.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {employees.slice(0, 3).map((emp) => (
                        <EmployeeRow key={emp.id} employee={emp} onRelease={handleReleaseSalary} isReleasing={releasingId === emp.id} compact />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "employees" && (
              <div className="rounded-2xl bg-[#111] border border-white/[0.08] overflow-hidden">
                <div className="p-6 border-b border-white/[0.08]">
                  <h2 className="text-lg font-semibold text-white">All Employees</h2>
                  <p className="text-gray-500 text-sm mt-1">{employees.length} registered employees</p>
                </div>
                {employees.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 text-sm">No employees found on contract.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {employees.map((emp) => (
                      <EmployeeRow key={emp.id} employee={emp} onRelease={handleReleaseSalary} isReleasing={releasingId === emp.id} onSelect={setSelectedEmployee} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "deposit" && (
              <div className="max-w-lg">
                <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-8">
                  <h2 className="text-lg font-semibold text-white mb-2">Deposit to Vault</h2>
                  <p className="text-gray-500 text-sm mb-8">Add funds to the vault to ensure payroll coverage.</p>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-6">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Current Vault Balance</p>
                    <p className="text-2xl font-bold text-white">{vaultBalance.toLocaleString()} <span className="text-gray-500 text-base font-normal">XLM</span></p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Amount (XLM)</label>
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-pink-400/50 transition-colors" />
                  </div>
                  <div className="flex gap-2 mb-6">
                    {[1000, 5000, 10000, 25000].map((amt) => (
                      <button key={amt} onClick={() => setDepositAmount(String(amt))}
                        className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-all">
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleDeposit} disabled={isDepositing || !isConnected}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isDepositing ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Depositing...</>
                    ) : "Deposit to Vault ✦"}
                  </button>
                  {!isConnected && <p className="text-center text-gray-600 text-xs mt-3">Connect your wallet to deposit funds</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-[#111] border border-white/10 p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedEmployee.name}</h3>
                <p className="text-gray-500 text-sm mt-1 font-mono">{selectedEmployee.walletAddress.slice(0, 10)}...{selectedEmployee.walletAddress.slice(-8)}</p>
              </div>
              <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">✕</button>
            </div>
            <div className="space-y-4 mb-6">
              {[
                { label: "Monthly Salary", value: `${selectedEmployee.salary.toLocaleString()} XLM`, cls: "text-white" },
                { label: "Withdrawn", value: `${selectedEmployee.withdrawn.toLocaleString()} XLM`, cls: "text-white" },
                { label: "Remaining", value: `${(selectedEmployee.salary - selectedEmployee.withdrawn).toLocaleString()} XLM`, cls: "text-emerald-400" },
                { label: "Status", value: selectedEmployee.status, cls: selectedEmployee.status === "active" ? "text-emerald-400" : "text-gray-500" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between py-3 border-b border-white/[0.06] last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-medium capitalize ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { handleReleaseSalary(selectedEmployee); setSelectedEmployee(null); }}
              disabled={selectedEmployee.withdrawn >= selectedEmployee.salary || releasingId === selectedEmployee.id}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
              Release Full Salary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, accent }) => {
  const accents = {
    pink: "from-pink-400/10 to-pink-400/5 border-pink-400/20",
    purple: "from-purple-400/10 to-purple-400/5 border-purple-400/20",
    emerald: "from-emerald-400/10 to-emerald-400/5 border-emerald-400/20",
    amber: "from-amber-400/10 to-amber-400/5 border-amber-400/20",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${accents[accent]} border p-5`}>
      <span className="text-2xl mb-3 block">{icon}</span>
      <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold text-lg mt-1">{value}</p>
    </div>
  );
};

const EmployeeRow = ({ employee, onRelease, isReleasing, compact, onSelect }) => {
  const remaining = employee.salary - employee.withdrawn;
  const progress = employee.salary > 0 ? (employee.withdrawn / employee.salary) * 100 : 0;
  return (
    <div className={`flex items-center gap-4 ${compact ? "py-3" : "px-6 py-4"} hover:bg-white/[0.02] transition-colors ${onSelect ? "cursor-pointer" : ""}`}
      onClick={() => onSelect && onSelect(employee)}>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400/20 to-purple-400/20 border border-white/10 flex items-center justify-center text-sm font-semibold text-white shrink-0">
        {employee.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{employee.name}</p>
          <span className={`px-1.5 py-0.5 rounded text-xs ${employee.status === "active" ? "bg-emerald-400/10 text-emerald-400" : "bg-gray-500/10 text-gray-500"}`}>{employee.status}</span>
        </div>
        {!compact && <p className="text-gray-600 text-xs font-mono truncate mt-0.5">{employee.walletAddress.slice(0, 12)}...</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-24">
            <div className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-gray-600 text-xs">{progress.toFixed(0)}% withdrawn</span>
        </div>
      </div>
      {!compact && (
        <div className="text-right shrink-0">
          <p className="text-white text-sm font-medium">{employee.salary.toLocaleString()} XLM</p>
          <p className="text-gray-600 text-xs mt-0.5">{remaining.toLocaleString()} remaining</p>
        </div>
      )}
      <button onClick={(e) => { e.stopPropagation(); onRelease(employee); }} disabled={isReleasing || remaining <= 0}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-pink-400/10 hover:border-pink-400/30 hover:text-pink-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {isReleasing ? (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : remaining <= 0 ? "Paid ✓" : "Release"}
      </button>
    </div>
  );
};

export default EmployerDashboard;