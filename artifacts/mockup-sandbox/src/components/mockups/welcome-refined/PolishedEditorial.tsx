import React from "react";
import { ArrowRight, Sparkles, Dumbbell, Heart } from "lucide-react";
import "./_group.css";

const TRUST = [
  { icon: Sparkles, label: "AI Tracking" },
  { icon: Dumbbell, label: "Guided Workouts" },
  { icon: Heart, label: "Made for you" },
];

export function PolishedEditorial() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto bg-[#2C2422] overflow-hidden">
      <link rel="stylesheet" media="all" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" />
      
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Woman stretching in a bright studio" 
          className="w-full h-full object-cover wrf-animate-fade-in"
        />
        {/* Refined Dark Scrim - smoother ramp for perfect legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2422]/10 via-[#2C2422]/60 to-[#2C2422] pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full min-h-[100dvh] px-6 py-10 justify-between">
        
        {/* Top: Logo */}
        <div className="opacity-0 wrf-animate-fade-in-up wrf-delay-100 mt-4">
          <h1 className="font-serif text-[#F7EBE8] text-[40px] tracking-wide leading-none">
            Florish
          </h1>
          <span className="inline-flex items-center mt-2 ml-1 px-3 py-1 rounded-full bg-[#F7EBE8]/[0.08] border border-[#F2D4CC]/20 backdrop-blur-sm">
            <span className="font-serif italic text-[#C9897A] text-[15px] leading-none">
              by dillish
            </span>
          </span>
        </div>

        {/* Bottom: Copy & Actions */}
        <div className="flex flex-col mt-auto pt-16">
          {/* Kicker */}
          <p className="font-sans text-[#F2D4CC] text-[11px] font-semibold tracking-[0.25em] uppercase mb-4 opacity-0 wrf-animate-fade-in-up wrf-delay-200">
            Wellness, Reimagined
          </p>

          {/* Headline */}
          <h2 className="font-serif text-[#F7EBE8] text-[52px] leading-[1.05] tracking-tight mb-5 opacity-0 wrf-animate-fade-in-up wrf-delay-300">
            Bloom into <br />
            <span className="italic text-[#C9897A] pr-2">your best self</span>
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-[#9B6E6A] text-[16px] leading-[1.6] mb-10 max-w-[300px] opacity-0 wrf-animate-fade-in-up wrf-delay-400">
            Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
          </p>

          {/* Benefits - Refined Trust Row */}
          <div className="flex flex-row items-start justify-between mb-12 opacity-0 wrf-animate-fade-in-up wrf-delay-500 gap-2">
            {TRUST.map((t, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-[#F7EBE8]/[0.06] border border-[#F7EBE8]/[0.08] flex items-center justify-center backdrop-blur-sm shadow-sm">
                  <t.icon className="w-[20px] h-[20px] text-[#F2D4CC]" strokeWidth={1.5} />
                </div>
                <span className="font-sans text-[#9B6E6A] text-[12px] font-medium text-center leading-tight">
                  {t.label}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-6 opacity-0 wrf-animate-fade-in-up wrf-delay-600 mb-2">
            <button className="group relative w-full h-[56px] bg-[#C9897A] rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 hover:bg-[#b57a6c] hover:scale-[0.99] active:scale-[0.97] shadow-lg shadow-[#C9897A]/20">
              <span className="font-sans font-medium text-[#2C2422] text-[16px] flex items-center gap-2">
                Begin Your Journey
                <ArrowRight className="w-[18px] h-[18px] transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
              </span>
            </button>
            
            <button className="font-sans text-[#9B6E6A] text-[14px] flex items-center justify-center gap-1.5 transition-colors hover:text-[#F7EBE8]">
              Already have an account? <span className="text-[#C9897A] font-semibold">Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
