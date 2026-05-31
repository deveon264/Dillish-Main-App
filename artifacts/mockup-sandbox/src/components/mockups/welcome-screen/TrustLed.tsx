import React from "react";
import { Star, CheckCircle2 } from "lucide-react";
import "./_group.css";

export function TrustLed() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      <div className="min-h-screen bg-[#2C2422] text-[#F7EBE8] font-sans flex flex-col relative overflow-hidden">
      {/* Background Hero Image - Secondary, with heavy gradient fade */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] opacity-40 mix-blend-luminosity">
        <img 
          src="/__mockup/images/welcomehero.png" 
          alt="Yoga stretch" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2C2422]/80 to-[#2C2422]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-12 pb-8">
        {/* Header */}
        <div className="flex flex-col items-center animate-fade-in-up delay-100">
          <h1 className="font-serif text-4xl text-[#C9897A] tracking-wider">Florish</h1>
          <p className="text-[10px] tracking-[0.2em] text-[#F2D4CC] uppercase mt-1">by dillish</p>
        </div>

        {/* Social Proof Intro */}
        <div className="mt-auto pt-16 flex flex-col animate-fade-in-up delay-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex -space-x-3">
              <img src="/__mockup/images/avatar1.png" className="w-8 h-8 rounded-full border-2 border-[#2C2422] object-cover" alt="Member" />
              <img src="/__mockup/images/avatar2.png" className="w-8 h-8 rounded-full border-2 border-[#2C2422] object-cover" alt="Member" />
              <img src="/__mockup/images/avatar3.png" className="w-8 h-8 rounded-full border-2 border-[#2C2422] object-cover" alt="Member" />
            </div>
            <div className="flex flex-col">
              <div className="flex text-[#C9897A]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <span className="text-xs text-[#9B6E6A] mt-0.5">12,000+ women joined</span>
            </div>
          </div>

          <h2 className="font-serif text-4xl leading-tight mb-3 text-[#F7EBE8]">
            The proven path <br/>
            <span className="text-[#F2D4CC] italic">to your best self</span>
          </h2>
          <p className="text-[#9B6E6A] text-sm leading-relaxed mb-8 max-w-[280px]">
            Join a community committed to mindful movement and nourishing habits.
          </p>

          {/* Testimonial */}
          <div className="bg-[#1e1614]/80 backdrop-blur-md rounded-2xl p-4 mb-8 border border-[#C9897A]/20">
            <p className="text-[#F7EBE8] text-sm italic leading-relaxed mb-3">
              "I've never felt more understood by an app. The guided workouts feel like they're reading my mind. A true game-changer."
            </p>
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-[#C9897A] flex items-center justify-center text-[10px] font-bold text-[#2C2422]">
                S
              </div>
              <span className="text-xs text-[#9B6E6A]">Sarah M. — Member since 2023</span>
            </div>
          </div>

          {/* Benefits as Trust Signals */}
          <div className="space-y-4 mb-10">
            {[
              { title: "AI Tracking", desc: "Clinically-backed insights that adapt to you." },
              { title: "Guided Workouts", desc: "Created by certified women's wellness experts." },
              { title: "Made for you", desc: "A personalized journey, proven by our community." }
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-[#C9897A] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[#F7EBE8] text-sm font-semibold">{benefit.title}</h3>
                  <p className="text-[#9B6E6A] text-xs mt-1">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-auto space-y-4">
            <button className="w-full bg-[#C9897A] hover:bg-[#F2D4CC] text-[#2C2422] transition-colors rounded-full py-4 text-base font-semibold tracking-wide shadow-[0_0_20px_rgba(201,137,122,0.3)]">
              Begin Your Journey
            </button>
            <button className="w-full py-2 text-sm text-[#9B6E6A] hover:text-[#F7EBE8] transition-colors">
              Already have an account? <span className="text-[#F2D4CC] font-medium border-b border-[#F2D4CC]/30 pb-0.5">Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
