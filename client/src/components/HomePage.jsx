import React, { useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../context/WalletContext";
import { requestAdvance, getRemainingSalary,  CONTRACTS } from "../services/sorobanService";
import { sendLumens } from "../services/apiService";
import PayCycleProgress from "./PayCycleProgress";
import WithdrawForm from "./WithdrawForm";
import TransactionHistory from "./TransactionHistory";
import SendMoneyModal from "./SendMoneyModal";
import WaitlistModal from "./WaitlistModal";
import RegistrationCard from "./RegistrationCard";
import Logo from "./Logo";
import { useEmployeeStore } from "../store/empStore";
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
  const [showMobileMenu, setShowMobileMenu] = useState(false); 


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

      // Ensure we have a valid employee ID before proceeding
      if (!employeeId) {
        showNotification("Employee registration required. Please register first.", "error");
        return;
      }

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
      <header className="w-full border-b border-white/[0.08] sticky top-0 z-40 backdrop-blur-sm bg-[#0a0a0a]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Logo size="medium" />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#stats" className="text-gray-400 hover:text-white transition-colors">Stats</a>
              <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-3">
              {isConnected && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-all flex items-center gap-2"
                >
                  <span>?</span>
                  <span>Send XLM</span>
                </button>
              )}

              {isConnected ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-mono text-sm hidden lg:block">
                      {formatAddress(walletAddress)}
                    </span>
                    <span className="text-emerald-400 font-mono text-sm lg:hidden">
                      {formatAddress(walletAddress).slice(0, 6)}...
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
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    "Connect ?"
                  )}
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="sm:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="sm:hidden mt-4 pt-4 border-t border-white/10">
              <nav className="flex flex-col gap-4 mb-4">
                <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#stats" className="text-gray-400 hover:text-white transition-colors">Stats</a>
                <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
              </nav>
              <div className="flex flex-col gap-3">
                {isConnected && (
                  <button
                    onClick={() => setShowSendModal(true)}
                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                  >
                    <span>?</span>
                    <span>Send XLM</span>
                  </button>
                )}
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 flex-1">
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
                    className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Connecting...
                      </span>
                    ) : (
                      "Connect Wallet ?"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6 lg:space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
                <span className="block text-white">Think</span>
                <span className="block bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Secure</span>
                <span className="block text-white">Pay Effortlessly</span>
              </h1>
            </div>

            <div className="w-16 sm:w-20 lg:w-24 h-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"></div>

            <p className="text-lg sm:text-xl md:text-2xl text-gray-300 leading-relaxed max-w-lg">
              Your Gateway to Instant Remittances, Early Wage Access and Seamless Payroll.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="group px-6 py-3 sm:px-8 sm:py-4 rounded-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 flex items-center justify-center gap-3 font-medium">
                <span>Know More</span>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={() => setShowWaitlistModal(true)}
                className="group px-6 py-3 sm:px-8 sm:py-4 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all duration-300 flex items-center justify-center gap-3"
              >
                <span>Join the Waitlist</span>
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Payment Flow Visualization - Desktop */}
          <div className="hidden lg:flex justify-center items-center relative">
            <div className="relative w-80 h-80 lg:w-96 lg:h-96">
              {/* Central Stellar Network Hub */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center animate-pulse">
                  <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
              </div>

              {/* Payment Nodes */}
              <div className="absolute top-8 left-8 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '0s' }}>
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>

              <div className="absolute top-8 right-8 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '0.5s' }}>
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M7 15h10M7 10h10"/>
                </svg>
              </div>

              <div className="absolute bottom-8 left-8 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '1s' }}>
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>

              <div className="absolute bottom-8 right-8 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '1.5s' }}>
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3M21 12c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3M21 12c0 1 1 3 3 3s3-2 3-3-1-3-3-3-3 2-3 3"/>
                </svg>
              </div>

              {/* Connection Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.6"/>
                  </linearGradient>
                </defs>
                <line x1="50%" y1="50%" x2="20%" y2="20%" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse"/>
                <line x1="50%" y1="50%" x2="80%" y2="20%" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" style={{ animationDelay: '0.3s' }}/>
                <line x1="50%" y1="50%" x2="20%" y2="80%" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" style={{ animationDelay: '0.6s' }}/>
                <line x1="50%" y1="50%" x2="80%" y2="80%" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" style={{ animationDelay: '0.9s' }}/>
              </svg>

              {/* Floating Particles */}
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-pink-400 rounded-full animate-ping"></div>
              <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
            </div>
          </div>

          {/* Mobile Payment Flow Visualization */}
          <div className="lg:hidden flex justify-center items-center relative mt-8">
            <div className="relative w-64 h-64">
              {/* Central Stellar Network Hub */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center animate-pulse">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
              </div>

              {/* Payment Nodes - Mobile */}
              <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '0s' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>

              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '0.5s' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M7 15h10M7 10h10"/>
                </svg>
              </div>

              <div className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '1s' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>

              <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center animate-bounce" style={{ animationDelay: '1.5s' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3M21 12c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3M21 12c0 1 1 3 3 3s3-2 3-3-1-3-3-3-3 2-3 3"/>
                </svg>
              </div>

              {/* Connection Lines - Mobile */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="lineGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.6"/>
                  </linearGradient>
                </defs>
                <line x1="50%" y1="50%" x2="20%" y2="20%" stroke="url(#lineGradientMobile)" strokeWidth="1.5" strokeDasharray="4,4" className="animate-pulse"/>
                <line x1="50%" y1="50%" x2="80%" y2="20%" stroke="url(#lineGradientMobile)" strokeWidth="1.5" strokeDasharray="4,4" className="animate-pulse" style={{ animationDelay: '0.3s' }}/>
                <line x1="50%" y1="50%" x2="20%" y2="80%" stroke="url(#lineGradientMobile)" strokeWidth="1.5" strokeDasharray="4,4" className="animate-pulse" style={{ animationDelay: '0.6s' }}/>
                <line x1="50%" y1="50%" x2="80%" y2="80%" stroke="url(#lineGradientMobile)" strokeWidth="1.5" strokeDasharray="4,4" className="animate-pulse" style={{ animationDelay: '0.9s' }}/>
              </svg>

              {/* Floating Particles - Mobile */}
              <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping"></div>
              <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
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
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);

export default HomePage;