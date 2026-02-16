import React, { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { requestAdvance, getRemainingSalary, CONTRACTS } from "../services/sorobanService";
import { sendLumens } from "../services/apiService";
import PayCycleProgress from "./PayCycleProgress";
import WithdrawForm from "./WithdrawForm";
import TransactionHistory from "./TransactionHistory";
import SendMoneyModal from "./SendMoneyModal";
import WaitlistModal from "./WaitlistModal";

const HomePage = () => {
  const {
    walletAddress,
    isConnecting,
    isConnected,
    error: walletError,
    isFreighterInstalled,
    checkingInstallation,
    connectWallet,
    disconnectWallet,
    formatAddress,
  } = useWallet();

  const [lastWithdrawalDate, setLastWithdrawalDate] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [monthlySalary] = useState(5000);
  const [employeeId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      fetchEmployeeData();
    }
  }, [walletAddress]);

  const fetchEmployeeData = async () => {
    try {
      setIsLoading(true);
      const remaining = await getRemainingSalary(walletAddress, employeeId);
      setAvailableBalance(remaining / 10000000);
    } catch (error) {
      console.error("Error fetching employee data:", error);
      setAvailableBalance(3500);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleWaitlistSuccess = (email) => {
    showNotification(`🎉 Welcome aboard! We'll notify you at ${email}`);
  };

  const handleWithdraw = async (amount) => {
    if (!walletAddress) {
      showNotification("Please connect your wallet first", "error");
      return;
    }

    setIsLoading(true);
    try {
      const amountInStroops = Math.floor(parseFloat(amount) * 10000000);
      
      const result = await requestAdvance(
        walletAddress,
        employeeId,
        amountInStroops,
        CONTRACTS.TOKEN
      );

      const fee = parseFloat(amount) * 0.0125;
      const netAmount = parseFloat(amount) - fee;

      setAvailableBalance((prev) => prev - parseFloat(amount));
      setLastWithdrawalDate(new Date());

      const newTransaction = {
        type: "Withdrawal",
        amount: netAmount,
        fee: fee,
        date: new Date().toISOString(),
        hash: result.hash,
        status: "completed",
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      showNotification(`Successfully withdrew $${netAmount.toFixed(2)} (Fee: $${fee.toFixed(2)})`);
    } catch (error) {
      console.error("Withdrawal failed:", error);
      showNotification(error.message || "Withdrawal failed. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMoney = async (recipient, amount) => {
    setIsLoading(true);
    try {
      const result = await sendLumens(recipient, amount);
      
      const newTransaction = {
        type: "Send",
        amount: parseFloat(amount),
        recipient: recipient,
        date: new Date().toISOString(),
        hash: result.hash,
        status: "completed",
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      showNotification(`Successfully sent ${amount} XLM to ${recipient.substring(0, 8)}...`);
      setShowSendModal(false);
    } catch (error) {
      console.error("Send failed:", error);
      showNotification(error.message || "Transfer failed. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl border transition-all duration-500 animate-slide-in ${
            notification.type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{notification.type === "error" ? "⚠️" : "✓"}</span>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="w-full border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0a0a0a]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>
              </svg>
            </div>
            <span className="text-xl font-semibold text-white">StellarPay</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#stats" className="text-gray-400 hover:text-white transition-colors">Stats</a>
            <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-3">
            {isConnected && (
              <button
                onClick={() => setShowSendModal(true)}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <span>💸</span>
                <span className="hidden sm:inline">Send XLM</span>
              </button>
            )}

            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-mono text-sm">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                  title="Disconnect"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Connect Wallet ✦"
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              <span className="underline decoration-2 underline-offset-8">Think</span>{" "}
              <span className="bg-gradient-to-r from-pink-300 to-purple-300 px-3 py-1">Secure</span>
              <br />
              <span className="text-white">Pay Effortlessly</span>
            </h1>
            
            <div className="w-full h-px bg-white/10 my-8" />
            
            <p className="text-xl text-gray-400 leading-relaxed">
              Your Gateway to Instant Remittances, Early Wage Access and Seamless Payroll.
            </p>
            
            <div className="w-full h-px bg-white/10 my-8" />
            
            <div className="flex flex-wrap gap-4">
              <button className="px-6 py-3 rounded-lg border border-white/20 text-white hover:bg-white/5 transition-all flex items-center gap-2">
                Know More
                <span className="text-gray-500">ⓘ</span>
              </button>
              <button 
                onClick={() => setShowWaitlistModal(true)}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-300/90 to-purple-300/90 text-black font-semibold hover:opacity-90 transition-all flex items-center gap-2"
              >
                Join the Waitlist
                <span>✦</span>
              </button>
            </div>
          </div>

          {/* Abstract Graphics */}
          <div className="hidden lg:flex justify-center items-center relative">
            <div className="relative w-80 h-80">
              {/* Decorative shapes */}
              <div className="absolute top-0 right-0 w-40 h-8 bg-gradient-to-r from-gray-600 to-gray-700 rounded-full" />
              <div className="absolute top-12 left-0 w-8 h-8 bg-gray-500 rounded-full" />
              <div className="absolute top-20 right-8 w-40 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full" />
              <div className="absolute top-32 right-0 w-8 h-8 bg-gray-400 rounded-full" />
              <div className="absolute top-40 left-8 w-40 h-8 bg-gradient-to-r from-gray-600 to-gray-500 rounded-full" />
              <div className="absolute bottom-20 right-16 w-4 h-32 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full" />
              <div className="absolute bottom-16 right-8 w-4 h-40 bg-gradient-to-b from-gray-300 to-gray-500 rounded-full" />
              <div className="absolute bottom-24 right-0 w-4 h-28 bg-gradient-to-b from-gray-500 to-gray-700 rounded-full" />
              <div className="absolute bottom-12 right-4 w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-28 right-20 w-3 h-3 bg-gray-400 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Warning Messages */}
      <section className="max-w-7xl mx-auto px-6">
        {checkingInstallation ? (
          <div className="mb-8 p-5 rounded-xl bg-[#111] border border-white/10">
            <div className="flex items-center gap-4">
              <svg className="animate-spin h-6 w-6 text-pink-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div>
                <h3 className="font-medium text-white">Checking for Freighter Wallet...</h3>
                <p className="text-gray-500 text-sm mt-1">Please wait while we detect your wallet.</p>
              </div>
            </div>
          </div>
        ) : !isFreighterInstalled && !isConnected ? (
          <div className="mb-8 p-5 rounded-xl bg-[#111] border border-amber-500/20">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🦊</span>
              <div>
                <h3 className="font-medium text-amber-400">Freighter Wallet Required</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Install Freighter wallet to access all features.{" "}
                  <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">
                    Get Freighter →
                  </a>
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {walletError && (
          <div className="mb-8 p-5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400">
            {walletError}
          </div>
        )}
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            }
            title="Early Wage Access"
            description="Access your earned wages before payday. No more waiting, no more stress."
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 9l-5 5-4-4-3 3" />
              </svg>
            }
            title="Real-time Analytics"
            description="Track your earnings, withdrawals, and spending patterns in real-time."
          />
        </div>
      </section>

      {/* Dashboard Section */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Balance Card */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
                    Available Balance
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-5xl font-bold text-white">
                      ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">
                    of ${monthlySalary.toLocaleString()} monthly salary
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-gray-500">Testnet</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>Withdrawn</span>
                  <span>{((1 - availableBalance / monthlySalary) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${((monthlySalary - availableBalance) / monthlySalary) * 100}%` }}
                  />
                </div>
              </div>

              <WithdrawForm
                onWithdraw={handleWithdraw}
                maxAmount={availableBalance}
                isLoading={isLoading}
                isConnected={isConnected}
              />
            </div>
          </div>

          {/* Pay Cycle Card */}
          <div className="lg:col-span-1">
            <PayCycleProgress lastWithdrawalDate={lastWithdrawalDate} />
          </div>

          {/* Transaction History */}
          <div className="lg:col-span-3">
            <TransactionHistory transactions={transactions} />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon="📊" label="Fee Rate" value="1.25%" subtext="Per advance" />
          <StatCard icon="⚡" label="Processing" value="~5 sec" subtext="Stellar network" />
          <StatCard icon="🔒" label="Contract" value="Verified" subtext="Soroban smart contract" />
        </div>
      </section>

      {/* Send Money Modal */}
      {showSendModal && (
        <SendMoneyModal
          onClose={() => setShowSendModal(false)}
          onSend={handleSendMoney}
          isLoading={isLoading}
        />
      )}

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <WaitlistModal
          onClose={() => setShowWaitlistModal(false)}
          onSuccess={handleWaitlistSuccess}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/[0.08] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm">
            Built on Stellar • Powered by Soroban Smart Contracts
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">Documentation</a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">GitHub</a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, title, description }) => (
  <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-6">
    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-500 text-sm">{description}</p>
  </div>
);

// Stat Card Component
const StatCard = ({ icon, label, value, subtext }) => (
  <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-gray-600 text-xs mt-1">{subtext}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);

export default HomePage;
