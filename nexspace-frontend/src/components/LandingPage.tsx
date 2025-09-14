import { useNavigate } from "react-router-dom";

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <main className="min-h-screen w-full bg-[#202024] text-white font-manrope flex items-center justify-center px-5">
            <section className="w-full max-w-[480px] flex flex-col items-center py-14 sm:py-0">
                {/* Logo */}
                <div className="relative mb-8 sm:mb-[50px]" aria-hidden="true">
                    <div className="rounded-full bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4] w-16 h-16 sm:w-20 sm:h-20" />
                </div>

                {/* Equal-gap stack: Heading&Subheading, Button, Footer message */}
                <div className="w-full flex flex-col items-center gap-[50px]">
                    {/* Heading & Subheading (internal gap stays 8px) */}
                    <div className="w-full flex flex-col items-center gap-2">
                        <h1 className="text-center font-bold tracking-[-0.01em] leading-[1.5] text-2xl sm:text-[32px]">
                            Welcome to NexSpace
                        </h1>
                        <p className="text-center leading-[1.5] text-base sm:text-[20px]">
                            Virtual coworking & accountability for connected, productive teams.
                        </p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={() => navigate("/signin")}
                        className="w-full sm:w-[220px] lg:w-[220px] xl:w-[240px] 2xl:w-[260px] inline-flex items-center justify-center h-12 sm:h-14 px-4 sm:px-5 gap-2 rounded-xl bg-[#4285F4] shadow-[0px_4px_30px_rgba(142,166,246,0.2)] text-white text-base sm:text-[18px] font-semibold transition-colors duration-200 hover:bg-[#4b90ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202024] focus-visible:ring-[#8ea6f6]"
                    >
                        Join
                    </button>

                    {/* Footer message */}
                    <p className="w-full text-center leading-[1.5] text-sm sm:text-[20px]">
                        We’re building something exciting. <br></br> Stay tuned! 😉
                    </p>
                </div>
            </section>
        </main >
    );
}
