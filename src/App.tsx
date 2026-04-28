import { useState, useEffect, useRef } from "react";

// ============================================================
// DESIGN SYSTEM
// ============================================================
const DS = {
  colors: {
    bg: "#FFFFFF",
    accent: "#7C5CFC",
    accentLight: "#EDE9FF",
    accentDark: "#5B3FD4",
    text: "#0A0A0A",
    textMuted: "#6B6B6B",
    textFaint: "#A0A0A0",
    surface: "#F7F7F7",
    border: "#EBEBEB",
    white: "#FFFFFF",
    success: "#1A9E6E",
    danger: "#D94F3D",
  },
  font: "'Plus Jakarta Sans', -apple-system, sans-serif",
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 3px rgba(0,0,0,0.06)",
    md: "0 4px 16px rgba(0,0,0,0.08)",
    lg: "0 8px 32px rgba(0,0,0,0.12)",
  },
};

const seasonGradients: Record<string, string> = {
  Spring: "linear-gradient(135deg, #FFF1E6 0%, #FFE0CC 50%, #FECBA1 100%)",
  Summer: "linear-gradient(135deg, #EEF2FF 0%, #DDE6FF 50%, #C7D7FF 100%)",
  Autumn: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)",
  Winter: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 50%, #BAE6FD 100%)",
};

const seasonAccents: Record<string, string> = {
  Spring: "#E8845A",
  Summer: "#6B7FD4",
  Autumn: "#C26B3A",
  Winter: "#4A90C4",
};

// ============================================================
// TYPES
// ============================================================
type Screen = "splash" | "onboarding" | "auth" | "upload" | "analysing" | "main";
type Tab = "home" | "checker" | "wardrobe" | "me";
type Sheet = "palette" | "makeup" | "hair" | "jewellery" | "style" | "paywall" | null;
type Plan = "free" | "glow" | "luxe";

interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
}

interface PaletteColour {
  name: string;
  hex: string;
}

interface SeasonData {
  season: string;
  subseason: string;
  confidence: number;
  headline: string;
  palette: {
    best: PaletteColour[];
    avoid: PaletteColour[];
  };
  makeup: {
    foundation: string;
    blush: string;
    lip: string;
    eye: string;
  };
  hair: {
    best_colours: string[];
    avoid: string[];
    tip: string;
  };
  jewellery: {
    metals: string[];
    stones: string[];
    tip: string;
  };
  style: {
    silhouettes: string;
    patterns: string;
    fabrics: string;
    tip: string;
  };
  body_shape: string;
  daily_tip: string;
}

interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  colour_name: string;
  hex: string;
  verdict: boolean;
  tip: string;
  created_at: string;
}

interface AppState {
  screen: Screen;
  activeTab: Tab;
  activeSheet: Sheet;
  user: User | null;
  isGuest: boolean;
  seasonData: SeasonData | null;
  wardrobeItems: WardrobeItem[];
  checkerMode: "single" | "swatch";
  onboardingIndex: number;
}

// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = "https://hnbpasabtwafnlxzlppr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e14xp3bV8O2Wu-gdC6HiUQ_gRYU5rbp";

const supabaseHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

