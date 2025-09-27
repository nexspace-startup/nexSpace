const DaySeparator: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex items-center justify-center py-4" >
        <div className="flex items-center w-full max-w-xs" >
            <div className="flex-1 h-px bg-[rgba(128,136,155,0.3)]" > </div>
            < span className="px-3 text-xs font-medium text-[#80889B] whitespace-nowrap" >
                {label}
            </span>
            < div className="flex-1 h-px bg-[rgba(128,136,155,0.3)]" > </div>
        </div>
    </div>
);

export default DaySeparator;