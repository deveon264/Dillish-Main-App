import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, Dumbbell, Heart } from "lucide-react";

export function GuidedOnboarding() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const benefits = [
    {
      title: "AI Tracking",
      description: "Intelligent monitoring of your form and progress.",
      icon: <Sparkles className="w-5 h-5 text-[#F2D4CC]" />
    },
    {
      title: "Guided Workouts",
      description: "Expert-led sessions tailored to your goals and level.",
      icon: <Dumbbell className="w-5 h-5 text-[#F2D4CC]" />
    },
    {
      title: "Made for you",
      description: "Personalized wellness plans that adapt to your body.",
      icon: <Heart className="w-5 h-5 text-[#F2D4CC]" />
    }
  ];

  return (
    <div className="min-h-screen bg-[#2C2422] text-[#F7EBE8] flex flex-col font-sans relative overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
          .font-serif { font-family: 'Cormorant Garamond', serif; }
          .font-sans { font-family: 'DM Sans', sans-serif; }
        `
      }} />

      {/* Header */}
      <header className="pt-12 px-6 pb-6 z-10 flex flex-col items-center">
        <div className="flex flex-col items-center">
          <h1 className="font-serif text-4xl text-[#F2D4CC] tracking-wide mb-1">Florish</h1>
          <span className="text-[#9B6E6A] text-[10px] uppercase tracking-widest font-semibold">by dillish</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-6 z-10">
        <div className={`transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="font-serif text-4xl leading-tight text-white mb-3">
            Your journey<br />begins here.
          </h2>
          <p className="text-[#9B6E6A] text-base mb-10 max-w-[280px]">
            Follow our proven, step-by-step approach to mindful movement and lasting wellness.
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-6">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className={`flex items-start gap-4 p-5 rounded-2xl bg-[#1e1614] border border-[#C9897A]/20 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${(index + 2) * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-full bg-[#C9897A]/10 flex items-center justify-center shrink-0 border border-[#C9897A]/20">
                {benefit.icon}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-[#F2D4CC] font-medium text-lg mb-1">{benefit.title}</h3>
                <p className="text-[#9B6E6A] text-sm leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Actions */}
      <footer className={`px-6 pb-10 pt-6 z-10 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button className="w-full bg-[#C9897A] hover:bg-[#b07466] text-white py-4 px-6 rounded-full font-medium text-base mb-4 transition-colors flex items-center justify-center group">
          Begin Your Journey
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <button className="w-full py-3 text-center group">
          <span className="text-[#9B6E6A] text-sm">Already have an account? </span>
          <span className="text-[#F2D4CC] text-sm font-medium group-hover:underline">Sign in</span>
        </button>
      </footer>
    </div>
  );
}
