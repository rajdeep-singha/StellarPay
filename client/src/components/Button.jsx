import React from "react";

const Button = ({ children, onClick, isLoading, disabled, variant = "primary" }) => {
    const variants = {
        primary: "bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90",
        secondary: "border border-white/10 text-gray-400 hover:bg-white/5",
    };

    return (<>
        <button
            onClick={onClick}
            disabled={isLoading || disabled}
            className={`w-full py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]}`}
        >
            {
                isLoading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                    </>
                ) : (
                    children
                )
            }
        </button>
    </>);
}

export default Button;