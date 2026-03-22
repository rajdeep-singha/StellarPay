import React, { useState, useEffect } from "react";

const PayCycleProgress = ({ lastWithdrawalDate }) => {
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [progress, setProgress] = useState(0);

  const cycleLength = 15;

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
    
      let nextPayday;

      if (now.getDate() > 15) {
        nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
      else {
        nextPayday = new Date(now.getFullYear(), now.getMonth(), 15);
      }

      const timeDiff = nextPayday - now;
      const daysRemaining = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining({
        days: Math.max(0, daysRemaining),
        hours: Math.max(0, hoursRemaining),
        minutes: Math.max(0, minutesRemaining),
      });

      const elapsedDays = cycleLength - daysRemaining;
      const progressPercentage = Math.min((elapsedDays / cycleLength) * 100, 100);
      setProgress(progressPercentage);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [lastWithdrawalDate]);

  const isPayday = timeRemaining.days === 0 && timeRemaining.hours === 0;

  return (
    <div className="h-full rounded-2xl bg-[#111] border border-white/[0.08] p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-lg">📅</span>
        </div>
        <h2 className="text-lg font-semibold text-white">Pay Cycle</h2>
      </div>

      {isPayday ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">🎉</span>
          <h3 className="text-xl font-bold text-pink-400">It's Payday!</h3>
          <p className="text-gray-500 mt-2">Your salary has been deposited</p>
        </div>
      ) : (
        <>
          {/* Countdown */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <TimeUnit value={timeRemaining.days} label="Days" />
            <TimeUnit value={timeRemaining.hours} label="Hours" />
            <TimeUnit value={timeRemaining.minutes} label="Mins" />
          </div>

          {/* Circular Progress */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="url(#pinkGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="pinkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {Math.round(progress)}%
                </span>
                <span className="text-gray-600 text-xs">Complete</span>
              </div>
            </div>
          </div>

          {/* Next Payday Info */}
          <div className="mt-6 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Next Payday</span>
              <span className="text-gray-300 text-sm font-medium">
                {timeRemaining.days} day{timeRemaining.days !== 1 ? "s" : ""} remaining
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TimeUnit = ({ value, label }) => (
  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-center">
    <span className="text-xl font-bold text-white">{String(value).padStart(2, "0")}</span>
    <span className="block text-gray-600 text-xs mt-1">{label}</span>
  </div>
);

export default PayCycleProgress;
