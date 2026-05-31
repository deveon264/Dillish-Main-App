import React from "react";
import { ArrowRight, Sparkles, Dumbbell, Heart } from "lucide-react";

export function Whisper() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto bg-[#2C2422] overflow-hidden">
      <link 
        rel="stylesheet" 
        media="all" 
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" 
      />
      
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Welcome background" 
          className="w-full h-full object-cover opacity-80"
        />
        {/* Lighter, softer scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2422]/10 via-[#2C2422]/30 to-[#2C2422]/95 pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full min-h-screen px-6 pt-12 pb-10 justify-between">
        
        {/* Top: Logo */}
        <div className="animate-in fade-in duration-1000">
          <h1 className="font-['Cormorant_Garamond'] text-[#F7EBE8] text-[2.25rem] font-light tracking-[0.02em] leading-none">
            Florish
          </h1>
          <p className="font-['Cormorant_Garamond'] italic text-[#9B6E6A] text-xl mt-1">
            by dillish
          </p>
        </div>

        {/* Bottom: Copy & Actions */}
        <div className="flex flex-col mt-auto">
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
            {/* Kicker */}
            <p className="font-['DM_Sans'] text-[#9B6E6A] text-[9px] font-light tracking-[0.35em] uppercase mb-5">
              Wellness, Reimagined
            </p>

            {/* Headline */}
            <h2 className="font-['Cormorant_Garamond'] text-[#F7EBE8] text-[3rem] leading-[1.05] tracking-tight mb-5">
              Bloom into <br />
              <span className="italic text-[#F7EBE8] font-light">your best self</span>
            </h2>

            {/* Subtitle */}
            <p className="font-['DM_Sans'] text-[#9B6E6A] text-[13px] font-light leading-[1.7] mb-10 max-w-[280px]">
              Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
            </p>

            {/* Benefits - Quiet labels */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-10 pt-6 border-t border-[#9B6E6A]/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-[#C9897A]" strokeWidth={1} />
                <span className="font-['DM_Sans'] text-[#9B6E6A] text-[9px] font-light tracking-[0.2em] uppercase">
                  AI Tracking
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-3 h-3 text-[#C9897A]" strokeWidth={1} />
                <span className="font-['DM_Sans'] text-[#9B6E6A] text-[9px] font-light tracking-[0.2em] uppercase">
                  Guided Workouts
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-3 h-3 text-[#C9897A]" strokeWidth={1} />
                <span className="font-['DM_Sans'] text-[#9B6E6A] text-[9px] font-light tracking-[0.2em] uppercase">
                  Made for you
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
            <button className="group relative w-full h-[56px] border border-[#9B6E6A]/40 flex items-center justify-center gap-3 transition-colors hover:border-[#F7EBE8]/60 hover:bg-[#F7EBE8]/5">
              <span className="font-['DM_Sans'] font-light text-[#F7EBE8] text-[10px] tracking-[0.25em] uppercase">
                Begin Your Journey
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C9897A] group-hover:text-[#F7EBE8] transition-colors" strokeWidth={1} />
            </button>
            
            <button className="font-['DM_Sans'] text-[#9B6E6A] text-[11px] font-light tracking-[0.05em] flex items-center justify-center transition-colors hover:text-[#F7EBE8]">
              Already have an account? <span className="text-[#F7EBE8] font-normal ml-1.5">Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
