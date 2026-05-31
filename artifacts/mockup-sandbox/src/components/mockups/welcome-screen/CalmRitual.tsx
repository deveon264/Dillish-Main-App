import React, { useEffect } from 'react';

const fontsUrl = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap";

export function CalmRitual() {
  useEffect(() => {
    if (!document.querySelector(`link[href="${fontsUrl}"]`)) {
      const link = document.createElement('link');
      link.href = fontsUrl;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  const benefits = ["AI Tracking", "Guided Workouts", "Made for you"];

  return (
    <div className="min-h-screen w-full bg-[#F7EBE8] flex flex-col items-center justify-center p-6 relative overflow-hidden font-['DM_Sans',sans-serif]">
      {/* Subtle background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 bg-[#F2D4CC] rounded-full blur-[100px] opacity-70 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-white rounded-full blur-[90px] opacity-90 pointer-events-none"></div>

      {/* Wordmark (Top) */}
      <div className="absolute top-12 flex flex-col items-center z-10">
        <h1 className="font-['Cormorant_Garamond',serif] text-[34px] text-[#2C2422] tracking-wide leading-none">Florish</h1>
        <span className="text-[9px] text-[#9B6E6A] tracking-[0.2em] uppercase mt-1 opacity-80">by dillish</span>
      </div>

      {/* Floating Card */}
      <div className="w-full max-w-[342px] bg-white/60 backdrop-blur-2xl rounded-[40px] p-8 shadow-[0_8px_32px_rgba(44,36,34,0.03)] flex flex-col items-center z-10 border border-white/60 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">

        {/* Arched/Pill Image */}
        <div className="w-32 h-44 rounded-full overflow-hidden mb-8 shadow-sm border-4 border-white/40">
          <img
            src="/__mockup/images/welcomehero.png"
            alt="Woman stretching in a serene studio"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Copy */}
        <h2 className="font-['Cormorant_Garamond',serif] text-[38px] text-[#2C2422] text-center leading-[1.05] mb-4">
          Your daily ritual<br/><span className="italic text-[#C9897A]">of gentleness</span>
        </h2>
        <p className="text-[#9B6E6A] text-center text-[15px] leading-relaxed mb-8 px-1">
          Nourish your body and mind in one serene, guided space designed for you.
        </p>

        {/* Benefits Chips */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-10">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-[#F2D4CC]/30 px-4 py-1.5 rounded-full border border-[#F2D4CC]/60 shadow-[0_2px_8px_rgba(242,212,204,0.2)]">
              <span className="text-[#2C2422] text-[11px] font-medium tracking-wide uppercase">{benefit}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button className="w-full bg-[#C9897A] text-[#F7EBE8] py-4 rounded-full font-medium text-[15px] shadow-[0_4px_16px_rgba(201,137,122,0.3)] active:scale-[0.98] transition-transform">
            Begin Your Journey
          </button>
          <button className="w-full py-2 group">
            <span className="text-[#9B6E6A] text-[13px]">
              Already have an account? <span className="font-semibold text-[#C9897A] group-hover:underline underline-offset-4">Sign in</span>
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
