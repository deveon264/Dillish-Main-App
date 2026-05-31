import React from "react";
import { ArrowRight } from "lucide-react";
import "./_group.css";

export function ElevatedEditorial() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto bg-[#2C2422] overflow-hidden">
      <link rel="stylesheet" media="all" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" />
      
      {/* Background Image */}
      <div className="absolute inset-0 z-0 h-[65%]">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Woman stretching in a bright studio" 
          className="w-full h-full object-cover wrf-animate-fade-in"
        />
        {/* Scrim transition to panel */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2422]/10 via-[#2C2422]/40 to-[#2C2422] pointer-events-none" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col h-full min-h-screen justify-between pt-12">
        
        {/* Top: Logo */}
        <div className="px-6 opacity-0 wrf-animate-fade-in-up wrf-delay-100">
          <h1 className="font-serif text-[#F7EBE8] text-[2.75rem] tracking-wide leading-none">
            Florish
          </h1>
          <p className="font-sans font-semibold tracking-[0.15em] text-[#C9897A] text-[9px] mt-1 ml-1 uppercase">
            By Dillish
          </p>
        </div>

        {/* Bottom Panel */}
        <div className="flex flex-col mt-auto pb-8 pt-10 px-6 bg-gradient-to-t from-[#2C2422] via-[#2C2422] to-[#2C2422]/90 backdrop-blur-md rounded-t-[32px] border-t border-white/5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          {/* Kicker */}
          <p className="font-sans text-[#F2D4CC] text-[11px] font-semibold tracking-[0.25em] uppercase mb-4 opacity-0 wrf-animate-fade-in-up wrf-delay-200">
            Wellness, Reimagined
          </p>

          {/* Headline */}
          <h2 className="font-serif text-[#F7EBE8] text-[3.25rem] leading-[1.05] tracking-tight mb-5 opacity-0 wrf-animate-fade-in-up wrf-delay-300">
            Bloom into <br />
            <span className="italic text-[#C9897A]">your best self</span>
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-[#9B6E6A] text-[15px] leading-relaxed mb-8 max-w-[300px] opacity-0 wrf-animate-fade-in-up wrf-delay-400">
            Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
          </p>

          {/* Trust Row - Refined with subtle dividers */}
          <div className="flex items-center justify-between mb-10 opacity-0 wrf-animate-fade-in-up wrf-delay-500 py-3 border-y border-white/[0.04]">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9897A]" />
              <span className="font-sans text-[#F7EBE8]/80 text-[10px] tracking-wider uppercase text-center">AI Tracking</span>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F2D4CC]" />
              <span className="font-sans text-[#F7EBE8]/80 text-[10px] tracking-wider uppercase text-center">Guided Workouts</span>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9B6E6A]" />
              <span className="font-sans text-[#F7EBE8]/80 text-[10px] tracking-wider uppercase text-center">Made for you</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-5 opacity-0 wrf-animate-fade-in-up wrf-delay-600">
            <button className="group relative w-full h-[60px] bg-[#F7EBE8] text-[#2C2422] rounded-full overflow-hidden flex items-center justify-center transition-transform hover:scale-[0.98] active:scale-95 shadow-[0_4px_14px_rgba(247,235,232,0.15)]">
              <span className="font-sans font-medium text-[15px] flex items-center gap-2">
                Begin Your Journey
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