// ============================================================
// GLOBAL STYLES
// ============================================================
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root {
  height: 100%;
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
      background: ${DS.colors.bg};
      font-family: ${DS.font};
      color: ${DS.colors.text};
      -webkit-font-smoothing: antialiased;
    }
    button { cursor: pointer; border: none; background: none; font-family: inherit; }
    input { font-family: inherit; }
    ::-webkit-scrollbar { width: 0px; }
    .screen {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .fade-in {
      animation: fadeIn 0.4s ease forwards;
    }
    .slide-up {
      animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `}</style>
);

// ============================================================
// SVG ICONS
// ============================================================
const Icon = ({ name, size = 24, color = "currentColor", strokeWidth = 1.5 }: {
  name: string; size?: number; color?: string; strokeWidth?: number;
}) => {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/><path d="M3 12v9h18V12"/></>,
    sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/></>,
    hanger: <><path d="M12 3a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V8l7 5H4l7-5V6.73A2 2 0 0 1 10 5a2 2 0 0 1 2-2z"/><path d="M3 21h18"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    chevronLeft: <><polyline points="15 18 9 12 15 6"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    gift: <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    palette: <><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1.5" fill="currentColor"/><circle cx="14" cy="8" r="1.5" fill="currentColor"/><circle cx="17" cy="13" r="1.5" fill="currentColor"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/></>,
    droplet: <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
    scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></>,
    gem: <><polygon points="6 3 18 3 22 9 12 22 2 9"/><polyline points="2 9 12 14 22 9"/><line x1="12" y1="22" x2="12" y2="14"/><line x1="6" y1="3" x2="2" y2="9"/><line x1="18" y1="3" x2="22" y2="9"/></>,
    shirt: <><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></>,
    crown: <><path d="M2 20h20"/><path d="M4 20l2-12 6 6 4-8 4 8 6-6-2 12"/></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};

// ============================================================
// SPLASH SCREEN
// ============================================================
const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 2800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="screen" style={{
      background: DS.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @keyframes logoReveal {
          0% { opacity: 0; transform: scale(0.85) translateY(12px); }
          60% { opacity: 1; transform: scale(1.02) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes taglineReveal {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotsReveal {
          0% { opacity: 0; }
          100% { opacity: 0.5; }
        }
        .logo-anim { animation: logoReveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both; }
        .tag-anim { animation: taglineReveal 0.6s ease 1.0s both; }
        .dots-anim { animation: dotsReveal 0.5s ease 1.4s both; }
      `}</style>

      <div style={{ textAlign: "center" }}>
        <div className="logo-anim">
          <div style={{
            width: 88,
            height: 88,
            borderRadius: DS.radius.xl,
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(255,255,255,0.3)",
          }}>
            <Icon name="sparkles" size={40} color={DS.colors.white} strokeWidth={1.5} />
          </div>
          <div style={{
            fontSize: 42,
            fontWeight: 700,
            color: DS.colors.white,
            letterSpacing: "-1px",
          }}>
            Chroma
          </div>
        </div>

        <div className="tag-anim" style={{
          marginTop: 12,
          fontSize: 15,
          color: "rgba(255,255,255,0.75)",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}>
          Your colour season, revealed
        </div>

        <div className="dots-anim" style={{
          marginTop: 48,
          display: "flex",
          gap: 6,
          justifyContent: "center",
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5,
              height: 5,
              borderRadius: DS.radius.full,
              background: DS.colors.white,
              animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ONBOARDING SCREEN
// ============================================================
const slides = [
  {
    icon: "camera",
    title: "Take a selfie",
    body: "One clear photo in natural light is all we need. No filters, no sunglasses.",
    bg: "#EDE9FF",
    accent: DS.colors.accent,
  },
  {
    icon: "palette",
    title: "Discover your season",
    body: "Our AI analyses your skin tone, undertone, eye and hair colour to find your perfect palette.",
    bg: "#E8F4FD",
    accent: "#4A90C4",
  },
  {
    icon: "sparkles",
    title: "Get your full guide",
    body: "Colours, makeup, hair, jewellery and style — everything personalised to you — so you always look your best.",
    bg: "#FFF1E6",
    accent: "#E8845A",
  },
  {
    icon: "shirt",
    title: "Check any item",
    body: "Check a single item, a full outfit, or hold swatches against your skin — Chroma reads every colour and tells you what works..",
    bg: "#E8F5EE",
    accent: "#1A9E6E",
  },
];

const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  const goTo = (next: number) => {
    setDir(next > idx ? 1 : -1);
    setIdx(next);
  };

  const slide = slides[idx];

  return (
    <div className="screen" style={{ background: DS.colors.bg, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        .slide-right { animation: slideInRight 0.35s ease both; }
        .slide-left { animation: slideInLeft 0.35s ease both; }
      `}</style>

      {/* SLIDE CONTENT — fixed height, never grows */}
      <div
        key={idx}
        className={dir > 0 ? "slide-right" : "slide-left"}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 28px",
          minHeight: 0,
        }}
      >
        <div style={{
          width: 88,
          height: 88,
          borderRadius: DS.radius.xl,
          background: slide.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          flexShrink: 0,
        }}>
          <Icon name={slide.icon} size={36} color={slide.accent} strokeWidth={1.5} />
        </div>

        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          color: DS.colors.text,
          textAlign: "center",
          letterSpacing: "-0.5px",
          marginBottom: 12,
          flexShrink: 0,
        }}>
          {slide.title}
        </h1>

        <p style={{
          fontSize: 15,
          color: DS.colors.textMuted,
          textAlign: "center",
          lineHeight: 1.6,
          maxWidth: 280,
          flexShrink: 0,
        }}>
          {slide.body}
        </p>
      </div>

      {/* DOTS — fixed */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        paddingBottom: 16,
        flexShrink: 0,
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === idx ? 24 : 6,
              height: 6,
              borderRadius: DS.radius.full,
              background: i === idx ? DS.colors.accent : DS.colors.border,
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* BUTTONS — always pinned to bottom */}
      <div style={{
        padding: "0 28px calc(48px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flexShrink: 0,
      }}>
        {idx < slides.length - 1 ? (
          <>
            <button
              onClick={() => goTo(idx + 1)}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: DS.radius.lg,
                background: DS.colors.accent,
                color: DS.colors.white,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Continue
            </button>
            <button
              onClick={onComplete}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 14,
                color: DS.colors.textMuted,
                fontWeight: 500,
              }}
            >
              Skip
            </button>
          </>
        ) : (
          <button
            onClick={onComplete}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: DS.radius.lg,
              background: DS.colors.accent,
              color: DS.colors.white,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Get started
          </button>
        )}
      </div>
    </div>
  );
};
// ============================================================
// AUTH SCREEN
// ============================================================
const AuthScreen = ({
  onSignIn,
  onGuest,
}: {
  onSignIn: (user: User) => void;
  onGuest: () => void;
}) => {
  const [mode, setMode] = useState<"landing" | "signin" | "signup">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: DS.radius.md,
    border: `1.5px solid ${DS.colors.border}`,
    fontSize: 15,
    color: DS.colors.text,
    background: DS.colors.bg,
    outline: "none",
    transition: "border-color 0.2s",
  };

  const handleAuth = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "signup"
        ? `${SUPABASE_URL}/auth/v1/signup`
        : `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

      const body = mode === "signup"
        ? { email, password, data: { name } }
        : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...supabaseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error || data.error_description || data.msg) {
        throw new Error(data.error_description || data.msg || data.error || "Auth failed");
      }

      const userId = data.user?.id;
      const userEmail = data.user?.email || email;
      const userName = data.user?.user_metadata?.name || name || email.split("@")[0];

      let plan: Plan = "free";
      if (userId) {
        try {
          const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=user_plan`, {
            headers: { ...supabaseHeaders, Authorization: `Bearer ${data.access_token}` },
          });
          const profiles = await profileRes.json();
          if (profiles?.[0]?.user_plan) plan = profiles[0].user_plan as Plan;
        } catch {}
      }

      localStorage.setItem("chroma_token", data.access_token);
      localStorage.setItem("chroma_refresh", data.refresh_token || "");

      onSignIn({ id: userId, email: userEmail, name: userName, plan });
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "landing") {
    return (
      <div className="screen fade-in" style={{ background: DS.colors.bg }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: DS.radius.lg,
            background: DS.colors.accentLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}>
            <Icon name="sparkles" size={32} color={DS.colors.accent} />
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 700, color: DS.colors.text, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>
            Welcome to Chroma
          </h1>
          <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 48 }}>
            Create an account to save your results and unlock your full colour guide.
          </p>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setMode("signup")}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: DS.radius.lg,
                background: DS.colors.accent,
                color: DS.colors.white,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "-0.2px",
              }}
            >
              Create account
            </button>
            <button
              onClick={() => setMode("signin")}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: DS.radius.lg,
                background: DS.colors.bg,
                color: DS.colors.text,
                fontSize: 15,
                fontWeight: 500,
                border: `1.5px solid ${DS.colors.border}`,
              }}
            >
              Sign in
            </button>
            <button
              onClick={onGuest}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: 14,
                color: DS.colors.textMuted,
                fontWeight: 500,
              }}
            >
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg }}>
      <div style={{ padding: "40px 28px 0", display: "flex", flexDirection: "column", gap: 0 }}>
        <button onClick={() => { setMode("landing"); setError(""); }} style={{ alignSelf: "flex-start", marginBottom: 32, color: DS.colors.textMuted }}>
          <Icon name="chevronLeft" size={20} color={DS.colors.textMuted} />
        </button>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>
          {mode === "signup" ? "Create account" : "Welcome back"}
        </h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32 }}>
          {mode === "signup" ? "Start your colour journey today" : "Sign in to your Chroma account"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input
              style={inputStyle}
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          )}
          <input
            style={inputStyle}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {error && (
            <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm }}>
              {error}
            </p>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: DS.radius.lg,
              background: loading ? DS.colors.textFaint : DS.colors.accent,
              color: DS.colors.white,
              fontSize: 16,
              fontWeight: 600,
              marginTop: 8,
              transition: "background 0.2s",
            }}
          >
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>

        <button
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
          style={{ marginTop: 20, fontSize: 14, color: DS.colors.accent, fontWeight: 500, alignSelf: "center" }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New to Chroma? Create account"}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// UPLOAD SCREEN
// ============================================================
const UploadScreen = ({ onUpload }: { onUpload: (file: File) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleAnalyse = () => {
    const file = fileRef.current?.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg }}>
      <div style={{ padding: "40px 28px 0", flex: 1, display: "flex", flexDirection: "column" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>
          Take your selfie
        </h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
          Use natural light, face the camera directly, and remove sunglasses.
        </p>

        <div
          onClick={() => !preview && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          style={{
            flex: 1,
            borderRadius: DS.radius.xl,
            border: `2px dashed ${isDragging ? DS.colors.accent : DS.colors.border}`,
            background: isDragging ? DS.colors.accentLight : DS.colors.surface,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: preview ? "default" : "pointer",
            transition: "all 0.2s",
            overflow: "hidden",
            position: "relative",
            marginBottom: 24,
            maxHeight: 400,
          }}
        >
          {preview ? (
            <>
              <img src={preview} alt="selfie preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 32,
                  height: 32,
                  borderRadius: DS.radius.full,
                  background: "rgba(0,0,0,0.5)",
                  color: DS.colors.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="x" size={16} color={DS.colors.white} />
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: DS.radius.lg,
                background: DS.colors.accentLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}>
                <Icon name="camera" size={28} color={DS.colors.accent} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: DS.colors.text, marginBottom: 4 }}>
                Upload your selfie
              </p>
              <p style={{ fontSize: 13, color: DS.colors.textMuted }}>Tap to take or choose a photo</p>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleChange}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
          {preview ? (
            <button
              onClick={handleAnalyse}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: DS.radius.lg,
                background: DS.colors.accent,
                color: DS.colors.white,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "-0.2px",
              }}
            >
              Analyse my colours
            </button>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: DS.radius.lg,
                background: DS.colors.accent,
                color: DS.colors.white,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Choose photo
            </button>
          )}

          <div style={{ display: "flex", gap: 16, padding: "12px 0" }}>
            {["Natural light", "No filters", "Face forward"].map(tip => (
              <div key={tip} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: DS.radius.full, background: DS.colors.success }} />
                <span style={{ fontSize: 11, color: DS.colors.textMuted, textAlign: "center", fontWeight: 500 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ANALYSING SCREEN
// ============================================================
const AnalysingScreen = () => {
  const steps = ["Reading your features", "Mapping your palette", "Building your guide"];
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 1, 90));
    }, 120);

    const stepTimeout1 = setTimeout(() => setStep(1), 3000);
    const stepTimeout2 = setTimeout(() => setStep(2), 6000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout1);
      clearTimeout(stepTimeout2);
    };
  }, []);

  return (
    <div className="screen fade-in" style={{
      background: DS.colors.bg,
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 28px",
    }}>
      <div style={{ width: 72, height: 72, marginBottom: 32, position: "relative" }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke={DS.colors.border} strokeWidth="4" />
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke={DS.colors.accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 30}`}
            strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
            transform="rotate(-90 36 36)"
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Icon name="sparkles" size={28} color={DS.colors.accent} />
        </div>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8, textAlign: "center" }}>
        Analysing your colours
      </h2>

      <p style={{ fontSize: 15, color: DS.colors.accent, fontWeight: 500, marginBottom: 40, transition: "all 0.4s" }}>
        {steps[step]}...
      </p>

      <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: DS.radius.full,
              background: i <= step ? DS.colors.accent : DS.colors.surface,
              border: `1.5px solid ${i <= step ? DS.colors.accent : DS.colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.3s",
            }}>
              {i < step && <Icon name="check" size={12} color={DS.colors.white} strokeWidth={2.5} />}
              {i === step && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: DS.radius.full,
                  background: DS.colors.white,
                  animation: "pulse 1s ease infinite",
                }} />
              )}
            </div>
            <span style={{
              fontSize: 14,
              color: i <= step ? DS.colors.text : DS.colors.textFaint,
              fontWeight: i === step ? 500 : 400,
              transition: "all 0.3s",
            }}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// BOTTOM NAV
// ============================================================
const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "sparkles", label: "Season" },
  { id: "checker", icon: "image", label: "Checker" },
  { id: "wardrobe", icon: "hanger", label: "Wardrobe" },
  { id: "me", icon: "user", label: "Me" },
];

const BottomNav = ({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) => (
  <div style={{
    height: 80,
    borderTop: `1px solid ${DS.colors.border}`,
    background: DS.colors.bg,
    display: "flex",
    paddingBottom: 16,
  }}>
    {tabs.map(tab => {
      const active = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            transition: "opacity 0.15s",
          }}
        >
          <Icon
            name={tab.icon}
            size={22}
            color={active ? DS.colors.accent : DS.colors.textFaint}
            strokeWidth={active ? 2 : 1.5}
          />
          <span style={{
            fontSize: 10,
            fontWeight: active ? 600 : 400,
            color: active ? DS.colors.accent : DS.colors.textFaint,
            letterSpacing: "0.02em",
          }}>
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);

// ============================================================
// PLACEHOLDER TAB CONTENT
// ============================================================
const PlaceholderTab = ({ tab }: { tab: Tab }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: DS.colors.textMuted }}>
    <Icon name={tabs.find(t => t.id === tab)?.icon || "sparkles"} size={40} color={DS.colors.border} />
    <p style={{ fontSize: 15, fontWeight: 500 }}>{tab.charAt(0).toUpperCase() + tab.slice(1)} — coming in Phase {tab === "home" ? 3 : tab === "checker" ? 5 : tab === "wardrobe" ? 6 : 6}</p>
    <p style={{ fontSize: 13, color: DS.colors.textFaint }}>Foundation deployed</p>
  </div>
);

// ============================================================
// MAIN APP (shell)
// ============================================================
const MainApp = ({
  activeTab,
  onTabChange,
  seasonData,
  user,
  isGuest,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  seasonData: SeasonData | null;
  user: User | null;
  isGuest: boolean;
}) => (
  <div className="screen fade-in" style={{ background: DS.colors.bg }}>
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <PlaceholderTab tab={activeTab} />
    </div>
    <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
  </div>
);

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [state, setState] = useState<AppState>({
    screen: "splash",
    activeTab: "home",
    activeSheet: null,
    user: null,
    isGuest: false,
    seasonData: null,
    wardrobeItems: [],
    checkerMode: "single",
    onboardingIndex: 0,
  });

  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));

  // Session restore
useEffect(() => {
  const token = localStorage.getItem("chroma_token");
  const cachedSeason = localStorage.getItem("chroma_season");
  if (token && cachedSeason) {
    fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.id) {
          update({
            screen: "main",
            user: {
              id: data.id,
              email: data.email,
              name: data.user_metadata?.name || data.email.split("@")[0],
              plan: "free",
            },
            seasonData: JSON.parse(cachedSeason),
          });
        }
      })
      .catch(() => {});
  }
}, []);

  // Convert image file to base64
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
    });

  const handleUpload = async (file: File) => {
    update({ screen: "analysing" });
    try {
      const base64 = await toBase64(file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smooth-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ type: "analyse", image: base64 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      update({ seasonData: data, screen: "main" });
    } catch (e) {
      // Fall back to main anyway for now — handle gracefully in Phase 3
      update({ screen: "main" });
    }
  };

  const { screen, activeTab, user, isGuest, seasonData } = state;

  return (
    <>
      <GlobalStyles />
      <div style={{ position: "relative", width: "100vw", height: "100vh", maxWidth: 430, margin: "0 auto", overflow: "hidden" }}>
        {screen === "splash" && (
          <SplashScreen onComplete={() => update({ screen: "onboarding" })} />
        )}
        {screen === "onboarding" && (
          <OnboardingScreen onComplete={() => update({ screen: "auth" })} />
        )}
        {screen === "auth" && (
          <AuthScreen
            onSignIn={user => update({ user, screen: "upload" })}
            onGuest={() => update({ isGuest: true, screen: "upload" })}
          />
        )}
        {screen === "upload" && (
          <UploadScreen onUpload={handleUpload} />
        )}
        {screen === "analysing" && (
          <AnalysingScreen />
        )}
        {screen === "main" && (
          <MainApp
            activeTab={activeTab}
            onTabChange={tab => update({ activeTab: tab })}
            seasonData={seasonData}
            user={user}
            isGuest={isGuest}
          />
        )}
      </div>
    </>
  );
}