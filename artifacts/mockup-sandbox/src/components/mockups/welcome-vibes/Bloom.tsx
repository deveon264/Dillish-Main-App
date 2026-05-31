import React from "react";
import { ArrowRight, Sparkles, Activity, Heart } from "lucide-react";
import "./_group.css";

export function Bloom() {
  return (
    <div className="relative flex flex-col min-h-screen w-full max-w-[390px] mx-auto bg-[#2C2422] overflow-hidden selection:bg-[#C9897A] selection:text-white">
      <link rel="stylesheet" media="all" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" />
      
      {/* Background with Vibrant Color Wash */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Woman stretching in a bright studio" 
          className="w-full h-full object-cover animate-fade-in"
        />
        {/* Soft Duotone / Color Wash - mix-blend-mode for vibrancy */}
        <div className="absolute inset-0 bg-[#C9897A] mix-blend-overlay opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#C9897A]/20 via-[#2C2422]/60 to-[#2C2422] pointer-events-none" />
      </div>

      {/* Content Column */}
      <div className="relative z-10 flex flex-col h-full min-h-screen p-6 justify-between">
        
        {/* TOP: Logo & Tagline */}
        <div className="pt-8 opacity-0 animate-slide-up">
          <h1 className="font-serif text-[#F7EBE8] text-5xl tracking-normal font-semibold leading-none drop-shadow-md">
            Florish
          </h1>
          <p className="font-serif italic text-[#F2D4CC] text-xl mt-[-2px] ml-1 drop-shadow-sm">
            by dillish
          </p>
        </div>

        {/* CENTER: Typography & Trust Row */}
        <div className="flex flex-col mt-auto pb-8">
          {/* Kicker */}
          <div className="inline-flex opacity-0 animate-slide-up delay-100 mb-5">
            <span className="bg-[#C9897A] text-[#2C2422] font-sans text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full">
              Wellness, Reimagined
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-serif text-[#F7EBE8] text-[3.75rem] leading-[0.95] tracking-tight mb-5 opacity-0 animate-slide-up delay-200">
            Bloom into <br />
            <span className="italic text-[#F2D4CC] font-semibold pr-2">your best self</span>
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-[#F7EBE8]/90 text-[16px] leading-relaxed mb-8 max-w-[280px] font-medium opacity-0 animate-slide-up delay-300">
            Mindful movement, nourishing habits, and gentle guidance all in one beautiful space.
          </p>

          {/* Trust Row - Filled Accent Chips */}
          <div className="flex flex-wrap items-center gap-3 mb-10 opacity-0 animate-pop-in delay-400">
            <div className="flex items-center bg-[#F2D4CC] rounded-xl px-3.5 py-2 shadow-lg shadow-black/20">
              <Sparkles className="w-4 h-4 text-[#C9897A] mr-2" />
              <span className="font-sans text-[#2C2422] text-[12px] font-bold tracking-wide">AI Tracking</span>
            </div>
            <div className="flex items-center bg-[#F2D4CC] rounded-xl px-3.5 py-2 shadow-lg shadow-black/20">
              <Activity className="w-4 h-4 text-[#C9897A] mr-2" />
              <span className="font-sans text-[#2C2422] text-[12px] font-bold tracking-wide">Guided Workouts</span>
            </div>
            <div className="flex items-center bg-[#F2D4CC] rounded-xl px-3.5 py-2 shadow-lg shadow-black/20">
              <Heart className="w-4 h-4 text-[#C9897A] mr-2" />
              <span className="font-sans text-[#2C2422] text-[12px] font-bold tracking-wide">Made for you</span>
            </div>
          </div>

          {/* BOTTOM: Actions */}
          <div className="flex flex-col gap-5 opacity-0 animate-slide-up delay-500">
            <button className="relative w-full h-[64px] bg-[#C9897A] rounded-2xl overflow-hidden flex items-center justify-center transition-transform hover:scale-[0.98] active:scale-95 shadow-xl shadow-[#C9897A]/20">
              <span className="font-sans font-bold tracking-wide text-[#F7EBE8] text-[16px] flex items-center gap-2 z-10">
                Begin Your Journey
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </span>
            </button>
            
            <button className="font-sans text-[#F7EBE8]/70 text-[15px] flex items-center justify-center gap-1.5 transition-colors hover:text-[#F7EBE8] font-medium">
              Already have an account? <span className="text-[#F2D4CC] font-bold underline decoration-[#C9897A]/50 underline-offset-4">Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
