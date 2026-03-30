import React, { useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../context/WalletContext";
import { requestAdvance, getRemainingSalary,  CONTRACTS } from "../services/sorobanService";
import { sendLumens } from "../services/apiService";
import PayCycleProgress from "./PayCycleProgress";
import WithdrawForm from "./WithdrawForm";
import TransactionHistory from "./TransactionHistory";
import SendMoneyModal from "./SendMoneyModal";
import WaitlistModal from "./WaitlistModal";
import { useEmployeeStore } from "../store/empStore";
import RegistrationCard from "./RegistrationCard";
import { useCheckUser } from "../hooks/checkUser";


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
    // Multi-currency
    tokenBalances,
    selectedToken,
    setSelectedToken,
    exchangeRates,
    loadingBalances,
  } = useWalletContext();


  const employeeId = useEmployeeStore((state) => state.empId);
  const monthlySalary = useEmployeeStore((state) => state.salary);
  const { checkUser } = useCheckUser();

  const [lastWithdrawalDate, setLastWithdrawalDate] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false); //to check if a user is registered or not 


  const fetchEmployeeData = useCallback(async () => {
    // this function uses hooks to check whether a user is registered or not;
    if (!walletAddress) return;

    try {
      setIsLoading(true);
      const { isRegistered, empData } = await checkUser(walletAddress);

      if (!isRegistered) {
        setShowRegisterModal(true);
        return;
      }

      // If registered, hide the modal forcefully and load scaled salary
      setShowRegisterModal(false);

      const scaledSalary = empData?.rem_salary
        ? empData.rem_salary / 10000000
        : (empData?.salary || 0);
      setAvailableBalance(scaledSalary);

    } catch (error) {
      console.error("Error fetching employee data in HomePage:", error);
    } finally {
      setIsLoading(false);
    }
  }, [checkUser, walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      fetchEmployeeData();
    }
  }, [walletAddress]);


  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleWaitlistSuccess = (email) => {
    showNotification(`🎉 Welcome aboard! We'll notify you at ${email}`);
  };

  // Updated to accept token param from WithdrawForm
  const handleWithdraw = async (amount, token) => {
    if (!walletAddress) {
      showNotification("Please connect your wallet first", "error");
      return;
    }

    const activeToken = token || selectedToken;
    const tokenAddress = activeToken?.isNative ? CONTRACTS.TOKEN : activeToken?.address;

    setIsLoading(true);
    try {
      const amountInStroops = Math.floor(parseFloat(amount) * 10000000);

      const result = await requestAdvance(
        walletAddress,
        employeeId,
        amountInStroops,
        tokenAddress || CONTRACTS.TOKEN
      );

      const fee = parseFloat(amount) * 0.0125;
      const netAmount = parseFloat(amount) - fee;

      setAvailableBalance((prev) => prev - parseFloat(amount));
      setLastWithdrawalDate(new Date());

      const newTransaction = {
        type: "Withdrawal",
        amount: netAmount,
        fee: fee,
        currency: activeToken?.symbol || "XLM",
        date: new Date().toISOString(),
        hash: result.hash,
        status: "completed",
      };

      setTransactions((prev) => [newTransaction, ...prev]);
      showNotification(
        `Successfully withdrew ${netAmount.toFixed(4)} ${activeToken?.symbol || "XLM"} (Fee: ${fee.toFixed(4)})`
      );
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
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl border transition-all duration-500 animate-slide-in ${notification.type === "error"
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
            <div className="w-[38px] h-[38px] rounded-lg bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 80 80" fill="none">
                <ellipse cx="40" cy="40" rx="35" ry="14" transform="rotate(-30 40 40)" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
                <path d="M48 24C48 24 44 20 36 22C28 24 26 30 30 34C34 38 46 38 50 42C54 46 50 54 42 56C34 58 28 54 28 54" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
                <circle cx="58" cy="26" r="3.5" fill="white" />
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
            {/* Stellar badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-400/10 border border-pink-400/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
              <span className="text-xs text-pink-400 font-medium">Built on Stellar Network</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              <span className="underline decoration-2 underline-offset-8">Think</span>{" "}
              <span className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">Secure</span>
              <br />
              <span className="text-white">Pay Effortlessly</span>
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed mt-8">
              Your Gateway to Instant Remittances, Early Wage Access and Seamless Payroll.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">
              <button className="px-6 py-3 rounded-lg border border-white/15 text-white hover:bg-white/5 transition-all flex items-center gap-2">
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

          {/* Hero Orbital Graphic */}
          <div className="hidden lg:flex justify-center items-center relative">
            <div className="relative w-80 h-80">
              <svg width="320" height="320" viewBox="0 0 320 320" fill="none" className="w-full h-full">
                {/* Outer glow rings */}
                <circle cx="160" cy="160" r="140" stroke="url(#heroGrad1)" strokeWidth="1" opacity="0.15" />
                <circle cx="160" cy="160" r="105" stroke="url(#heroGrad1)" strokeWidth="1" opacity="0.08" />
                {/* Orbital paths */}
                <ellipse cx="160" cy="160" rx="125" ry="45" transform="rotate(-25 160 160)" stroke="url(#heroGrad1)" strokeWidth="2" opacity="0.25" />
                <ellipse cx="160" cy="160" rx="115" ry="40" transform="rotate(15 160 160)" stroke="url(#heroGrad2)" strokeWidth="1.5" opacity="0.15" />
                {/* Central S */}
                <path d="M178 112C178 112 170 104 156 107C142 110 138 120 144 126C150 132 170 132 176 138C182 144 176 156 166 159C156 162 146 157 146 157" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                {/* Orbiting dots */}
                <circle cx="68" cy="120" r="5" fill="#f472b6" opacity="0.8" />
                <circle cx="252" cy="200" r="4" fill="#a78bfa" opacity="0.8" />
                <circle cx="208" cy="68" r="3" fill="#f9a8d4" opacity="0.6" />
                <circle cx="112" cy="252" r="2.5" fill="#c4b5fd" opacity="0.5" />
                {/* Payment flow lines */}
                <path d="M100 180L125 155" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M195 155L220 130" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="heroGrad1" x1="20" y1="20" x2="300" y2="300" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f472b6" />
                    <stop offset="1" stopColor="#a78bfa" />
                  </linearGradient>
                  <linearGradient id="heroGrad2" x1="300" y1="20" x2="20" y2="300" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
              </svg>
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
        <div className="grid md:grid-cols-3 gap-6">
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
          <FeatureCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            }
            title="Instant Remittances"
            description="Send money globally in seconds via Stellar. Fast, low-cost transfers."
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
                      {selectedToken?.symbol || "XLM"}{" "}
                      {availableBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">

                    of {selectedToken?.symbol || "XLM"} {(monthlySalary ?? 0).toLocaleString()} monthly salary

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
                  <span>{((1 - availableBalance / Math.max(monthlySalary || 1, 1)) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${((Math.max(monthlySalary || 1, 1) - availableBalance) / Math.max(monthlySalary || 1, 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* WithdrawForm — multi-currency props passed in */}
              <WithdrawForm
                onWithdraw={handleWithdraw}
                maxAmount={availableBalance}
                isLoading={isLoading}
                isConnected={isConnected}
                tokenBalances={tokenBalances}
                selectedToken={selectedToken}
                onTokenChange={setSelectedToken}
                exchangeRates={exchangeRates}
                loadingBalances={loadingBalances}
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
          <StatCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Fee Rate" value="1.25%" subtext="Per advance"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Processing" value="~5 sec" subtext="Stellar network"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            }
            label="Contract" value="Verified" subtext="Soroban smart contract"
          />
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

      {/* Registration Modal */}
      {showRegisterModal && (
        <RegistrationCard
          onSuccess={() => {
            setShowRegisterModal(false);
            fetchEmployeeData();
          }}
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

const FeatureCard = ({ icon, title, description }) => (
  <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-6">
    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-500 text-sm">{description}</p>
  </div>
);

const StatCard = ({ icon, label, value, subtext }) => (
  <div className="rounded-2xl bg-[#111] border border-white/[0.08] p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-gray-600 text-xs mt-1">{subtext}</p>
      </div>
      <div className="text-gray-400">{icon}</div>
    </div>
  </div>
);

export default HomePage;