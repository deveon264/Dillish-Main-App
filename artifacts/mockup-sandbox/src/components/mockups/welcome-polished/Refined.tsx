import React from "react";
import { Flower2, Sparkles, Dumbbell, Heart, ArrowRight } from "lucide-react";
import "./_group.css";

const TRUST = [
  { icon: Sparkles, label: "AI Tracking", cls: "wp-pulse" },
  { icon: Dumbbell, label: "Guided Workouts", cls: "wp-pulse-2" },
  { icon: Heart, label: "Made for you", cls: "wp-pulse-3" },
];

export function Refined() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
        rel="stylesheet"
      />
      <div className="wp-sans relative min-h-screen w-full overflow-hidden bg-[#F7F0EA] text-[#4A2E33]">
        {/* Hero photo */}
        <img
          src="/__mockup/images/welcomehero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Cream scrim fading the photo into the background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(247,240,234,0.45) 0%, rgba(247,240,234,0.80) 48%, #F7F0EA 90%)",
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col px-7 pb-9 pt-14">
          {/* Logo lockup */}
          <div className="wp-fade wp-d1">
            <div className="flex items-center">
              <div
                className="flex h-[52px] w-[52px] items-center justify-center"
                style={{
                  borderRadius: 17,
                  background: "linear-gradient(135deg, #DCA3AB 0%, #C57B86 100%)",
                  boxShadow: "0 6px 16px rgba(197,123,134,0.32)",
                }}
              >
                <Flower2 className="h-[26px] w-[26px] text-white" strokeWidth={1.75} />
              </div>
              <span
                className="wp-serif ml-3 leading-none"
                style={{ fontSize: 44, fontWeight: 600, letterSpacing: 0.5 }}
              >
                Florish
              </span>
            </div>
            <div
              className="mt-1 inline-flex"
              style={{ marginLeft: 52 + 12 }}
            >
              <span
                className="wp-sans uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.6,
                  fontWeight: 600,
                  color: "#C57B86",
                  background: "rgba(197,123,134,0.10)",
                  border: "1px solid rgba(197,123,134,0.28)",
                  borderRadius: 999,
                  padding: "3px 9px",
                }}
              >
                by dillish
              </span>
            </div>
          </div>

          {/* Headline block — anchored toward the lower third */}
          <div className="mt-auto">
            <h1
              className="wp-serif wp-fade wp-d2"
              style={{ fontSize: 46, lineHeight: "50px", fontWeight: 500 }}
            >
              Bloom into
              <br />
              your <span className="wp-serif italic" style={{ color: "#C57B86" }}>best self</span>
            </h1>
            <p
              className="wp-fade wp-d3 mt-3 max-w-[300px]"
              style={{ fontSize: 16, lineHeight: "24px", color: "rgba(74,46,51,0.55)" }}
            >
              A beautiful space for women to feel stronger, calmer and more confident.
            </p>

            {/* Trust row with hairline dividers */}
            <div
              className="wp-fade wp-d4 mt-7 flex items-stretch overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(197,123,134,0.20)",
                borderRadius: 20,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              {TRUST.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.label}
                    className="flex flex-1 flex-col items-center gap-2 py-4"
                    style={{
                      borderLeft: i === 0 ? "none" : "1px solid rgba(197,123,134,0.16)",
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center"
                      style={{ borderRadius: 12, background: "rgba(197,123,134,0.12)" }}
                    >
                      <Icon className={`h-[18px] w-[18px] ${t.cls}`} style={{ color: "#C57B86" }} strokeWidth={1.9} />
                    </div>
                    <span
                      className="text-center"
                      style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(74,46,51,0.6)" }}
                    >
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="wp-fade wp-d5 mt-7">
              <button
                className="flex w-full items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, #DCA3AB 0%, #C57B86 100%)",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "17px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  boxShadow: "0 12px 28px rgba(197,123,134,0.38)",
                }}
              >
                Begin Your Journey
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
              <div className="mt-4 flex justify-center">
                <button
                  style={{
                    fontSize: 14,
                    color: "rgba(74,46,51,0.55)",
                    background: "rgba(197,123,134,0.08)",
                    border: "1px solid rgba(197,123,134,0.20)",
                    borderRadius: 999,
                    padding: "11px 22px",
                  }}
                >
                  Already have an account?{" "}
                  <span style={{ color: "#C57B86", fontWeight: 600 }}>Sign in</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
