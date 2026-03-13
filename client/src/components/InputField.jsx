import React from "react";

const InputField = ({ label, type = "text", placeholder, value, onChange, error, icon }) => {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-sm font-medium uppercase tracking-wider">
                {label}
            </label>

            <div className="relative">
                {
                    icon && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                            {icon}
                        </span>
                    )
                }

                <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-600 
                        focus:outline-none focus:border-pink-500/50 transition-all
                        ${icon ? "pl-10" : ""}
                        ${error ? "border-red-500/50" : "border-white/10"}
                        `}
                />
            </div>
            {
                error && (
                    <span className="text-red-400 text-xs">
                        {error}
                    </span>
                )
            }
        </div>
    );
}

export default InputField;