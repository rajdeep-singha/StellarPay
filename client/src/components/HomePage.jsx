import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "../hooks/useWallet";
import { requestAdvance, CONTRACTS } from "../services/sorobanService";
import { sendLumens } from "../services/apiService";
import PayCycleProgress from "./PayCycleProgress";
import WithdrawForm from "./WithdrawForm";
import TransactionHistory from "./TransactionHistory";
import SendMoneyModal from "./SendMoneyModal";
import WaitlistModal from "./WaitlistModal";
import { useEmployeeStore } from "../store/empStore";
import { useCheckUser } from "../hooks/checkUser";
import logoSvg from "../assets/stellarpay-logo.svg";
import heroThumbnail from "../assets/hero-blockchain-thumbnail.svg";


const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};


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
  } = useWallet();


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


  const fetchEmployeeData = useCallback(async () => {
    // this function uses hooks to check whether a user is registered or not;
    if (!walletAddress) return;

    try {
      setIsLoading(true);
      const { isRegistered, empData } = await checkUser(walletAddress);

      if (!isRegistered) {
        setAvailableBalance(0);
        return;
      }

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
      <header className="w-full border-b border-white/[0.08] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <img src={logoSvg} alt="StellarPay Logo" className="w-10 h-10 sm:w-11 sm:h-11" />
            <div className="leading-tight">
              <p className="text-lg sm:text-xl font-semibold tracking-tight text-white">StellarPay</p>
              <p className="text-xs text-gray-500">Borderless Payroll Infrastructure</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#stats" className="text-gray-400 hover:text-white transition-colors">Stats</a>
            <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isConnected && (
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => setShowSendModal(true)}
                className="px-3 sm:px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <span>💸</span>
                <span className="hidden sm:inline">Send XLM</span>
              </motion.button>
            )}

            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-mono text-sm">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
                <motion.button
                  whileHover={{ y: -2, scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={disconnectWallet}
                  className="p-2.5 rounded-xl border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                  title="Disconnect"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                  "Connect Wallet"
                )}
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 md:pt-16 md:pb-14"
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div variants={fadeUp} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-xs text-gray-300 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Stellar + Soroban Powered
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.08] tracking-tight text-white">
              Modern Payroll and
              <span className="block bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                Borderless Payments
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl">
              Streamline remittance, early wage access, and global payouts with secure, low-fee rails built for modern teams.
            </p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3 sm:gap-4">
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="px-6 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-all"
              >
                Know More
              </motion.button>
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => setShowWaitlistModal(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-300/90 to-blue-300/90 text-black font-semibold hover:opacity-90 transition-all"
              >
                Join the Waitlist
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="lg:justify-self-end"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-3 shadow-2xl shadow-blue-500/10">
              <img
                src={heroThumbnail}
                alt="Blockchain and payment network illustration"
                className="w-full max-w-[560px] rounded-2xl object-cover"
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Warning Messages */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        className="max-w-7xl mx-auto px-4 sm:px-6"
      >
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
      </motion.section>

      {/* Features Grid */}
      <motion.section
        id="features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10"
      >
        <div className="mb-6 sm:mb-8">
          <p className="text-sm uppercase tracking-wider text-gray-500">Features</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-2">Built for speed, trust, and scale</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
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
      </motion.section>

      {/* Dashboard Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        className="max-w-7xl mx-auto px-4 sm:px-6 py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Balance Card */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl bg-gradient-to-br from-[#111827] to-[#10131f] border border-white/[0.08] p-5 sm:p-8 shadow-xl shadow-blue-950/20">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-gray-400 text-xs sm:text-sm font-medium uppercase tracking-[0.2em]">
                    Available Balance
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl sm:text-5xl font-semibold text-white tracking-tight">
                      {selectedToken?.symbol || "XLM"}{" "}
                      {availableBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">

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
                <div className="flex justify-between text-xs sm:text-sm text-gray-500 mb-2">
                  <span>Withdrawn</span>
                  <span>{((1 - availableBalance / Math.max(monthlySalary || 1, 1)) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-500"
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
      </motion.section>

      {/* Stats Section */}
      <motion.section
        id="stats"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          <StatCard icon="📊" label="Fee Rate" value="1.25%" subtext="Per advance" />
          <StatCard icon="⚡" label="Processing" value="~5 sec" subtext="Stellar network" />
          <StatCard icon="🔒" label="Contract" value="Verified" subtext="Soroban smart contract" />
        </div>
      </motion.section>

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
      <footer id="about" className="border-t border-white/[0.08] mt-14 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
  <motion.div
    whileHover={{ y: -4 }}
    transition={{ type: "spring", stiffness: 280, damping: 22 }}
    className="rounded-3xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-white/[0.08] p-6 shadow-lg shadow-purple-900/10"
  >
    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-300 mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const StatCard = ({ icon, label, value, subtext }) => (
  <motion.div
    whileHover={{ y: -4 }}
    transition={{ type: "spring", stiffness: 280, damping: 22 }}
    className="rounded-3xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-white/[0.08] p-6 shadow-lg shadow-blue-900/10"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-2xl font-semibold text-white mt-1 tracking-tight">{value}</p>
        <p className="text-gray-500 text-xs mt-1">{subtext}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  </motion.div>
);

export default HomePage;