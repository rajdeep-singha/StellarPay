import React from "react";

const Card = ({ children, className = "" }) => {
    return (
        <div className={`rounded-2xl bg-[#111] border border-white/[0.08] p-8 ${className}`}>
            {children}
        </div>
    );
}

export default Card;