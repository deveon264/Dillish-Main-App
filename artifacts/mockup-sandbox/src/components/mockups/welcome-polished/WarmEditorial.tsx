import React from "react";
import { Flower2, Sparkles, Dumbbell, Heart, ArrowRight } from "lucide-react";
import "./_group.css";

const TRUST = [
  { icon: Sparkles, label: "AI Tracking" },
  { icon: Dumbbell, label: "Guided Workouts" },
  { icon: Heart, label: "Made for you" },
];

export function WarmEditorial() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
        rel="stylesheet"
      />
      <div className="wp-sans relative min-h-screen w-full overflow-hidden bg-[var(--cream)] text-[var(--ink)]">
        {/* Hero photo — slightly stronger presence than the base screen */}
        <img
          src="/__mockup/images/welcomehero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(247,240,234,0.32) 0%, rgba(247,240,234,0.74) 50%, var(--cream) 90%)",
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col px-7 pb-9 pt-14">
          {/* Logo lockup — left anchored, matching the app */}
          <div className="wp-fade wp-d1">
            <div className="flex items-center">
              <div
                className="flex h-[52px] w-[52px] items-center justify-center"
                style={{
                  borderRadius: 17,
                  background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent) 100%)",
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
            <div className="mt-1 inline-flex" style={{ marginLeft: 52 + 12 }}>
              <span
                className="wp-sans uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.6,
                  fontWeight: 600,
                  color: "var(--accent)",
                  background: "var(--accent-tint)",
                  border: "1px solid var(--accent-border-md)",
                  borderRadius: 999,
                  padding: "3px 9px",
                }}
              >
                by dillish
              </span>
            </div>
          </div>

          {/* Lower-third content block — left aligned */}
          <div className="mt-auto">
            {/* Subtle integrated social proof */}
            <div className="wp-fade wp-d2 mb-5 flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {["avatar1", "avatar2", "avatar3"].map((a) => (
                  <img
                    key={a}
                    src={`/__mockup/images/${a}.png`}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                    style={{ border: "2px solid var(--cream)" }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Loved by{" "}
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>12,000+ women</span>
              </span>
            </div>

            <h1
              className="wp-serif wp-fade wp-d2"
              style={{ fontSize: 48, lineHeight: "52px", fontWeight: 500 }}
            >
              Bloom into
              <br />
              your <span className="wp-serif italic" style={{ color: "var(--accent)" }}>best self</span>
            </h1>
            <p
              className="wp-fade wp-d3 mt-3 max-w-[300px]"
              style={{ fontSize: 16, lineHeight: "24px", color: "var(--muted)" }}
            >
              A beautiful space for women to feel stronger, calmer and more confident.
            </p>

            {/* Trust row — lighter inline treatment (no card), distinct from Refined */}
            <div className="wp-fade wp-d4 mt-7 flex items-center justify-between">
              {TRUST.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.label} className="flex flex-col items-center gap-2">
                    <div
                      className="flex h-[42px] w-[42px] items-center justify-center"
                      style={{
                        borderRadius: 14,
                        background: "var(--accent-tint-md)",
                        border: "1px solid var(--accent-border-soft)",
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: "var(--accent)" }} strokeWidth={1.9} />
                    </div>
                    <span
                      className="text-center"
                      style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(74,46,51,0.62)" }}
                    >
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Actions — same stack rhythm as the app */}
            <div className="wp-fade wp-d5 mt-8">
              <button
                className="flex w-full items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent) 100%)",
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
              <button
                className="mt-4 w-full text-center"
                style={{ fontSize: 14, color: "var(--muted)" }}
              >
                Already have an account?{" "}
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: 600,
                    borderBottom: "1px solid rgba(197,123,134,0.4)",
                    paddingBottom: 1,
                  }}
                >
                  Sign in
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
