import React from "react";
import { ArrowRight, Sparkles, Dumbbell, Heart } from "lucide-react";
import "./_group.css";

export function GoldenHour() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto overflow-hidden bg-[#2C2422]">
      <link rel="stylesheet" media="all" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" />
      
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Welcome" 
          className="w-full h-full object-cover animate-in fade-in duration-1000"
        />
        {/* Golden Hour Warm Overlays */}
        {/* Adds a peach/amber warmth via mix-blend-multiply */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F2D4CC]/40 via-[#C9897A]/30 to-transparent mix-blend-multiply pointer-events-none" />
        {/* Bottom vignette for text legibility and enveloping coziness */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C2422] via-[#2C2422]/80 to-transparent pointer-events-none" />
        {/* Soft top-down sun-kissed glow */}
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-[#F2D4CC]/20 to-transparent pointer-events-none mix-blend-overlay" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full min-h-screen px-6 pt-12 pb-8 justify-between">
        
        {/* TOP: Logo */}
        <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 fill-mode-both">
          <h1 className="font-serif text-[#F7EBE8] text-[2.75rem] tracking-wide leading-none">
            Florish
          </h1>
          <p className="font-serif italic text-[#C9897A] text-lg mt-0">
            by dillish
          </p>
        </div>

        {/* CENTER: Main Copy & Trust Row */}
        <div className="flex flex-col mt-auto pb-8">
          {/* Kicker */}
          <p className="font-sans text-[#F2D4CC] text-[11px] font-semibold tracking-[0.25em] uppercase mb-4 opacity-90 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
            Wellness, Reimagined
          </p>

          {/* Headline */}
          <h2 className="font-serif text-[#F7EBE8] text-[3rem] leading-[1.1] tracking-tight mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500 fill-mode-both">
            Bloom into <br />
            <span className="italic text-[#F2D4CC]">your best self</span>
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-[#F7EBE8]/80 text-[15px] leading-[1.6] mb-8 max-w-[290px] font-light animate-in fade-in slide-in-from-bottom-2 duration-700 delay-700 fill-mode-both">
            Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
          </p>

          {/* Trust Row */}
          <div className="flex flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-[900ms] fill-mode-both">
            <div className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 rounded-[14px] bg-[#C9897A]/20 flex items-center justify-center backdrop-blur-sm border border-[#F2D4CC]/10">
                <Sparkles className="w-5 h-5 text-[#F2D4CC]" strokeWidth={1.5} />
              </div>
              <span className="font-sans text-[#F7EBE8] text-xs font-medium">AI Tracking</span>
            </div>
            
            <div className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 rounded-[14px] bg-[#C9897A]/20 flex items-center justify-center backdrop-blur-sm border border-[#F2D4CC]/10">
                <Dumbbell className="w-5 h-5 text-[#F2D4CC]" strokeWidth={1.5} />
              </div>
              <span className="font-sans text-[#F7EBE8] text-xs font-medium">Guided Workouts</span>
            </div>
            
            <div className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 rounded-[14px] bg-[#C9897A]/20 flex items-center justify-center backdrop-blur-sm border border-[#F2D4CC]/10">
                <Heart className="w-5 h-5 text-[#F2D4CC]" strokeWidth={1.5} />
              </div>
              <span className="font-sans text-[#F7EBE8] text-xs font-medium">Made for you</span>
            </div>
          </div>
        </div>

        {/* BOTTOM: Actions */}
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-[1100ms] fill-mode-both">
          <button className="relative w-full h-[56px] bg-[#C9897A] rounded-full overflow-hidden flex items-center justify-center transition-all hover:bg-[#b57a6c] active:scale-[0.98] group">
            <span className="font-sans font-medium text-[#2C2422] text-[16px] flex items-center gap-2 relative z-10">
              Begin Your Journey
              <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-1 transition-transform" strokeWidth={2} />
            </span>
          </button>
          
          <button className="font-sans text-[#F7EBE8]/70 text-[14px] flex items-center justify-center gap-1 transition-colors hover:text-[#F7EBE8]">
            Already have an account? <span className="text-[#F2D4CC] font-medium ml-1">Sign in</span>
          </button>
        </div>

      </div>
    </div>
  );
}
