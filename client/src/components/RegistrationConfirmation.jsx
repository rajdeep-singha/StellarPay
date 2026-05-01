import React from "react";
import Card from "./Cards";
import Button from "./Button";

const RegistrationConfirmation = ({ employeeData, onContinue, transactionHash }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6">
      <Card className="w-full max-w-md mx-auto">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">Registration Successful!</h2>
          <p className="text-gray-400">Your employee profile has been created</p>
        </div>

        <div className="w-full h-px bg-white/10 mb-8" />

        {/* Employee Details */}
        <div className="space-y-4 mb-8">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500 text-sm">Employee ID</span>
              <span className="text-white font-mono text-sm">#{employeeData?.empId || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500 text-sm">Monthly Salary</span>
              <span className="text-white font-mono text-sm">{employeeData?.salary || 0} XLM</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500 text-sm">Email</span>
              <span className="text-white text-sm">{employeeData?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Wallet</span>
              <span className="text-white font-mono text-xs">
                {employeeData?.walletAddress ? 
                  `${employeeData.walletAddress.slice(0, 6)}...${employeeData.walletAddress.slice(-4)}` : 
                  'N/A'
                }
              </span>
            </div>
          </div>

          {transactionHash && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-blue-400 text-xs mb-1">Transaction Hash</p>
              <p className="text-gray-300 font-mono text-xs break-all">
                {transactionHash}
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
          <p className="text-amber-400 text-sm">
            ⚡ You can now request early wage advances! A 1.25% fee applies to each withdrawal.
          </p>
        </div>

        {/* Action Button */}
        <Button onClick={onContinue} className="w-full">
          Continue to Dashboard ✦
        </Button>
      </Card>
    </div>
  );
};

export default RegistrationConfirmation;
