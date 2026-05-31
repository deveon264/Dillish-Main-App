import React from "react";
import { ArrowRight } from "lucide-react";
import "./_group.css";

export function EditorialImmersive() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto bg-[#2C2422] overflow-hidden">
      <link rel="stylesheet" media="all" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" />
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Woman stretching in a bright studio" 
          className="w-full h-full object-cover animate-fade-in"
        />
        {/* Dark Scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2422]/10 via-[#2C2422]/40 to-[#2C2422] pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full min-h-screen p-6 justify-between">
        
        {/* Top: Logo */}
        <div className="pt-8 opacity-0 animate-fade-in-up delay-100">
          <h1 className="font-serif text-[#F7EBE8] text-4xl tracking-wide leading-none">
            Florish
          </h1>
          <p className="font-serif italic text-[#C9897A] text-xl mt-[-4px]">
            by dillish
          </p>
        </div>

        {/* Bottom: Copy & Actions */}
        <div className="flex flex-col mt-auto pb-6">
          {/* Kicker */}
          <p className="font-sans text-[#F2D4CC] text-xs font-semibold tracking-[0.25em] uppercase mb-4 opacity-0 animate-fade-in-up delay-200">
            Wellness, Reimagined
          </p>

          {/* Headline */}
          <h2 className="font-serif text-[#F7EBE8] text-[3.25rem] leading-[1.05] tracking-tight mb-5 opacity-0 animate-fade-in-up delay-300">
            Bloom into <br />
            <span className="italic text-[#C9897A]">your best self</span>
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-[#9B6E6A] text-[15px] leading-relaxed mb-8 max-w-[280px] opacity-0 animate-fade-in-up delay-400">
            Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
          </p>

          {/* Benefits - Inline labels */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-10 opacity-0 animate-fade-in-up delay-500">
            <span className="font-sans text-[#F7EBE8]/80 text-[11px] tracking-wider uppercase flex items-center">
              <span className="w-1 h-1 rounded-full bg-[#C9897A] mr-2" />
              AI Tracking
            </span>
            <span className="font-sans text-[#F7EBE8]/80 text-[11px] tracking-wider uppercase flex items-center">
              <span className="w-1 h-1 rounded-full bg-[#C9897A] mr-2" />
              Guided Workouts
            </span>
            <span className="font-sans text-[#F7EBE8]/80 text-[11px] tracking-wider uppercase flex items-center">
              <span className="w-1 h-1 rounded-full bg-[#C9897A] mr-2" />
              Made for you
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-5 opacity-0 animate-fade-in-up delay-600">
            <button className="group relative w-full h-[60px] bg-[#C9897A] rounded-full overflow-hidden flex items-center justify-center transition-transform hover:scale-[0.98] active:scale-95">
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="font-sans font-medium text-[#2C2422] text-[15px] flex items-center gap-2">
                Begin Your Journey
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
            
            <button className="font-sans text-[#9B6E6A] text-[14px] flex items-center justify-center gap-1 transition-colors hover:text-[#F7EBE8]">
              Already have an account? <span className="text-[#C9897A] font-medium ml-1">Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
