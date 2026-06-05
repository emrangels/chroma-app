import { useState, useEffect, useRef } from "react";
import { removeBackground } from "@imgly/background-removal";
import html2canvas from 'html2canvas';
import { Analytics } from '@vercel/analytics/react';

const DS = {
  colors: {
    bg: "#FFFFFF", accent: "#7C5CFC", accentLight: "#EDE9FF", accentDark: "#5B3FD4",
    text: "#0A0A0A", textMuted: "#6B6B6B", textFaint: "#A0A0A0", surface: "#F7F7F7",
    border: "#EBEBEB", white: "#FFFFFF", success: "#1A9E6E", danger: "#D94F3D",
  },
  font: "'Plus Jakarta Sans', -apple-system, sans-serif",
  radius: { sm: "8px", md: "12px", lg: "16px", xl: "24px", full: "9999px" },
  shadow: { sm: "0 1px 3px rgba(0,0,0,0.06)", md: "0 4px 16px rgba(0,0,0,0.08)", lg: "0 8px 32px rgba(0,0,0,0.12)" },
};

type Screen = "splash" | "onboarding" | "auth" | "upload" | "analysing" | "lifestyle-onboarding" | "main";
type Tab = "home" | "checker" | "wardrobe" | "me";
type Sheet = "palette" | "makeup" | "hair" | "jewellery" | "style" | "paywall" | "faq" | "privacy" | "terms" | "cookies" | "welcome" | "preview" | null;
type Plan = "free" | "glow" | "luxe";

interface User { id: string; email: string; name: string; plan: Plan; }
interface PaletteColour { name: string; hex: string; }
interface SeasonData {
  season: string; subseason: string; confidence: number; headline: string;
  colour_profile: {
    undertone: string; depth: string; chroma: string; contrast: string;
    defining_quality: string; season_description: string;
  };
  palette: {
    base: PaletteColour[]; accent: PaletteColour[];
    best: PaletteColour[]; avoid: PaletteColour[];
    extended?: PaletteColour[];
  };
  makeup: { foundation: string; blush: { advice: string; colours: { name: string; hex: string }[] }; lip: { advice: string; colours: { name: string; hex: string }[] }; eye: { advice: string; colours: { name: string; hex: string }[] }; };
  hair: { best_colours: string[]; avoid: string[]; tip: string; };
  jewellery: { metals: string[]; stones: string[]; tip: string; };
  style: { silhouettes: string; patterns: string; fabrics: string; tip: string; };
  daily_tip: string;
}
interface MakeupItem {
  id: string; user_id: string; name: string; brand?: string; category: string;
  shade_name?: string; hex: string; verdict_v2: "yes" | "neutral" | "no"; verdict: boolean;
  tip?: string; image_url?: string; starred: boolean; created_at: string;
}
interface WardrobeItem {
  id: string; user_id: string; name: string; category: string;
  colour_name: string; hex: string; verdict: boolean; verdict_v2?: "yes" | "neutral" | "no"; tip: string;
  starred: boolean; image_url?: string; price?: number; created_at: string;
  formality?: string;
}
interface Outfit {
  id: string; user_id: string; name: string; item_ids: string[];
  overall_verdict: boolean; starred: boolean; created_at: string; category?: string;
}
interface ChatMessage {
  role: "user" | "assistant"; content: string; message_id?: string; feedback?: "up" | "down";
}
interface AppState {
  screen: Screen; activeTab: Tab; activeSheet: Sheet;
  user: User | null; isGuest: boolean; seasonData: SeasonData | null;
  wardrobeItems: WardrobeItem[]; checkerMode: "single" | "outfit"; onboardingIndex: number;
  tourStep: number | null;
showDay3Prompt: boolean;
}

const SUPABASE_URL = "https://hnbpasabtwafnlxzlppr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e14xp3bV8O2Wu-gdC6HiUQ_gRYU5rbp";
const SUPABASE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnBhc2FidHdhZm5seHpscHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTY5NjcsImV4cCI6MjA5MjU5Mjk2N30.YrBhMxN96k_OFEcWHYZ41up73ZEvEtRZWXwExo8GTxY";
const supabaseHeaders = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; min-height: -webkit-fill-available; overflow: hidden; background: ${DS.colors.bg}; font-family: ${DS.font}; color: ${DS.colors.text}; -webkit-font-smoothing: antialiased; }
    button { cursor: pointer; border: none; background: none; font-family: inherit; }
    input { font-family: inherit; }
    ::-webkit-scrollbar { width: 0px; }a[target="_blank"] { -webkit-touch-callout: none; }
    .screen { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
    .fade-in { animation: fadeIn 0.4s ease forwards; }
    .slide-up { animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  `}</style>
);

const Icon = ({ name, size = 24, color = "currentColor", strokeWidth = 1.5 }: { name: string; size?: number; color?: string; strokeWidth?: number; }) => {
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
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
};

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => { const t = setTimeout(onComplete, 2800); return () => clearTimeout(t); }, [onComplete]);
  return (
    <div className="screen" style={{ background: DS.colors.accent, alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes logoReveal { 0%{opacity:0;transform:scale(0.85) translateY(12px)} 60%{opacity:1;transform:scale(1.02) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes taglineReveal { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dotsReveal { 0%{opacity:0} 100%{opacity:0.5} }
        .logo-anim{animation:logoReveal 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s both}
        .tag-anim{animation:taglineReveal 0.6s ease 1.0s both}
        .dots-anim{animation:dotsReveal 0.5s ease 1.4s both}
      `}</style>
      <div style={{ textAlign: "center" }}>
        <div className="logo-anim">
          <div style={{ width: 88, height: 88, borderRadius: DS.radius.xl, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
            <Icon name="sparkles" size={40} color={DS.colors.white} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, color: DS.colors.white, letterSpacing: "-1px" }}>Solla™</div>
        </div>
        <div className="tag-anim" style={{ marginTop: 12, fontSize: 15, color: "rgba(255,255,255,0.75)", fontWeight: 400, letterSpacing: "0.02em" }}>Never wonder what to wear again</div>
        <div className="dots-anim" style={{ marginTop: 48, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: DS.radius.full, background: DS.colors.white, animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
        </div>
      </div>
    </div>
  );
};

const slides = [
  { icon: "camera", title: "Stop asking what to wear", body: "One selfie is all it takes. Solla analyses your colouring and builds your personal colour profile — ready in under a minute.", bg: "#EDE9FF", accent: DS.colors.accent },
  { icon: "palette", title: "Finally know your colours", body: "Your exact season, your best shades, your makeup guide, your hair colours — all personalised to your specific undertone and colouring.", bg: "#E8F4FD", accent: "#4A90C4" },
  { icon: "sparkles", title: "Wake up knowing what to wear", body: "Add your wardrobe and Solla suggests a season-approved outfit every morning based on your clothes and the weather. No more standing in front of the mirror.", bg: "#FFF1E6", accent: "#E8845A" },
  { icon: "shirt", title: "Check anything, instantly", body: "Shopping online? Unsure about an item? Photograph it and Solla tells you instantly whether it suits your season — before you buy.", bg: "#E8F5EE", accent: "#1A9E6E" },
{ icon: "sparkles", title: "Solla learns you", body: "The more you use Solla and chat with your AI stylist, the better it knows your preferences, lifestyle and style — so every suggestion gets more personal over time.", bg: "#EDE9FF", accent: DS.colors.accent },
];

const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const goTo = (next: number) => { setDir(next > idx ? 1 : -1); setIdx(next); };
  const slide = slides[idx];
  return (
    <div className="screen" style={{ background: DS.colors.bg, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
        .slide-right{animation:slideInRight 0.35s ease both}
        .slide-left{animation:slideInLeft 0.35s ease both}
      `}</style>
      <div key={idx} className={dir > 0 ? "slide-right" : "slide-left"} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", minHeight: 0 }}>
        <div style={{ width: 88, height: 88, borderRadius: DS.radius.xl, background: slide.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, flexShrink: 0 }}>
          <Icon name={slide.icon} size={36} color={slide.accent} strokeWidth={1.5} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: DS.colors.text, textAlign: "center", letterSpacing: "-0.5px", marginBottom: 12, flexShrink: 0 }}>{slide.title}</h1>
        <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 280, flexShrink: 0 }}>{slide.body}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 16, flexShrink: 0 }}>
        {slides.map((_, i) => <button key={i} onClick={() => goTo(i)} style={{ width: i === idx ? 24 : 6, height: 6, borderRadius: DS.radius.full, background: i === idx ? DS.colors.accent : DS.colors.border, transition: "all 0.3s ease" }} />)}
      </div>
      <div style={{ padding: "0 28px calc(140px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
        {idx < slides.length - 1 ? (
          <>
            <button onClick={() => goTo(idx + 1)} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Continue</button>
            <button onClick={onComplete} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Skip</button>
          </>
        ) : (
          <button onClick={onComplete} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Get started</button>
        )}
      </div>
    </div>
  );
};
const LifestyleOnboardingScreen = ({ onComplete, userId, token }: { onComplete: () => void; userId: string; token: string }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = [
    {
      key: "lifestyle",
      title: "What's your lifestyle?",
      subtitle: "This helps us suggest outfits that actually fit your life.",
      options: ["Casual & relaxed", "Smart casual", "Professional", "Mix of everything"],
    },
    {
      key: "dress_code",
      title: "What's your typical dress code?",
      subtitle: "We'll make sure your outfits always hit the right note.",
      options: ["Relaxed / everyday", "Business casual", "Formal", "Active & sporty"],
    },
    {
      key: "occasions",
      title: "What do you mostly dress for?",
      subtitle: "We'll prioritise what matters most to you.",
      options: ["Work", "Everyday life", "Going out", "Special occasions", "All of these"],
    },
    {
      key: "style_personality",
      title: "How would you describe your style?",
      subtitle: "Your personality, your rules.",
      options: ["Classic & timeless", "Trendy & fashion-forward", "Minimal & clean", "Feminine & romantic", "Edgy & bold"],
    },
    {
      key: "style_challenge",
      title: "What's your biggest style challenge?",
      subtitle: "We'll focus on solving this for you.",
      options: ["Not knowing what suits me", "Getting dressed takes too long", "Everything feels boring", "I buy things I never wear", "Dressing for my body"],
    },
  ];
  const q = questions[step];
  const selected = answers[q.key];
  const saveAndContinue = async (value: string) => {
    const updated = { ...answers, [q.key]: value };
    setAnswers(updated);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({
            lifestyle: updated.lifestyle,
            dress_code: updated.dress_code,
            occasions: updated.occasions,
            style_personality: updated.style_personality,
            style_challenge: updated.style_challenge,
          }),
        });
      } catch {}
      onComplete();
    }
  };
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, display: "flex", flexDirection: "column", padding: "0 28px", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 40, paddingBottom: 100 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: DS.radius.full, background: i <= step ? DS.colors.accent : DS.colors.border, transition: "background 0.3s" }} />
          ))}
        </div>
        <div style={{ width: 64, height: 64, borderRadius: DS.radius.xl, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon name="sparkles" size={28} color={DS.colors.accent} strokeWidth={1.5} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: DS.colors.text, letterSpacing: "-0.5px", marginBottom: 8 }}>{q.title}</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 28, lineHeight: 1.6 }}>{q.subtitle}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map(option => (
            <button
              key={option}
              onClick={() => saveAndContinue(option)}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: DS.radius.md, textAlign: "left",
                fontSize: 15, fontWeight: selected === option ? 600 : 400,
                color: selected === option ? DS.colors.white : DS.colors.text,
                background: selected === option ? DS.colors.accent : DS.colors.bg,
                border: `1.5px solid ${selected === option ? DS.colors.accent : DS.colors.border}`,
                transition: "all 0.2s",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", padding: "12px 28px 32px", background: DS.colors.bg }}>
        <button onClick={onComplete} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>
          Skip for now
        </button>
      </div>
    </div>
  );
};
const AuthScreen = ({ onSignIn, onGuest, onOpenTerms }: { onSignIn: (user: User) => void; onGuest: () => void; onOpenTerms: (sheet: Sheet) => void; }) => {
  const [mode, setMode] = useState<"landing" | "signin" | "signup" | "forgot">("landing");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false); const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const inputStyle: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 15, color: DS.colors.text, background: DS.colors.bg, outline: "none", transition: "border-color 0.2s" };
  const generateReferralCode = (u: string) => (u.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6) || "USER") + Math.floor(1000 + Math.random() * 9000);
  const saveProfile = async (userId: string, userName: string, userEmail: string, token: string, refCode: string, enteredCode: string) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, { method: "POST", headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" }, body: JSON.stringify({ id: userId, name: userName, user_plan: "free", referral_code: refCode, referred_by: enteredCode ? enteredCode.toUpperCase() : null, referral_count: 0 }) });
    } catch {}
  };
  const handleAuth = async () => {
    if (mode === "signup" && !agreedToTerms) { setError("Please agree to the Terms & Privacy Policy to continue."); return; }
    setLoading(true); setError("");
    try {
      const endpoint = mode === "signup" ? `${SUPABASE_URL}/auth/v1/signup` : `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
      const body = mode === "signup" ? { email, password, data: { name } } : { email, password };
      const res = await fetch(endpoint, { method: "POST", headers: { ...supabaseHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error || data.error_description || data.msg) throw new Error(data.error_description || data.msg || data.error || "Auth failed");
      const userId = data.user?.id; const userEmail = data.user?.email || email;
      const userName = name || data.user?.user_metadata?.name || email.split("@")[0];
      let plan: Plan = "free";
      if (userId) {
        try {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=user_plan`, { headers: { ...supabaseHeaders, Authorization: `Bearer ${data.access_token}` } });
          const profiles = await pr.json();
          if (profiles?.[0]?.user_plan) plan = profiles[0].user_plan as Plan;
        } catch {}
      }
      if (mode === "signup") {
        // Send welcome email regardless of userId — email is always available
        fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
          body: JSON.stringify({ type: "welcome", email: userEmail, name: userName }),
        }).catch((err) => console.error("Email error:", err));
        if (userId) {
          await saveProfile(userId, userName, userEmail, data.access_token, generateReferralCode(userName), referralCode);
        }
        setError("Check your email to confirm your account. If you don't see it within a few minutes, check your spam folder.");
        setLoading(false);
        return;
      }
      const userObj: User = { id: userId, email: userEmail, name: userName, plan };
      localStorage.setItem("solla_token", data.access_token);
      localStorage.setItem("solla_refresh", data.refresh_token || "");
      localStorage.setItem("solla_user", JSON.stringify(userObj));
      onSignIn(userObj);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };
  if (mode === "forgot") return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, overflowY: "auto" }}>
      <div style={{ padding: "40px 28px 48px", display: "flex", flexDirection: "column", gap: 0 }}>
        <button onClick={() => { setMode("signin"); setError(""); }} style={{ alignSelf: "flex-start", marginBottom: 32, color: DS.colors.textMuted }}><Icon name="chevronLeft" size={20} color={DS.colors.textMuted} /></button>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Reset your password</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32 }}>Enter your email and we'll send you a reset link.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          {error && <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm, marginBottom: 16 }}>{error}</p>}

          <button onClick={async () => {
            setLoading(true); setError("");
            try {
              const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method: "POST", headers: { ...supabaseHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
              const data = await res.json();
              if (data.error) throw new Error(data.error);
              setError("Check your email for a reset link.");
            } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
            finally { setLoading(false); }
          }} disabled={loading || !email.trim()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !email.trim() ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </div>
      </div>
    </div>
  );

if (mode === "landing") return (
    <div className="screen fade-in" style={{ background: DS.colors.bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
        <div style={{ width: 72, height: 72, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Icon name="sparkles" size={32} color={DS.colors.accent} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: DS.colors.text, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>Welcome to Solla</h1>
        <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 4 }}>Join women and men who finally know their colours.</p>
        <p style={{ fontSize: 13, color: DS.colors.textFaint, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 48 }}>Know your colours. Build your wardrobe. Never ask "what do I wear?" again.</p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => setMode("signup")} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Create account</button>
          <button onClick={() => setMode("signin")} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.bg, color: DS.colors.text, fontSize: 15, fontWeight: 500, border: `1.5px solid ${DS.colors.border}` }}>Sign in</button>
          <button onClick={onGuest} style={{ width: "100%", padding: "14px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Continue as guest</button>
        </div>
      </div>
      <p style={{ fontSize: 11, color: DS.colors.textFaint, textAlign: "center", padding: "0 0 24px" }}>© 2026 Solla™. All rights reserved.</p>
    </div>
  );
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, overflowY: "auto" }}>
      <div style={{ padding: "40px 28px 48px", display: "flex", flexDirection: "column", gap: 0 }}>
        <button onClick={() => { setMode("landing"); setError(""); }} style={{ alignSelf: "flex-start", marginBottom: 32, color: DS.colors.textMuted }}><Icon name="chevronLeft" size={20} color={DS.colors.textMuted} /></button>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>{mode === "signup" ? "Create account" : "Welcome back"}</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32 }}>{mode === "signup" ? "Start your colour journey today" : "Sign in to your Solla account"}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && <input style={inputStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />}
          <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          {mode === "signup" && (
            <>
              <button onClick={() => setShowReferral(!showReferral)} style={{ alignSelf: "flex-start", fontSize: 13, color: DS.colors.accent, fontWeight: 500, padding: "4px 0", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name={showReferral ? "chevronDown" : "chevronRight"} size={14} color={DS.colors.accent} />Have a referral code?
              </button>
              {showReferral && <input style={inputStyle} placeholder="Enter referral code" value={referralCode} maxLength={10} onChange={e => setReferralCode(e.target.value.toUpperCase())} />}
              <button onClick={() => setAgreedToTerms(!agreedToTerms)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "4px 0", textAlign: "left" }}>
                <div style={{ width: 20, height: 20, borderRadius: DS.radius.sm, border: `1.5px solid ${agreedToTerms ? DS.colors.accent : DS.colors.border}`, background: agreedToTerms ? DS.colors.accent : DS.colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s" }}>
                  {agreedToTerms && <Icon name="check" size={12} color={DS.colors.white} strokeWidth={2.5} />}
                </div>
                <span style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>I agree to the <span onClick={e => { e.stopPropagation(); onOpenTerms("terms"); }} style={{ color: DS.colors.accent, textDecoration: "underline" }}>Terms of Service</span> and <span onClick={e => { e.stopPropagation(); onOpenTerms("privacy"); }} style={{ color: DS.colors.accent, textDecoration: "underline" }}>Privacy Policy</span></span>
              </button>
            </>
          )}
          {error && <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm }}>{error}</p>}
          <button onClick={handleAuth} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: loading ? DS.colors.textFaint : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginTop: 8 }}>
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>
       <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} style={{ marginTop: 20, fontSize: 14, color: DS.colors.accent, fontWeight: 500, alignSelf: "center" }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New to Solla? Create account"}
        </button>
        {mode === "signin" && (
          <button onClick={() => { setMode("forgot"); setError(""); }} style={{ marginTop: 8, fontSize: 13, color: DS.colors.textMuted, fontWeight: 500, alignSelf: "center" }}>
            Forgot your password?
          </button>
        )}
      </div>
    </div>
  );
};



const UploadScreen = ({ onUpload }: { onUpload: (file: File) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handleFile = (file: File) => setPreview(URL.createObjectURL(file));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };
  const handleAnalyse = () => { const f = fileRef.current?.files?.[0]; if (f) onUpload(f); };
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
      <div className="screen fade-in" style={{ background: DS.colors.bg, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "40px 28px 120px", display: "flex", flexDirection: "column" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Take your selfie</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 24, lineHeight: 1.6 }}>One photo is all it takes. Your personal colour profile and daily outfit engine — ready in under a minute.</p>

        {/* Photo upload */}
        <div onClick={() => !preview && fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          style={{ borderRadius: DS.radius.xl, border: `2px dashed ${isDragging ? DS.colors.accent : DS.colors.border}`, background: isDragging ? DS.colors.accentLight : DS.colors.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: preview ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 24, height: 280 }}>
          {preview ? (
            <>
              <img src={preview} alt="selfie preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: DS.radius.full, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="x" size={16} color={DS.colors.white} />
              </button>
            </>
          ) : (
            <>
              <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon name="camera" size={28} color={DS.colors.accent} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: DS.colors.text, marginBottom: 4 }}>Upload your selfie</p>
              <p style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.8 }}>Tap to take or choose a photo.<br/>Android users: open your camera app first,<br/>take a photo, then choose from gallery.</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleChange} style={{ display: "none" }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={handleChange} style={{ display: "none" }} />

        {/* Tips */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {["Natural light", "No filters", "Face forward"].map(tip => (
            <div key={tip} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: DS.radius.full, background: DS.colors.success }} />
              <span style={{ fontSize: 11, color: DS.colors.textMuted, textAlign: "center", fontWeight: 500 }}>{tip}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {preview ? (
          <button onClick={handleAnalyse} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
            Analyse my colours
          </button>
        ) : (
          <>
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Choose from gallery</button>
            <button onClick={() => { if (cameraRef.current) cameraRef.current.click(); }} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.bg, color: DS.colors.text, fontSize: 16, fontWeight: 500, border: `1.5px solid ${DS.colors.border}` }}>Take a photo</button>
          </>
        )}
      </div>
    </div>
  );
};
const AnalysingScreen = () => {
  const steps = ["Reading your features", "Mapping your palette", "Building your guide"];
  const [step, setStep] = useState(0); const [progress, setProgress] = useState(0);
  useEffect(() => {
    const pi = setInterval(() => setProgress(p => Math.min(p + 1, 90)), 120);
    const t1 = setTimeout(() => setStep(1), 3000); const t2 = setTimeout(() => setStep(2), 6000);
    return () => { clearInterval(pi); clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
      <div style={{ width: 72, height: 72, marginBottom: 32, position: "relative" }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke={DS.colors.border} strokeWidth="4" />
          <circle cx="36" cy="36" r="30" fill="none" stroke={DS.colors.accent} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`} transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.1s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="sparkles" size={28} color={DS.colors.accent} />
        </div>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8, textAlign: "center" }}>Analysing your colours</h2>
      <p style={{ fontSize: 15, color: DS.colors.accent, fontWeight: 500, marginBottom: 16, transition: "all 0.4s" }}>{steps[step]}...</p>
      <p style={{ fontSize: 13, color: DS.colors.textFaint, textAlign: "center", marginBottom: 32, maxWidth: 260 }}>Analysing your colours… This takes up to a minute — good things take time. Your personal colour profile and wardrobe guide will be ready shortly.</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
  {steps.map((s, i) => (
    <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, width: 240, margin: "0 auto" }}>
      <div style={{ width: 24, height: 24, borderRadius: DS.radius.full, background: i <= step ? DS.colors.accent : DS.colors.surface, border: `1.5px solid ${i <= step ? DS.colors.accent : DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s" }}>
        {i < step && <Icon name="check" size={12} color={DS.colors.white} strokeWidth={2.5} />}
        {i === step && <div style={{ width: 8, height: 8, borderRadius: DS.radius.full, background: DS.colors.white, animation: "pulse 1s ease infinite" }} />}
      </div>
      <span style={{ fontSize: 14, color: i <= step ? DS.colors.text : DS.colors.textFaint, fontWeight: i === step ? 500 : 400, transition: "all 0.3s" }}>{s}</span>
    </div>
  ))}
</div>
    </div>
  );
};

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "sparkles", label: "Season" },
  { id: "checker", icon: "image", label: "Checker" },
  { id: "wardrobe", icon: "hanger", label: "Wardrobe" },
  { id: "me", icon: "user", label: "Me" },
];

const tourSteps = [
  { tab: "home" as Tab, title: "Your colour season", body: "Your palette, daily tip and personal colour guide — your style starting point." },
  { tab: "checker" as Tab, title: "Colour checker", body: "Upload any item or outfit to see if it suits your season." },
  { tab: "wardrobe" as Tab, title: "Your daily outfit engine", body: "Add your clothes, build outfits and wake up knowing exactly what to wear." },
  { tab: "me" as Tab, title: "Your profile", body: "Manage your account, plan and preferences here." },
];

const TourTooltip = ({ step, total, onNext, onSkip, activeTab, onTabChange }: { step: number; total: number; onNext: () => void; onSkip: () => void; activeTab: Tab; onTabChange: (tab: Tab) => void; }) => {
  const current = tourSteps[step];
  useEffect(() => { onTabChange(current.tab); }, [step]);
  return (
    <div style={{ position: "fixed", bottom: 90, left: 16, right: 16, zIndex: 2000 }}>
      <div style={{ background: DS.colors.accent, borderRadius: DS.radius.lg, padding: "16px 18px", boxShadow: DS.shadow.lg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{step + 1} of {total}</span>
          <button onClick={onSkip} style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Skip tour</button>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: DS.colors.white }}>{current.title}</p>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{current.body}</p>
        <button onClick={onNext} style={{ width: "100%", padding: "10px", borderRadius: DS.radius.md, background: DS.colors.white, fontSize: 13, fontWeight: 600, color: DS.colors.accent }}>
          {step < total - 1 ? "Next" : "Get started"}
        </button>
      </div>
    </div>
  );
};
const BottomNav = ({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void; }) => (
  <div style={{ height: 80, borderTop: `1px solid ${DS.colors.border}`, background: DS.colors.bg, display: "flex", paddingBottom: 16 }}>
    {tabs.map(tab => {
      const active = tab.id === activeTab;
      return (
        <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <Icon name={tab.icon} size={22} color={active ? DS.colors.accent : DS.colors.textFaint} strokeWidth={active ? 2 : 1.5} />
          <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? DS.colors.accent : DS.colors.textFaint, letterSpacing: "0.02em" }}>{tab.label}</span>
        </button>
      );
    })}
  </div>
);

const seasonGradients: Record<string, string> = {
  Spring: "linear-gradient(160deg, #FFF1E6 0%, #FFE0CC 60%, #FECBA1 100%)",
  Summer: "linear-gradient(160deg, #EEF2FF 0%, #DDE6FF 60%, #C7D7FF 100%)",
  Autumn: "linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 60%, #FED7AA 100%)",
  Winter: "linear-gradient(160deg, #F0F9FF 0%, #E0F2FE 60%, #BAE6FD 100%)",
};
const seasonTextColors: Record<string, string> = { Spring: "#7A3A1E", Summer: "#1a2a4a", Autumn: "#5C2E00", Winter: "#0C2340" };
const seasonAccentColors: Record<string, string> = { Spring: "#E8845A", Summer: "#4A6FD4", Autumn: "#C26B3A", Winter: "#2E7DB5" };

const hairColourMap: Record<string, string> = {
  "ash brown": "#8B7355", "soft chestnut": "#954535", "cool light brown": "#A0785A",
  "rose brown": "#BC8F8F", "dusty blonde": "#C8B89A", "ash blonde": "#C9B99A",
  "platinum blonde": "#E8E0D0", "golden blonde": "#D4A843", "warm auburn": "#8B4513",
  "jet black": "#1A1A1A", "cool black": "#2C2C2C", "dark brown": "#3B2314",
  "medium brown": "#7B4F2E", "light brown": "#A0785A", "strawberry blonde": "#CB8E73",
  "copper": "#CB6D51", "copper red": "#CB6D51", "burgundy": "#800020", "caramel": "#C68642",
  "highlights": "#D4C5A9", "balayage": "#C8B89A", "ombre": "#8B6914",
  "warm brown": "#7B4F2E", "cool brown": "#8B7355", "chestnut": "#954535",
  "mahogany": "#6B2737", "espresso": "#2C1503", "truffle": "#6B5C4E",
  "toffee": "#C68642", "honey blonde": "#D4A843", "dirty blonde": "#C8B89A",
  "sandy blonde": "#D2B48C", "champagne blonde": "#F0E0A0", "beige blonde": "#E8D5A3",
  "cool blonde": "#D8D0C0", "warm blonde": "#D4A843", "dark blonde": "#B8860B",
  "light ash brown": "#A0907A", "warm chestnut": "#954535", "soft black": "#2C2C2C",
  "blue black": "#1A1A2E", "chocolate brown": "#3D1C02", "walnut": "#6B4423",
  "pecan": "#8B6339", "cinnamon": "#D2691E", "ginger": "#B06500",
  "red": "#8B2500", "deep red": "#6B0000", "violet": "#4B0082",
  "cool medium brown": "#8B7355", "mushroom brown": "#9E8E7E",
};

const metalColourMap: Record<string, string> = {
  "gold": "#FFD700", "yellow gold": "#FFD700", "rose gold": "#B76E79",
  "white gold": "#E8E8E8", "silver": "#C0C0C0", "brushed silver": "#A9A9A9",
  "platinum": "#E5E4E2", "copper": "#B87333", "bronze": "#CD7F32",
  "oxidised silver": "#808080", "antique gold": "#B8960C",
  "warm gold": "#D4A843", "brushed bronze": "#8B6914", "brushed gold": "#C5A028",
  "matte gold": "#C5A028", "polished gold": "#FFD700", "mixed metals": "#C0C0C0",
  "gunmetal": "#2C3539", "pewter": "#96A8A1", "brass": "#B5A642",
  "antique silver": "#A9A9A9", "antique bronze": "#CD7F32", "vermeil": "#D4A843",
  "gold fill": "#FFD700", "sterling silver": "#C0C0C0",
};

const stoneColourMap: Record<string, string> = {
  "pearl": "#F0EAD6", "rose quartz": "#F4A7B9", "amethyst": "#9B59B6",
  "aquamarine": "#7FFFD4", "sapphire": "#0F52BA", "emerald": "#50C878",
  "ruby": "#9B111E", "opal": "#A8C5DA", "moonstone": "#E8E8E8",
  "turquoise": "#40E0D0", "garnet": "#733635", "topaz": "#FFC87C",
  "diamond": "#F0F8FF", "malachite": "#0BDA51", "lapis lazuli": "#26619C",
  "coral": "#FF7F50", "jade": "#00A86B", "onyx": "#353935",
  "citrine": "#E4D00A", "amber": "#FFBF00", "labradorite": "#7B9095",
  "rose gold stone": "#B76E79", "smoky quartz": "#7B6E5D", "clear quartz": "#F0F8FF",
  "peridot": "#8DB600", "tanzanite": "#4D5ACA", "alexandrite": "#8B4789",
  "spinel": "#FF1493", "tourmaline": "#00827F", "kunzite": "#FF9EBC",
  "aqua": "#00FFFF", "blue topaz": "#4682B4", "pink sapphire": "#FF69B4",
  "green amethyst": "#50C878", "white topaz": "#F0F8FF", "iolite": "#5C5CFF",
};
const PaywallSheet = ({ currentPlan, onUpgrade, onClose, isGuest, onSignUp }: {
  currentPlan: Plan; onUpgrade: (plan: Plan) => void;
  onClose: () => void; isGuest?: boolean; onSignUp?: () => void;
}) => {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [userCount, setUserCount] = useState(16);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: "count=exact" },
    }).then(r => {
      const count = r.headers.get("content-range");
      if (count) {
        const total = parseInt(count.split("/")[1]);
        if (total > 0) setUserCount(total);
      }
    }).catch(() => {});
  }, []);

  const pricing = {
    glow: { monthly: "$6.99", annual: "$49.99", monthlyEquiv: "$4.17/mo" },
    luxe: { monthly: "$14.99", annual: "$99.99", monthlyEquiv: "$8.33/mo" },
  };

  const handleUpgrade = async (selectedPlan: "glow" | "luxe") => {
    if (isGuest && onSignUp) { onSignUp(); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("solla_token");
      const cachedUser = localStorage.getItem("solla_user");
      if (!token || !cachedUser) { onSignUp?.(); return; }
      const user = JSON.parse(cachedUser);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({
          type: "create_checkout",
          plan: selectedPlan,
          billing,
          user_id: user.id,
          email: user.email,
          return_url: "https://solla.com.au",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (e) {
      console.error("Stripe error:", e);
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", maxHeight: "92vh", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, overflowY: "auto", padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
        </div>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ width: 48, height: 48, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon name="crown" size={22} color={DS.colors.accent} />
          </div>

          {isGuest ? (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 4 }}>Your colours, completely unlocked</h2>
              <p style={{ fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 8 }}>Stop staring at your wardrobe every morning. Solla tells you exactly what to wear — personalised to your colours. Try everything free for 7 days.</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: DS.colors.accentLight, padding: "4px 12px", borderRadius: DS.radius.full, marginBottom: 8 }}>
              <Icon name="sparkles" size={12} color={DS.colors.accent} />
              <span style={{ fontSize: 12, color: DS.colors.accentDark, fontWeight: 600 }}>Join {userCount}+ people who finally know their colours 🌸</span>
              </div>
              <button onClick={() => onSignUp?.()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Create account to continue</button>
              <button onClick={onClose} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Maybe later</button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 4 }}>Try everything free for 7 days</h2>
              <p style={{ fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 8 }}>Experience the full Luxe plan free. Choose your plan on day 8.</p>
              <div style={{ background: DS.colors.surface, borderRadius: DS.radius.md, padding: "12px 14px", marginBottom: 12, borderLeft: `3px solid ${DS.colors.accent}` }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: DS.colors.text, lineHeight: 1.6, fontStyle: "italic" }}>"I finally understand why some outfits just work and others don't. Game changer."</p>
                <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint, fontWeight: 500 }}>— Solla member</p>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0FDF4", padding: "4px 12px", borderRadius: DS.radius.full, marginBottom: 20 }}>
                <Icon name="check" size={12} color={DS.colors.success} strokeWidth={2.5} />
                <span style={{ fontSize: 12, color: DS.colors.success, fontWeight: 600 }}>7-day free trial - no charge until day 8</span>
              </div>

              {/* Billing toggle */}
              <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.lg, padding: 4, marginBottom: 20, gap: 4 }}>
                {(["monthly", "annual"] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)} style={{ flex: 1, padding: "8px", borderRadius: DS.radius.md, fontSize: 13, fontWeight: billing === b ? 600 : 400, color: billing === b ? DS.colors.white : DS.colors.textMuted, background: billing === b ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
                    {b === "monthly" ? "Monthly" : "Annual - save 40%"}
                  </button>
                ))}
              </div>

              {/* Luxe trial CTA — primary */}
              <div style={{ borderRadius: DS.radius.lg, border: `2px solid #C26B3A`, background: "#FFF7ED", padding: "16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#C26B3A" }}>Luxe</span>
                    <span style={{ fontSize: 10, background: DS.colors.success, color: DS.colors.white, padding: "2px 7px", borderRadius: DS.radius.full, fontWeight: 600 }}>RECOMMENDED</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#C26B3A" }}>{pricing.luxe[billing]}{billing === "monthly" ? "/mo" : "/yr"}</div>
                    {billing === "annual" && <div style={{ fontSize: 11, color: DS.colors.textFaint }}>{pricing.luxe.monthlyEquiv}</div>}
                  </div>
                </div>
                {["Everything in Glow", "Daily outfit suggestions — wake up knowing what to wear", "Style guide — exactly what cuts and fits suit your body and season", "24+ colour palette — every shade you can wear confidently", "Wardrobe builder — see which items actually work for you", "Outfit creator — build outfits you know will look good", "AI stylist — ask anything about your colours, style and wardrobe"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon name="check" size={12} color="#C26B3A" strokeWidth={2.5} />
                    <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{f}</span>
                  </div>
                ))}
                <button onClick={() => handleUpgrade("luxe")} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: "#C26B3A", color: DS.colors.white, fontSize: 15, fontWeight: 600, marginTop: 14, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Starting trial..." : "Try Luxe free for 7 days - no charge until day 8"}
                </button>
              </div>

              {/* Glow option — secondary */}
              <div style={{ borderRadius: DS.radius.lg, border: `1.5px solid ${DS.colors.border}`, background: DS.colors.bg, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: DS.colors.text }}>Glow</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DS.colors.textMuted }}>{pricing.glow[billing]}{billing === "monthly" ? "/mo" : "/yr"}</div>
                    {billing === "annual" && <div style={{ fontSize: 11, color: DS.colors.textFaint }}>{pricing.glow.monthlyEquiv}</div>}
                  </div>
                </div>
                {["Your full colour profile - undertone, depth, chroma and contrast explained", "Exact makeup shades, hair colours and jewellery metals for your season", "Colour checker - instantly know if any colour works for you"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon name="check" size={12} color={DS.colors.accent} strokeWidth={2.5} />
                    <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{f}</span>
                  </div>
                ))}
                <button onClick={() => handleUpgrade("glow")} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: DS.radius.lg, background: DS.colors.accentLight, color: DS.colors.accentDark, fontSize: 14, fontWeight: 600, marginTop: 12, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Starting trial..." : "Start free trial - Glow"}
                </button>
              </div>

              <p style={{ textAlign: "center", fontSize: 11, color: DS.colors.textFaint, marginBottom: 12, lineHeight: 1.5 }}>Cancel anytime before day 8 and you will not be charged a thing.
               No questions asked. Choose your plan on day 8.</p>
              <button onClick={onClose} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Maybe later</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
const guessColourFromName = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("black")) return "#2C2C2C";
  if (n.includes("white") || n.includes("platinum") || n.includes("silver")) return "#E0E0E0";
  if (n.includes("red") || n.includes("copper")) return "#CB6D51";
  if (n.includes("auburn") || n.includes("chestnut")) return "#954535";
  if (n.includes("burgundy") || n.includes("plum") || n.includes("violet")) return "#800020";
  if (n.includes("blonde") || n.includes("golden") || n.includes("honey")) return "#D4A843";
  if (n.includes("ash") || n.includes("cool") || n.includes("mushroom")) return "#A0A0A0";
  if (n.includes("rose") || n.includes("pink")) return "#BC8F8F";
  if (n.includes("brown") || n.includes("caramel") || n.includes("toffee")) return "#7B4F2E";
  if (n.includes("grey") || n.includes("gray")) return "#8A8A8A";
  if (n.includes("strawberry")) return "#CB8E73";
  if (n.includes("balayage") || n.includes("ombre") || n.includes("highlight")) return "#D4C5A9";
return "#C4A882";
};

const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", padding: "14px 0", borderBottom: `1px solid ${DS.colors.border}`, background: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: DS.colors.text, flex: 1 }}>{question}</span>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={16} color={DS.colors.textFaint} />
      </div>
      {open && <p style={{ margin: "10px 0 0", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.7 }}>{answer}</p>}
    </button>
  );
};

// SheetOverlay — rendered at ROOT level, outside all overflow:hidden containers
const SheetOverlay = ({ activeSheet, seasonData, onClose }: { activeSheet: Sheet; seasonData: SeasonData | null; onClose: () => void; }) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "flex-end" }}
    onClick={onClose}
  >
    <div
  style={{
    width: "100%", maxHeight: "85vh", background: DS.colors.bg,
    borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`,
    overflowY: "auto", padding: "0 0 48px",
    transform: "translateY(0)",
    animation: "none",
    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
  }}
  onClick={e => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
        <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
      </div>
      {activeSheet === "makeup" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>Makeup</h2>
          {/* Foundation */}
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${DS.colors.border}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Foundation</p>
            <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{seasonData?.makeup.foundation}</p>
          </div>

          {/* Blush, Lips, Eyes */}
          {[{ label: "Blush", value: seasonData?.makeup.blush }, { label: "Lips", value: seasonData?.makeup.lip }, { label: "Eyes", value: seasonData?.makeup.eye }].map(item => (
            <div key={item.label} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.label}</p>
              {item.value && typeof item.value === "object" && (
                <>
                  <p style={{ margin: "0 0 12px", fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{item.value.advice}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {item.value.colours.map(c => (
                      <div key={c.hex} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: c.hex, border: "1px solid rgba(0,0,0,0.08)" }} />
                        <p style={{ margin: 0, fontSize: 10, color: DS.colors.textFaint, textAlign: "center", maxWidth: 48, lineHeight: 1.3 }}>{c.name}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {activeSheet === "hair" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>Hair</h2>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Best colours</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {seasonData?.hair?.best_colours?.map(c => (
                <span key={c} style={{ padding: "6px 14px 6px 10px", background: DS.colors.accentLight, borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.accentDark, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: hairColourMap[c.toLowerCase()] || guessColourFromName(c), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.danger, letterSpacing: "0.06em", textTransform: "uppercase" }}>Avoid</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {seasonData?.hair?.avoid?.map(c => (
                <span key={c} style={{ padding: "6px 14px 6px 10px", background: "#FEF2F2", borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.danger, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: hairColourMap[c.toLowerCase()] || guessColourFromName(c), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Stylist tip</p>
            <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{seasonData?.hair?.tip}</p>
          </div>
        </div>
      )}
      {activeSheet === "jewellery" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>Jewellery</h2>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Metals</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {seasonData?.jewellery.metals.map(m => (
                <span key={m} style={{ padding: "6px 14px 6px 10px", background: DS.colors.surface, borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.text, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: metalColourMap[m.toLowerCase()] || "#C0C0C0", flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Stones</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {seasonData?.jewellery.stones.map(s => (
  <span key={s} style={{ padding: "6px 14px 6px 10px", background: DS.colors.surface, borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.textMuted, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span style={{ width: 12, height: 12, borderRadius: "50%", background: stoneColourMap[s.toLowerCase()] || guessColourFromName(s), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
    {s}
  </span>
))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Tip</p>
            <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{seasonData?.jewellery.tip}</p>
          </div>
        </div>
      )}
      {activeSheet === "style" && (
        <div style={{ padding: "16px 24px" }}>
          {[{ label: "Silhouettes", value: seasonData?.style.silhouettes }, { label: "Patterns", value: seasonData?.style.patterns }, { label: "Fabrics", value: seasonData?.style.fabrics }, { label: "Philosophy", value: seasonData?.style.tip }].map(item => (
            <div key={item.label} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
      {activeSheet === "faq" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Colour Theory & FAQ</h2>
          <p style={{ fontSize: 13, color: DS.colors.textMuted, marginBottom: 24, lineHeight: 1.5 }}>Everything you need to know about colour season analysis.</p>
          {[
            { q: "What does Solla mean?", a: "Solla is a name with warmth woven into it from multiple directions. In Tamil it means 'to say' or 'to tell' - which felt right for an app built around revealing something true about you. In Scandinavian tradition, Solla is a given name derived from the word for sun, carrying connotations of light and warmth. In Sri Lankan slang, a solla moment is a small, simple happiness - the kind you might feel when you finally put on a colour that just works. We liked that. Solla is about knowing your colours, dressing with intention, and finding joy in the small things - like getting dressed in the morning." },
            { q: "What is colour season analysis?", a: "Colour season analysis is a method of identifying which colours harmonise with your natural colouring — your skin tone, undertone, eye colour and hair colour. By grouping these into four seasons (Spring, Summer, Autumn, Winter) and 12 sub-seasons, we can identify the colours that make you look vibrant and alive versus those that wash you out or clash." },
            { q: "What are the four seasons?", a: "Spring — warm, clear and bright colouring. Summer — cool, soft and muted colouring. Autumn - warm, deep and earthy colouring. Winter - cool, deep and high contrast colouring. Each season has three sub-seasons that add further nuance." },
            { q: "What is undertone?", a: "Undertone is the subtle hue beneath your skin's surface. Warm undertones have golden or yellow hints. Cool undertones have pink or blue hints. Neutral undertones are a mix of both. It's the single most important factor in colour analysis." },
            { q: "What is chroma?", a: "Chroma describes how clear or muted your colouring is. High chroma means vivid, saturated features - you suit bold colours. Low chroma means soft, blended features - you suit muted, toned-down shades." },
            { q: "What is contrast?", a: "Contrast is the difference between your hair, skin and eye colour. High contrast (e.g. dark hair, light skin) suits bold colour combinations. Low contrast suits tonal, harmonious combinations." },
            { q: "How do I use the colour checker?", a: "Go to the Checker tab and upload a photo of any clothing item, full outfit, or colour swatches. Solla will analyse the colours against your season and give you a verdict with styling tips." },
            { q: "How do I add items to my wardrobe?", a: "Go to the Wardrobe tab and tap the + button. Upload a photo of the item - Solla will automatically identify the colour and check it against your season. Name the item, select a category, and save." },
            { q: "How do I edit or move an item in my wardrobe?", a: "Tap the edit icon (refresh symbol) on any wardrobe item to change the name or category. To delete, tap the trash icon." },
            { q: "Can I re-analyse my colours?", a: "Yes — go to the Me tab and tap 'Re-analyse my colours'. This clears your current results and takes you back to the upload screen. For best results use a clear, well-lit selfie in natural light with no filters." },
            { q: "My results aren't showing — what do I do?", a: "If your colour guide isn't appearing, try re-analysing your colours. Go to the Me tab and tap 'Re-analyse my colours' to upload a new photo and get your results." },
            { q: "What do I get on the free plan?", a: "The free plan gives you your colour season, your 4 best colours to wear now, your season headline and a daily colour tip. It's your starting point — upgrade to Glow or Luxe to unlock your full colour guide and daily outfit engine." },
            { q: "What's the difference between Glow and Luxe?", a: "Glow unlocks your subseason, full colour palette, colour profile (undertone, depth, chroma and contrast), makeup guide, hair colour guide, jewellery guide and colour checker. Luxe adds everything in Glow plus your daily outfit engine — wardrobe builder, outfit creator, AI stylist chat, style and fit guide, and an extended palette of 24+ colours. If you want to stop asking 'what do I wear today?' — Luxe is built for that." },
            { q: "How does the AI stylist work?", a: "The AI stylist lives in your Wardrobe tab and knows your colour season, body shape and every item you've added. Ask it what to wear today, what to wear for a specific occasion, how to style a piece you're not sure about, or to analyse your whole wardrobe for gaps. The more items you add, the smarter it gets." },
            { q: "Do all my clothes need to be my season colours?", a: "No — and this is one of the most common misconceptions about colour analysis. Colour season matters most for items worn near your face: tops, jackets, scarves, earrings and makeup. These directly affect how your skin looks. Items worn away from your face — trousers, skirts, shoes, bags — have much more flexibility. Neutral colours like black, white, navy, grey and camel work across most seasons. Solla uses a three-state verdict: ✓ suits your season (great near your face), ~ neutral (works away from your face paired with season colours up top), and ✗ avoid (clashes regardless of placement)." },
            { q: "What is the daily outfit suggestion?", a: "The daily outfit suggestion on your home tab uses your current weather and colour season to suggest a cohesive outfit each day. On Luxe, it pulls from your actual wardrobe items so suggestions are based on clothes you actually own. Allow location access for weather-based suggestions, or enter your postcode if location is unavailable. The suggestions improve over time as you add more wardrobe items and chat with your AI stylist." },
            { q: "Can I pause my subscription instead of cancelling?", a: "Yes — when you tap Cancel subscription in the Me tab, you'll be offered the option to pause for one month instead. Your wardrobe, colour profile and all your data will be waiting when you return. You won't be charged during the pause." },
            { q: "What is the colour checker?", a: "The colour checker lives in the Checker tab. Upload a photo of any clothing item, full outfit or colour swatches and Solla will instantly tell you whether each colour suits your season. Single item mode checks one piece at a time, outfit mode analyses every garment in a full look, and swatch mode is perfect for checking lipsticks or fabric samples held against your skin. Available on Glow and Luxe." },
            { q: "How does Solla learn my preferences?", a: "The more you use Solla and chat with your AI stylist, the better it understands your style. Your lifestyle, dress code and occasions from onboarding feed into every suggestion. Your wardrobe items — including their formality tags — help the stylist make relevant recommendations. Over time, feedback you give in the chat (thumbs up or down) helps refine suggestions to better match your taste." },
            { q: "What formality tags can I add to wardrobe items?", a: "When adding items to your wardrobe you can tag each piece as Casual, Smart casual, Work, Formal or Active. These tags help the AI stylist suggest outfits appropriate for your occasion — so if you ask for a work outfit it won't suggest your gym gear, and if you ask for a weekend look it won't pull your formal blazer." },
            { q: "How do I contact Solla?", a: "For any questions, feedback or support email us at hello@solla.com.au. We aim to respond within 1-2 business days." },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      )}
      {activeSheet === "privacy" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Privacy Policy</h2>
          <p style={{ fontSize: 12, color: DS.colors.textFaint, marginBottom: 24 }}>Last updated: 9 May 2026</p>
          {[
            { q: "What information do we collect?", a: "We collect your name, email address, and password when you create an account. We also collect photos you upload for colour analysis, and wardrobe item photos and descriptions. We automatically collect log and usage data, and device information." },
            { q: "How do we use your information?", a: "We use your information to provide personalised AI-powered colour season analysis and styling recommendations, manage your account, process payments, respond to support enquiries, send service communications, and improve our services." },
            { q: "Who do we share your information with?", a: "We share data with Anthropic (AI processing), Supabase (database), Stripe (payments), and Vercel (hosting and analytics). We do not sell your personal information to third parties." },
            { q: "How are photos handled?", a: "Photos you upload for colour analysis are transmitted securely to Anthropic for processing and are not stored permanently on our servers after analysis is complete." },
            { q: "How long do we keep your data?", a: "We retain your personal information for as long as you have an account with us. When you close your account we will delete or anonymise your information unless required by law." },
            { q: "What are your rights?", a: "Under the Australian Privacy Act 1988 you have the right to access, correct, or delete your personal information. Contact us at hello@solla.com.au to exercise these rights or to lodge a complaint." },
            { q: "How do we keep your information safe?", a: "We use HTTPS encryption, row-level database security, and JWT authentication. However no method of internet transmission is 100% secure." },
            { q: "Contact us", a: "For privacy questions contact hello@solla.com.au or write to Solla, Parcel Locker 10127 32034, 515 Brighton Road, Brighton SA 5048. You can also lodge a complaint with the Office of the Australian Information Commissioner at oaic.gov.au." },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      )}
      {activeSheet === "terms" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Terms of Service</h2>
          <p style={{ fontSize: 12, color: DS.colors.textFaint, marginBottom: 24 }}>Last updated: 9 May 2026</p>
          {[
            { q: "Who can use Solla?", a: "You must be at least 18 years of age to use Solla. By using our services you confirm that you meet this requirement." },
            { q: "How do I cancel?", a: "You can cancel anytime from the Me tab — tap your plan and select Cancel subscription. Cancellations take effect at the end of the current billing period. You will keep access until then. We do not offer refunds for partial periods. You can also email hello@solla.com.au for help." },
            { q: "AI-generated content", a: "Solla uses AI to generate colour analysis and styling recommendations. These are provided for informational and personal styling purposes only. Results may vary and should be used as guidance rather than definitive advice. We do not guarantee accuracy." },
            { q: "Acceptable use", a: "You agree not to use Solla for unlawful purposes, upload photos of others without consent, attempt to reverse engineer the app, use automated tools to access our services, or share your account credentials." },
            { q: "Intellectual property", a: "All content, design, code, and branding within Solla is owned by Emma Nagel (trading as Solla) and protected by Australian and international copyright law." },
            { q: "Your content", a: "By uploading photos you grant us a limited licence to process them for providing our services. We do not claim ownership of your photos." },
            { q: "Limitation of liability", a: "To the maximum extent permitted by Australian law, Solla shall not be liable for any indirect or consequential damages. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim." },
            { q: "Governing law", a: "These Terms are governed by the laws of South Australia, Australia. Disputes are subject to the exclusive jurisdiction of the courts of South Australia." },
            { q: "Contact us", a: "For questions about these terms contact hello@solla.com.au or write to Solla, Parcel Locker 10127 32034, 515 Brighton Road, Brighton SA 5048." },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      )}
      {activeSheet === "cookies" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Cookie Policy</h2>
          <p style={{ fontSize: 12, color: DS.colors.textFaint, marginBottom: 24 }}>Last updated: 9 May 2026</p>
          {[
            { q: "What are cookies?", a: "Cookies are small data files placed on your device when you visit a website. They help websites remember your preferences and provide a better experience." },
            { q: "What cookies does Solla use?", a: "We use essential cookies for authentication and session management (Supabase), analytics cookies to understand app usage (Vercel), and functional cookies to remember your preferences." },
            { q: "What about local storage?", a: "Solla also uses your browser's local storage to save your session, colour analysis results, and preferences. This data stays on your device and is not transmitted to third parties." },
            { q: "Third-party cookies", a: "Supabase sets cookies for authentication, Vercel sets cookies for analytics, and Stripe sets cookies on checkout pages for payment processing." },
            { q: "How do I control cookies?", a: "You can manage cookies through your browser settings. Note that blocking essential cookies may prevent you from logging in or using core features of Solla." },
            { q: "Contact us", a: "For questions about our use of cookies contact hello@solla.com.au or write to Solla, Parcel Locker 10127 32034, 515 Brighton Road, Brighton SA 5048." },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      )}
    </div>
  </div>
);
const PostcodeWeather = ({ seasonData, onResult }: { seasonData: SeasonData | null; onResult: (temp: number, desc: string) => void }) => {
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async () => {
    if (!postcode.trim()) return;
    setLoading(true); setError("");
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=Australia&format=json&limit=1`);
      const geoData = await geoRes.json();
      if (!geoData?.[0]) { setError("Postcode not found — try again."); setLoading(false); return; }
      const { lat, lon } = geoData[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`);
      const weatherData = await weatherRes.json();
      const temp = Math.round(weatherData.current.temperature_2m);
      const code = weatherData.current.weathercode;
      const desc = code <= 1 ? "sunny" : code <= 3 ? "partly cloudy" : code <= 67 ? "rainy" : code <= 77 ? "snowy" : "overcast";
      onResult(temp, desc);
    } catch { setError("Something went wrong — try again."); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted }}>Enter your postcode for a weather-based outfit suggestion.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="e.g. 5048" maxLength={4} style={{ flex: 1, padding: "10px 12px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, fontFamily: DS.font }} />
        <button onClick={handleSubmit} disabled={loading} style={{ padding: "10px 16px", borderRadius: DS.radius.md, background: DS.colors.accent, color: DS.colors.white, fontSize: 13, fontWeight: 600 }}>
          {loading ? "..." : "Go"}
        </button>
      </div>
      {error && <p style={{ margin: 0, fontSize: 12, color: DS.colors.danger }}>{error}</p>}
    </div>
  );
};
const DAILY_TIPS: Record<string, string[]> = {
  Spring: [
    "Warm peach tones near your face will make your skin glow — try a peachy blush instead of pink.",
    "Your best neutrals are warm camel and ivory, not stark white or grey.",
    "Coral and warm terracotta are your power colours — own them.",
    "Light golden jewellery complements your warm undertone far better than silver.",
    "Try layering warm cream with a pop of turquoise — it's a classic Spring combination.",
    "Your season thrives in natural fabrics like linen and cotton in warm, light tones.",
    "Avoid black near your face — it creates harsh contrast against your soft, warm colouring.",
    "A warm apricot lip is more flattering than a cool berry on your Spring colouring.",
    "Bright, clear colours suit you best — dusty or muted tones can wash you out.",
    "Golden hour light was made for Springs — your colouring comes alive in warm sunlight.",
    "Try a warm peach or coral nail colour — it harmonises beautifully with your skin tone.",
    "Your best whites are cream and warm off-white, never stark or blue-based white.",
    "Warm golden highlights in your hair will enhance your natural radiance.",
    "Light teal and aqua are unexpected but stunning accent colours for Springs.",
    "Avoid cool-toned makeup — always reach for warm-based foundations and blushes.",
    "A bright cobalt or warm turquoise scarf near your face will make your eyes pop.",
    "Ivory, warm beige and camel are your wardrobe foundations — build from these.",
    "Your season pairs beautifully with natural wood and warm metallic accessories.",
    "When in doubt, choose the warmer version of any colour — it will always serve you better.",
    "Soft golden or peachy eyeshadow enhances your natural warmth more than cool greys.",
    "Light warm greens like sage or chartreuse are surprisingly powerful on Springs.",
    "Your skin responds beautifully to warmth — embrace warm lighting wherever possible.",
    "Avoid dark, heavy colours in winter — layer warm light tones instead for the same cosy effect.",
    "Warm red-oranges and corals are your reds — cool blue-reds clash with your undertone.",
    "Your best denim is a lighter, warm-washed blue — dark or grey-toned denim dulls your look.",
    "Peach, apricot and warm yellow florals are made for your colouring.",
    "Try warm chartreuse or yellow-green as a statement colour — it's unexpectedly brilliant on Springs.",
    "Your colouring has natural clarity — bright, vivid tones reflect that energy back.",
    "Light, bright and warm: your three words for getting dressed every morning.",
    "Warm gold-toned eyeshadow at the inner corner of your eyes makes them appear brighter instantly.",
  ],
  Summer: [
    "Dusty rose and soft lavender are your superpower colours — they make your skin look luminous.",
    "Your best neutrals are cool greige, soft taupe and blue-grey — never warm beige.",
    "Avoid stark black near your face — try deep plum, charcoal or navy instead.",
    "Silver and white gold jewellery harmonises perfectly with your cool undertone.",
    "Soft, muted tones suit you best — highly saturated colours can overwhelm your gentle colouring.",
    "Cool-toned pinks and mauves make your lips look naturally beautiful.",
    "Powder blue and soft sage are your neutral workhorses — more versatile than beige for you.",
    "A dusty rose or soft berry blush will give you that effortless, healthy flush.",
    "Your colouring is softer than it looks — muted and blended outfits feel most harmonious.",
    "Avoid warm golden tones in hair and makeup — ashy cool tones will suit you far better.",
    "Denim in a cooler, greyer wash is your best friend — it works with almost everything in your palette.",
    "Lavender, lilac and soft violet are unexpected but stunning on Summer colouring.",
    "Avoid orange-based bronzers — a cool-toned highlighter gives you a more natural glow.",
    "Your best whites are soft white and cool white — pure bright white can clash with your soft colouring.",
    "Charcoal and deep navy are your versions of black — more harmonious and just as versatile.",
    "Muted teal and dusty aqua are beautiful accent colours that work with your cool palette.",
    "Cool rose-brown hair tones complement your natural colouring more than warm caramel.",
    "Layering similar tones together — like soft blue with greige — is a very Summer way to dress.",
    "Your colouring has a natural softness — lean into it rather than fighting it with harsh contrasts.",
    "Cool raspberry and deep rose are your power reds — avoid warm coral or tomato red.",
    "Soft sage and cool mint are surprisingly wearable everyday colours for your season.",
    "A cool-toned soft plum or mulberry lip is more flattering than a warm nude on you.",
    "Your eyes often have cool or grey undertones — enhance them with soft lavender or taupe shadow.",
    "Avoid highly saturated colours — the softer, dustier version of any colour will suit you better.",
    "Pearl and moonstone jewellery suit your soft, cool colouring beautifully.",
    "Soft, cool florals in lavender, dusty pink and blue are made for your palette.",
    "Your season is associated with elegance and refinement — your palette reflects that naturally.",
    "Cool-toned mauve or dusty pink nails are more harmonious than warm coral or orange.",
    "Misty morning light captures your colouring at its best — soft, cool and luminous.",
    "When in doubt, choose the cooler, softer version of any colour and you'll always be right.",
  ],
  Autumn: [
    "Rich terracotta and burnt orange are your signature colours — wear them near your face.",
    "Your best neutrals are warm camel, chocolate brown and olive — endlessly versatile for you.",
    "Gold jewellery was made for Autumns — it enhances your warmth and depth beautifully.",
    "Avoid black — try deep chocolate, espresso or dark olive for the same impact with more harmony.",
    "Earthy, muted tones are your foundation — they ground your look without overwhelming it.",
    "Warm brick red is your red — cool blue-red or cherry red will clash with your undertone.",
    "Olive green is one of your most powerful and wearable colours — don't underestimate it.",
    "Your colouring is rich and warm — embrace depth and saturation in your palette.",
    "Amber, cognac and warm toffee tones in accessories will pull any outfit together.",
    "Avoid icy or cool pastels — they fight against your warm, earthy colouring.",
    "Deep mustard yellow is one of the most flattering colours you can wear — try it today.",
    "Warm auburn and copper hair tones align beautifully with your natural colouring.",
    "Bronze and antique gold accessories give you a richness that silver cannot match.",
    "Warm brown-toned eyeshadow enhances your eyes far more than cool grey or taupe.",
    "Layering warm tones — terracotta with camel, burgundy with olive — is quintessentially Autumn.",
    "Your skin has a warmth and depth that glows in autumn light — lean into it.",
    "Rust, burnt sienna and ochre are your accent colours — powerful and deeply personal.",
    "Warm, earthy florals in burnt orange, deep red and golden yellow are made for you.",
    "Your best lipstick shades are warm brick, terracotta, deep coral and warm berry.",
    "Avoid bright, clear colours — muted, earthy versions of the same hues will always suit you better.",
    "Warm tortoiseshell, leather and wood accessories harmonise naturally with your palette.",
    "Deep teal and forest green are your cool-leaning colours — still warm enough to work beautifully.",
    "Your colouring carries weight and richness — avoid anything too light or pastel near your face.",
    "A warm bronze highlighter will give you a natural glow that cool highlighters can't replicate.",
    "Camel and warm tan coats are your neutrals done right — they work with your entire wardrobe.",
    "Autumn colouring was designed for textures — linen, suede, leather and wool all look outstanding on you.",
    "Your season is the most grounded and earthy — your palette reflects strength and warmth.",
    "Deep burgundy and wine are your evening colours — rich, warm and completely your own.",
    "Avoid white — try warm ivory, cream or soft sand for a fresher, more harmonious look.",
    "When in doubt, reach for something earthy and warm — you cannot go wrong.",
  ],
  Winter: [
    "High contrast is your superpower — don't be afraid of bold colour pairings.",
    "True black is one of your best colours — it enhances your natural contrast and depth.",
    "Bright white and pure black are your neutrals — avoid warm beige or cream near your face.",
    "Cool jewel tones — sapphire, emerald, ruby — are made for your colouring.",
    "Silver and platinum jewellery harmonises perfectly with your cool undertone.",
    "Avoid warm, muted or earthy tones — they dull your natural intensity.",
    "A bold red lip in a cool, blue-toned red is one of the most flattering looks you can wear.",
    "Your colouring thrives in sharp contrasts — don't blend everything into the same tonal range.",
    "Icy pastels — ice blue, pale lavender, mint — are surprisingly powerful on Winter colouring.",
    "Avoid warm browns and camel tones — they clash with your cool, high-contrast nature.",
    "Deep navy is your alternative to black — equally strong and slightly softer.",
    "Cool plum and deep berry are your most flattering lip colours after red.",
    "Your eyes likely have cool undertones — enhance them with charcoal, navy or cool taupe shadow.",
    "Avoid muted or dusty colours — you need clarity and saturation for your palette to sing.",
    "Bright fuchsia and cool magenta are bold but deeply flattering on Winter colouring.",
    "White gold and silver accessories always over gold — warmth doesn't serve your undertone.",
    "Cool-toned highlighters give you a luminous, icy glow that suits your season perfectly.",
    "Deep emerald green is one of your strongest colours — wear it confidently.",
    "Avoid orange-based tones at all costs — they are among the least flattering for your colouring.",
    "Crisp, clean lines and minimal styling reflect your season's natural aesthetic.",
    "Cool charcoal grey is a powerful neutral for you — more harmonious than warm grey or taupe.",
    "Bright cobalt blue worn near your face will make your features more striking instantly.",
    "Your colouring has a natural drama — lean into it rather than softening it unnecessarily.",
    "Deep burgundy and wine are your reds for eveningwear — rich and perfectly cool-toned.",
    "Avoid anything yellow-based in your makeup — cool pink and mauve tones will always serve you better.",
    "Monochrome dressing in black and white is a Winter signature — own it.",
    "Your season is the most dramatic of the four — your palette should reflect that confidence.",
    "Cool mint and icy aqua are unexpected but beautiful accent colours for your wardrobe.",
    "Avoid warm lighting when possible — cool, natural light is where your colouring looks its best.",
    "When in doubt, go cooler, deeper and more saturated — that is always the Winter direction.",
  ],
};

const getDailyTip = (season: string, fallback: string): string => {
  const tips = DAILY_TIPS[season];
  if (!tips) return fallback;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return tips[dayOfYear % tips.length];
};

const SEASON_IDENTITY: Record<string, string[]> = {
  Spring: [
    "You carry warmth into every room before you say a word. That's not charm — it's colouring.",
    "Springs are the people others describe as 'glowing'. You always have been.",
    "Your energy is light, clear and infectious. Your palette was built to match it.",
    "You look best in the colours of late afternoon sun — warm, golden, alive.",
    "There's a brightness to you that cool, heavy colours have always fought against. Now you know why.",
    "People feel more optimistic around Springs. Your colouring is part of that.",
    "You were made for colour. Not loud colour — warm, clear, joyful colour.",
    "Your best self has always been your warmest self. Your palette makes that visible.",
    "Springs are rare. Most people spend years wearing colours that dull them. You don't have to.",
    "There's nothing soft or washed-out about you. Your palette reflects exactly that.",
  ],
  Summer: [
    "You have a softness people trust immediately. That's not weakness — it's your power.",
    "Summers are the people who make a room feel safe. Your palette reflects exactly that.",
    "You carry elegance without effort. Cool, muted tones are simply the truth of you.",
    "People remember how you made them feel. Your colouring is part of why.",
    "You look best in the colours of early morning — soft, cool, before the world gets loud.",
    "There is a quietness to your beauty that loud colours have always fought against.",
    "Summers are underestimated. Then suddenly, undeniable.",
    "Your palette is not subtle — it's precise. There's a difference.",
    "You were never meant to wear black. You were made for something far more interesting.",
    "The best version of you has always lived in soft, cool, considered tones. Now you have the words for it.",
  ],
  Autumn: [
    "You have a groundedness that people lean on without realising it. Your palette is built from the same place.",
    "Autumns are the people others describe as 'real'. Warm, deep, unhurried.",
    "There's a richness to you that pastels and icy tones have always diminished. Now you know why.",
    "You look best in the colours of October — deep, warm, alive with texture.",
    "People trust Autumns. There's something in your warmth that reads as safe.",
    "You were made for depth. Terracotta, rust, forest, gold — these aren't just colours, they're you.",
    "Your colouring has always had a quiet authority. The right palette makes it visible.",
    "Autumn colouring ages beautifully. The depth that suits you now will suit you always.",
    "You carry warmth that cool, bright colours have spent years trying to cool down. They were wrong to try.",
    "There is an earthiness to you that is genuinely rare. Own it completely.",
  ],
  Winter: [
    "You have a presence that enters a room before you do. Your palette was built for exactly that.",
    "Winters are the people you don't forget. High contrast, high impact, unforgettable.",
    "There's a clarity to you that muted, warm tones have always blurred. Now you know why.",
    "You look best in colours that match your intensity — deep, cool, uncompromising.",
    "People notice Winters. Not because you try — because your colouring demands it.",
    "You were made for contrast. Black, white, jewel tones — these aren't bold choices for you, they're natural ones.",
    "Your colouring has always had an edge. The right palette doesn't soften it — it sharpens it.",
    "Winters don't need to try hard. The palette does the work.",
    "You carry a cool precision that warm, earthy colours have spent years trying to soften. They were wrong to try.",
    "There is an intensity to you that is genuinely rare. Your palette finally matches it.",
  ],
};

const getIdentityStatement = (season: string): string => {
  const statements = SEASON_IDENTITY[season];
  if (!statements) return "";
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return statements[dayOfYear % statements.length];
};

const getStreak = (userId: string): number => {
  try {
    const data = localStorage.getItem(`solla_streak_${userId}`);
    if (!data) return 0;
    const { count, lastDate } = JSON.parse(data);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === today) return count;
    if (lastDate === yesterday) return count; // still active, will increment on open
    return 0; // broken streak
  } catch { return 0; }
};

const incrementStreak = (userId: string): number => {
  try {
    const data = localStorage.getItem(`solla_streak_${userId}`);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (data) {
      const { count, lastDate } = JSON.parse(data);
      if (lastDate === today) return count; // already incremented today
      const newCount = lastDate === yesterday ? count + 1 : 1; // continue or restart
      localStorage.setItem(`solla_streak_${userId}`, JSON.stringify({ count: newCount, lastDate: today }));
      return newCount;
    }
    localStorage.setItem(`solla_streak_${userId}`, JSON.stringify({ count: 1, lastDate: today }));
    return 1;
  } catch { return 0; }
};


const HomeTab = ({ seasonData, user, onOpenSheet, onUpgrade, onReanalyse, onTabChange }: { seasonData: SeasonData | null; user: User | null; onOpenSheet: (sheet: Sheet) => void; onUpgrade: () => void; onReanalyse: () => void; onTabChange: (tab: Tab) => void; }) => {
  const plan = user?.plan || "free"; const [showShare, setShowShare] = useState(false); const [selectedColour, setSelectedColour] = useState<PaletteColour | null>(null);
  const [streak, setStreak] = useState(0);
  useEffect(() => { if (user?.id) setStreak(incrementStreak(user.id)); }, [user?.id]);
const [extendedPalette, setExtendedPalette] = useState<PaletteColour[]>([]);
const [loadingExtended, setLoadingExtended] = useState(false);
const [showExtended, setShowExtended] = useState(false);
const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);
const [weatherOutfit, setWeatherOutfit] = useState<string | null>(null);
const [loadingWeather, setLoadingWeather] = useState(false);
const [nudge, setNudge] = useState<{ message: string; action: string; onAction: () => void } | null>(null);
const [nudgeDismissed, setNudgeDismissed] = useState(false);

useEffect(() => {
  const today = new Date().toDateString();
  const lastNudge = localStorage.getItem("solla_nudge_date");
  if (lastNudge === today) { setNudgeDismissed(true); return; }
  if (!user || !seasonData) return;

  let selectedNudge: { message: string; action: string; onAction: () => void } | null = null;

  if (plan === "luxe") {
    const wardrobeCount = parseInt(localStorage.getItem(`solla_wardrobe_count_${user.id}`) || "0");
    if (wardrobeCount === 0) {
      selectedNudge = {
        message: "Your outfit engine is empty — add your first items and wake up knowing what to wear.",
        action: "Add items",
        onAction: () => onTabChange("wardrobe"),
      };
    }
  } else if (plan === "glow") {
    selectedNudge = {
      message: "Ready to never ask 'what do I wear?' again? Build your outfit engine with Luxe.",
      action: "Upgrade to Luxe",
      onAction: () => onUpgrade(),
    };
  } else if (plan === "free") {
    selectedNudge = {
      message: `Your makeup guide is ready — see exactly which foundation and lip colours suit your ${seasonData.season} colouring.`,
      action: "Unlock now",
      onAction: () => onUpgrade(),
    };
  }

  setNudge(selectedNudge);
}, [user?.id, plan, seasonData?.season]);

const generateOutfit = async (temp: number, desc: string) => {
  try {
    const season = seasonData!.season;
    const palette = (seasonData!.palette?.best || []).map((c: PaletteColour) => c.name).slice(0, 3).join(", ");
    const token = localStorage.getItem("solla_token");
    let wardrobeContext = "";
    if (user?.id && (user?.plan === "luxe" || user?.plan === "glow")) {
      try {
        const wRes = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?user_id=eq.${user.id}&select=name,category,colour_name,verdict,verdict_v2,formality&limit=30`, {
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` }
        });
        const wData = await wRes.json();
        if (Array.isArray(wData) && wData.length > 0) {
          wardrobeContext = wData.filter((i: WardrobeItem) => (i.verdict_v2 || (i.verdict ? "yes" : "no")) !== "no").map((i: WardrobeItem) => `${i.name} (${i.category}${i.formality ? `, ${i.formality}` : ""})`).join(", ");
        }
      } catch {}
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
      body: JSON.stringify({
        type: "weather_outfit",
        season,
        palette,
        temp,
        desc,
        wardrobe: wardrobeContext,
      }),
    });
    const data = await res.json();
    if (data.outfit) {
      setWeatherOutfit(data.outfit);
    } else {
      setWeatherOutfit("Debug: " + JSON.stringify(data).slice(0, 150));
    }
  } catch (e) {
    setWeatherOutfit("Error: " + (e instanceof Error ? e.message : String(e)));
  }
};

useEffect(() => {
  if (!seasonData || plan === "free") return;
  if (!navigator.geolocation) { return; }
  setLoadingWeather(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`);
      const data = await res.json();
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weathercode;
      const desc = code <= 1 ? "sunny" : code <= 3 ? "partly cloudy" : code <= 67 ? "rainy" : code <= 77 ? "snowy" : "overcast";
      setWeather({ temp, desc, icon: "sun" });
      await generateOutfit(temp, desc);
    } catch {}
    finally { setLoadingWeather(false); }
  }, (err) => { console.log("Location error:", err.code, err.message); setLoadingWeather(false); setWeather({ temp: -1, desc: "denied", icon: "map-pin" }); }, { timeout: 10000 });
}, [seasonData?.season, plan]);

const loadExtendedPalette = async () => {
  if (extendedPalette.length > 0) { setShowExtended(true); return; }
  const cacheKey = `solla_extended_${seasonData?.season}_${seasonData?.subseason}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      setExtendedPalette(JSON.parse(cached));
      setShowExtended(true);
      return;
    } catch {}
  }
  setLoadingExtended(true);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
      body: JSON.stringify({
        type: "extended_palette",
        season: seasonData?.season,
        subseason: seasonData?.subseason,
        undertone: seasonData?.colour_profile?.undertone,
        chroma: seasonData?.colour_profile?.chroma,
        depth: seasonData?.colour_profile?.depth,
      }),
    });
    const data = await res.json();
    if (data.colours) {
      setExtendedPalette(data.colours); localStorage.setItem(cacheKey, JSON.stringify(data.colours));
      setShowExtended(true);
    }
  } catch {}
  finally { setLoadingExtended(false); }
};
  if (!seasonData) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "40px 28px" }}>
      <Icon name="sparkles" size={40} color={DS.colors.border} />
      <p style={{ fontSize: 15, fontWeight: 500, color: DS.colors.textMuted, textAlign: "center" }}>No season data yet</p>
      <p style={{ fontSize: 13, color: DS.colors.textFaint, textAlign: "center" }}>Upload a selfie to discover your colours and build your daily outfit engine</p>
      <button onClick={onReanalyse} style={{ marginTop: 8, padding: "12px 24px", borderRadius: DS.radius.full, background: DS.colors.accent, color: DS.colors.white, fontSize: 14, fontWeight: 600 }}>Re-analyse my colours</button>
    </div>
  );
  const gradient = seasonGradients[seasonData.season] || seasonGradients.Summer;
  const textColor = seasonTextColors[seasonData.season] || "#1a2a4a";
  const accentColor = seasonAccentColors[seasonData.season] || "#4A6FD4";
  const canAccessHair = plan !== "free";
  const canAccessJewellery = plan !== "free";
  const categoryCards = [
    { id: "hair" as Sheet, icon: "scissors", label: "Hair", teaser: "Discover the exact hair colours and tones that make your natural colouring come alive", locked: !canAccessHair, requiredPlan: "Glow" },
    { id: "jewellery" as Sheet, icon: "gem", label: "Jewellery", teaser: "Discover which metals and stones are made for your colouring", locked: !canAccessJewellery, requiredPlan: "Glow" },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", background: DS.colors.bg }}>
      <div style={{ background: gradient, padding: "52px 24px 28px" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your season</p>
        <h1 style={{ margin: "0 0 4px", fontSize: 42, fontWeight: 700, color: textColor, letterSpacing: "-1.5px", lineHeight: 1 }}>{seasonData.season}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {plan === "free" ? (
            <button onClick={onUpgrade} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(255,255,255,0.5)", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, color: accentColor, border: `1px solid ${accentColor}30` }}>
              <Icon name="lock" size={10} color={accentColor} strokeWidth={2} />{seasonData.subseason} - unlock
            </button>
          ) : (
            <span style={{ fontSize: 15, color: accentColor, fontWeight: 500 }}>{seasonData.subseason}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: textColor, lineHeight: 1.6, opacity: 0.85, maxWidth: 300 }}>{seasonData.headline}</p>

        {/* Identity statement */}
        <p style={{ margin: "14px 0 0", fontSize: 14, color: textColor, lineHeight: 1.7, fontStyle: "italic", opacity: 0.9, maxWidth: 300 }}>{getIdentityStatement(seasonData.season)}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button onClick={() => setShowShare(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.3)", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 600, color: textColor, border: `1px solid rgba(255,255,255,0.4)` }}>
            <Icon name="share" size={14} color={textColor} strokeWidth={2} />
            Share my season
          </button>
          {streak > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", background: "rgba(255,255,255,0.2)", borderRadius: DS.radius.full, border: `1px solid rgba(255,255,255,0.3)` }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{streak}</span>
            </div>
          )}
        </div>
{showShare && <ShareCard seasonData={seasonData} onClose={() => setShowShare(false)} />}
      </div>
      <div style={{ margin: "0 16px", background: DS.colors.bg, borderRadius: `0 0 ${DS.radius.lg} ${DS.radius.lg}`, padding: "12px 16px", borderLeft: `3px solid ${accentColor}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon name="sparkles" size={14} color={accentColor} strokeWidth={2} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, color: accentColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>Today's colour note</p>
          <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{getDailyTip(seasonData.season, seasonData.daily_tip)}</p>
        </div>
      </div>
      {streak > 0 && [3, 7, 14, 30].includes(streak) && (
        <div style={{ margin: "0 16px 4px", padding: "12px 14px", background: `${accentColor}15`, borderRadius: DS.radius.lg, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: DS.colors.text }}>
              {streak === 3 ? "3 days in a row" : streak === 7 ? "One week" : streak === 14 ? "Two weeks" : "30 days"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: DS.colors.textMuted }}>
              {streak === 3 ? "Your eye is starting to train." : streak === 7 ? "You're dressing differently now." : streak === 14 ? "This is becoming instinct." : "You know your colours completely."}
            </p>
          </div>
        </div>
      )}
      {nudge && !nudgeDismissed && (
        <div style={{ margin: "0 16px 4px", padding: "12px 14px", background: DS.colors.accentLight, borderRadius: DS.radius.lg, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, color: DS.colors.accentDark, lineHeight: 1.5 }}>{nudge.message}</p>
            <button onClick={() => { nudge.onAction(); setNudgeDismissed(true); localStorage.setItem("solla_nudge_date", new Date().toDateString()); }} style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: DS.colors.accent }}>
              {nudge.action} →
            </button>
          </div>
          <button onClick={() => { setNudgeDismissed(true); localStorage.setItem("solla_nudge_date", new Date().toDateString()); }} style={{ padding: 4, flexShrink: 0 }}>
            <Icon name="x" size={14} color={DS.colors.textFaint} />
          </button>
        </div>
      )}
      {plan !== "free" && (
        <div style={{ margin: "0 16px 4px", padding: "14px 16px", background: DS.colors.surface, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>Today's outfit</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {weather && weather.desc !== "denied" && <p style={{ margin: 0, fontSize: 12, color: DS.colors.textMuted }}>{weather.temp}°C · {weather.desc}</p>}
            </div>
          </div>
          {loadingWeather && <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted }}>Finding your perfect outfit for today…</p>}
          {!loadingWeather && weatherOutfit && (() => {
  try {
    const outfit = JSON.parse(weatherOutfit);
    const outfitSummary = [outfit.coat && outfit.coat !== "null" ? outfit.coat : null, outfit.base, outfit.shoes, outfit.accessories].filter(Boolean).join(", ");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {outfit.coat && outfit.coat !== "null" && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.accent, minWidth: 80 }}>Coat</span>
            <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{outfit.coat}</span>
          </div>
        )}
        {outfit.base && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.accent, minWidth: 80 }}>Base</span>
            <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{outfit.base}</span>
          </div>
        )}
        {outfit.shoes && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.accent, minWidth: 80 }}>Shoes</span>
            <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{outfit.shoes}</span>
          </div>
        )}
        {outfit.accessories && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.accent, minWidth: 80 }}>Accessories</span>
            <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{outfit.accessories}</span>
          </div>
        )}
        <button onClick={() => { localStorage.setItem("solla_stylist_prefill", `Style today's outfit for me: ${outfitSummary}. Any tweaks or alternatives?`); onTabChange("wardrobe"); }} style={{ marginTop: 4, alignSelf: "flex-start", fontSize: 12, color: DS.colors.accent, fontWeight: 600 }}>
          Style with AI →
        </button>
      </div>
    );
  } catch {
    return <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6 }}>{weatherOutfit}</p>;
  }
})()}
          {!loadingWeather && !weatherOutfit && !weather && (
  <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted }}>Getting your location for today's outfit suggestion…</p>
)}
{!loadingWeather && !weatherOutfit && weather?.desc === "denied" && (
  <PostcodeWeather seasonData={seasonData} onResult={(temp, desc) => { setWeather({ temp, desc, icon: "map-pin" }); generateOutfit(temp, desc); }} />
)}
        </div>
      )}
      {plan === "free" && (
        <button onClick={onUpgrade} style={{ margin: "0 16px 4px", padding: "16px", background: seasonData.season === "Spring" ? "linear-gradient(135deg, #E8845A 0%, #D4A843 100%)" : seasonData.season === "Autumn" ? "linear-gradient(135deg, #C26B3A 0%, #8B4513 100%)" : seasonData.season === "Winter" ? "linear-gradient(135deg, #2E4057 0%, #6B3FA0 100%)" : `linear-gradient(135deg, ${DS.colors.accent} 0%, #9B6FD4 100%)`, borderRadius: DS.radius.lg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: DS.radius.full, padding: "2px 8px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: DS.colors.white }}>FREE FOR 7 DAYS</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.colors.white }}>Your makeup, hair and outfit engine are ready</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>No charge until day 8 · Cancel anytime</p>
          </div>
          <Icon name="chevronRight" size={16} color={DS.colors.white} />
        </button>
      )}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "16px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Your palette</p>
          
          {/* Best colours */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {(seasonData.palette?.best || []).map(colour => (
  <button key={colour.hex} onClick={() => setSelectedColour(colour)} style={{ textAlign: "center", background: "none", border: "none", padding: 0 }}>
    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: colour.hex, marginBottom: 4, border: colour.hex === "#FFFFFF" ? `1px solid ${DS.colors.border}` : "none" }} />
    <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
  </button>
))}
          </div>

          {/* Base colours */}
          {plan !== "free" && seasonData.palette?.base && seasonData.palette?.base.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Base neutrals</p>
              <div style={{ display: "flex", gap: 8 }}>
                {seasonData.palette?.base.map(colour => (
  <button key={colour.hex} onClick={() => setSelectedColour(colour)} style={{ flex: 1, textAlign: "center", background: "none", border: "none", padding: 0 }}>
    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: colour.hex, marginBottom: 4, border: `1px solid ${DS.colors.border}` }} />
    <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
  </button>
))}
              </div>
            </div>
          )}

          {/* Accent colours */}
          {plan !== "free" && seasonData.palette?.accent && seasonData.palette?.accent.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Accent colours</p>
              <div style={{ display: "flex", gap: 8 }}>
                {seasonData.palette?.accent.map(colour => (
  <button key={colour.hex} onClick={() => setSelectedColour(colour)} style={{ flex: 1, textAlign: "center", background: "none", border: "none", padding: 0 }}>
    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: colour.hex, marginBottom: 4, border: `1px solid ${DS.colors.border}` }} />
    <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
  </button>
))}
              </div>
            </div>
          )}

          {/* Extended palette — Luxe only */}
          {plan === "luxe" && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${DS.colors.border}`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Extended palette</p>
                {!showExtended && (
                  <button onClick={loadExtendedPalette} disabled={loadingExtended} style={{ fontSize: 12, fontWeight: 600, color: DS.colors.accent, background: DS.colors.accentLight, padding: "4px 12px", borderRadius: DS.radius.full }}>
                    {loadingExtended ? "Loading..." : "See all colours"}
                  </button>
                )}
              </div>
              {showExtended && extendedPalette.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {extendedPalette.map(colour => (
                    <button key={colour.hex} onClick={() => setSelectedColour(colour)} style={{ textAlign: "center", background: "none", border: "none", padding: 0 }}>
                      <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: colour.hex, marginBottom: 4, border: colour.hex === "#FFFFFF" ? `1px solid ${DS.colors.border}` : "none" }} />
                      <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
                    </button>
                  ))}
                </div>
              )}
              {!showExtended && (
                <div style={{ display: "flex", gap: 6 }}>
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} style={{ flex: 1, aspectRatio: "1", borderRadius: 8, background: DS.colors.surface, border: `1px solid ${DS.colors.border}` }} />
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Avoid colours */}
          {plan !== "free" && <div style={{ paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Avoid</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(seasonData.palette?.avoid || []).map(colour => (
                <div key={colour.hex} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: colour.hex, marginBottom: 4, border: `1px solid ${DS.colors.border}`, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "70%", height: 1.5, background: DS.colors.danger, transform: "rotate(-45deg)", opacity: 0.7 }} />
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
                </div>
              ))}
            </div>
          </div>}
        </div>
        {categoryCards.map(card => (
          <button key={card.id} onClick={() => card.locked ? onUpgrade() : onOpenSheet(card.id)} style={{ background: card.locked ? DS.colors.surface : DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px", textAlign: "left", width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: DS.radius.md, background: card.locked ? DS.colors.border : DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={card.icon} size={16} color={card.locked ? DS.colors.textFaint : DS.colors.accent} strokeWidth={1.5} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: card.locked ? DS.colors.textFaint : DS.colors.text }}>{card.label}</span>
              </div>
              {card.locked ? (
                <span style={{ fontSize: 11, background: DS.colors.accentLight, color: DS.colors.accentDark, padding: "3px 8px", borderRadius: DS.radius.full, fontWeight: 500 }}>{card.requiredPlan}</span>
              ) : (
                <Icon name="chevronRight" size={16} color={DS.colors.textFaint} />
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: card.locked ? DS.colors.textFaint : DS.colors.textMuted, lineHeight: 1.5, paddingLeft: 38 }}>{card.teaser}</p>
          </button>
        ))}
      </div>
      {selectedColour && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setSelectedColour(null)}>
    <div style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
        <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
      </div>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: selectedColour.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: DS.colors.text }}>{selectedColour.name}</h3>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: DS.colors.textFaint }}>Your {seasonData.season} palette</p>
            <button onClick={() => navigator.clipboard.writeText(selectedColour.hex)} style={{ fontSize: 12, color: DS.colors.textFaint, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              {selectedColour.hex} · tap to copy
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  <div style={{ padding: "12px 14px", background: DS.colors.surface, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div>
      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Hex code</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: DS.colors.text }}>{selectedColour.hex}</p>
    </div>
    <button onClick={() => navigator.clipboard.writeText(selectedColour.hex)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, background: DS.colors.accentLight, fontSize: 12, color: DS.colors.accentDark, fontWeight: 600 }}>
      Copy
    </button>
  </div>
  <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6 }}>
    Show this hex code to a retailer or use it when shopping online to find your exact shade.
  </p>
</div>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

interface CheckResult {
  mode: string;
  overall_verdict?: boolean;
  overall_tip?: string;
  items: {
    piece?: string;
    category?: string;
    colour_name: string;
    hex: string;
    verdict: boolean;
    verdict_v2?: "yes" | "neutral" | "no";
    reason: string;
    tip: string;
  }[];
}

const CheckerTab = ({ seasonData, user, onUpgrade }: { seasonData: SeasonData | null; user: User | null; onUpgrade: () => void; }) => {
  const [mode, setMode] = useState<"single" | "outfit" | "makeup">("single");
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null);
  const [saveSheet, setSaveSheet] = useState<{ item: CheckResult["items"][0]; previewSrc?: string } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState("Top");
  const [saveFormality, setSaveFormality] = useState("Casual");
  const [saving, setSaving] = useState(false);
  // Makeup mode state
  const [makeupCheckMode, setMakeupCheckMode] = useState<"upload" | "name">("name");
  const [makeupProductName, setMakeupProductName] = useState("");
  const [makeupProductCategory, setMakeupProductCategory] = useState("Lip");
  const [makeupPreview, setMakeupPreview] = useState<string | null>(null);
  const [makeupChecking, setMakeupChecking] = useState(false);
  const [makeupResult, setMakeupResult] = useState<CheckResult | null>(null);
  const [saveMakeupSheet, setSaveMakeupSheet] = useState<{ item: CheckResult["items"][0]; previewSrc?: string } | null>(null);
  const [saveMakeupName, setSaveMakeupName] = useState("");
  const [saveMakeupBrand, setSaveMakeupBrand] = useState("");
  const [saveMakeupCategory, setSaveMakeupCategory] = useState("Lip");
  const [saveMakeupShade, setSaveMakeupShade] = useState("");
  const makeupFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = user?.plan || "free";
  const canAccess = plan !== "free";

  const resizeAndEncode = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const max = 1024;
        if (width > height) { if (width > max) { height = Math.round(height * max / width); width = max; } }
        else { if (height > max) { width = Math.round(width * max / height); height = max; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
      img.src = url;
    });

    const openSaveSheet = (item: CheckResult["items"][0], previewSrc?: string) => {
    const pieceToCategory: Record<string, string> = {
      Top: "Top", Knitwear: "Knitwear", Jacket: "Jackets & Coats", Coat: "Jackets & Coats",
      Bottom: "Bottoms", Dress: "Dresses & Jumpsuits", Jumpsuit: "Dresses & Jumpsuits",
      Shoes: "Shoes", Bag: "Bags", Accessory: "Accessories"
    };
    const guessedCategory = item.piece ? (pieceToCategory[item.piece] || "Top") : "Top";
    const guessedName = item.piece ? `${item.colour_name} ${item.piece.toLowerCase()}` : item.colour_name;
    setSaveName(guessedName);
    setSaveCategory(guessedCategory);
    setSaveSheet({ item, previewSrc });
  };

  const handleSaveToWardrobe = async () => {
    if (!user?.id || !saveSheet) return;
    const token = localStorage.getItem("solla_token") || SUPABASE_JWT_KEY;
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (saveSheet.previewSrc) {
        try {
          const imgRes = await fetch(saveSheet.previewSrc);
          const blob = await imgRes.blob();
          const ext = blob.type === "image/png" ? "png" : "jpg";
          const path = `${user.id}/${Date.now()}.${ext}`;
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/wardrobe-items/${path}`, {
            method: "POST",
            headers: {
              "Content-Type": blob.type,
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
            body: blob,
          });
          if (uploadRes.ok) {
            image_url = `${SUPABASE_URL}/storage/v1/object/public/wardrobe-items/${path}`;
          }
        } catch {}
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          name: saveName,
          category: saveCategory,
          formality: saveFormality,
          colour_name: saveSheet.item.colour_name,
          hex: saveSheet.item.hex,
          verdict: saveSheet.item.verdict,
          verdict_v2: saveSheet.item.verdict_v2 || (saveSheet.item.verdict ? "yes" : "no"),
          tip: saveSheet.item.tip,
          starred: false,
          image_url,
        }),
      });
    if (!res.ok) {
        const err = await res.json();
        console.error("Save error:", err);
      } else {
        setSaveSheet(null);
      }
    } catch (e) {
      console.error("Failed:", e);
    } finally {
      setSaving(false);
    }
  };
  const handleFiles = (files: FileList) => {
    const urls = Array.from(files).map(f => URL.createObjectURL(f));
    setPreviews(urls);
    setResults([]);
    setError("");
  };

  const handleCheck = async () => {
    const files = fileRef.current?.files;
    if (!files || files.length === 0 || !seasonData) return;
    setLoading(true); setError("");
    try {
      const allResults: CheckResult[] = [];
      for (let i = 0; i < files.length; i++) {
        setCheckingIndex(i);
        const file = files[i];
        const base64 = await resizeAndEncode(file);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
         body: JSON.stringify({ type: "check_item", image: base64, season: seasonData.season, mode }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        allResults.push(data);
      }
      setResults(allResults);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); setCheckingIndex(null); }
  };

  const reset = () => {
    setPreviews([]);
    setResults([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!canAccess) return (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
    <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
      <Icon name="lock" size={28} color={DS.colors.accent} />
    </div>
    <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>Colour Checker</h2>
    <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 24 }}>Photograph any item, outfit or swatches and get an instant verdict against your season — unlock with Glow.</p>
    <button onClick={onUpgrade} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Unlock Checker</button>
  </div>
);

  if (!seasonData) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "40px 28px" }}>
      <Icon name="image" size={40} color={DS.colors.border} />
      <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center" }}>Complete your colour analysis first to use the checker.</p>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", background: DS.colors.bg }}>
      <div style={{ padding: "20px 16px 0" }}>
        {/* Mode switcher */}
        <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.lg, padding: 4, marginBottom: 20, gap: 4 }}>
          {(["single", "outfit", "makeup"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); reset(); setMakeupResult(null); setMakeupPreview(null); setMakeupProductName(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: DS.radius.md, fontSize: 13, fontWeight: mode === m ? 600 : 400, color: mode === m ? DS.colors.white : DS.colors.textMuted, background: mode === m ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
              {m === "single" ? "Single" : m === "outfit" ? "Outfit" : "Makeup"}
            </button>
          ))}
        </div>

        {/* Makeup mode */}
        {mode === "makeup" && (
          <div>
            <p style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 16 }}>Check any makeup product against your colour season — at Sephora, online or at home. Enter the name for the most accurate result.</p>

            {/* Check mode toggle */}
            <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.md, padding: 3, gap: 3, marginBottom: 14 }}>
              {(["name", "upload"] as const).map(m => (
                <button key={m} onClick={() => { setMakeupCheckMode(m); setMakeupResult(null); setMakeupPreview(null); }} style={{ flex: 1, padding: "7px", borderRadius: DS.radius.sm, fontSize: 12, fontWeight: makeupCheckMode === m ? 600 : 400, color: makeupCheckMode === m ? DS.colors.white : DS.colors.textMuted, background: makeupCheckMode === m ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
                  {m === "name" ? "Enter name" : "Upload photo"}
                </button>
              ))}
            </div>

            {/* Product category */}
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: DS.colors.textMuted }}>Product type</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {["Lip", "Blush", "Foundation", "Concealer", "Bronzer", "Eye", "Highlighter", "Other"].map(cat => (
                <button key={cat} onClick={() => setMakeupProductCategory(cat)} style={{ padding: "4px 10px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: makeupProductCategory === cat ? "#C2185B" : DS.colors.surface, color: makeupProductCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                  {cat}
                </button>
              ))}
            </div>

            {makeupCheckMode === "name" ? (
              <input value={makeupProductName} onChange={e => setMakeupProductName(e.target.value)} placeholder={`e.g. "Charlotte Tilbury Pillow Talk" or "MAC Ruby Woo"`} style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
            ) : (
              <>
                <div style={{ background: DS.colors.surface, borderRadius: DS.radius.md, padding: "10px 12px", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#D97706", fontWeight: 500 }}>For any product with a known shade name — use "Enter name" instead. Photo checking is best for unknown shades swatched on your inner arm in natural daylight.</p>
                </div>
                <div onClick={() => !makeupPreview && makeupFileRef.current?.click()} style={{ borderRadius: DS.radius.lg, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: makeupPreview ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 12 }}>
                  {makeupPreview ? (
                    <>
                      <img src={makeupPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={e => { e.stopPropagation(); setMakeupPreview(null); setMakeupResult(null); if (makeupFileRef.current) makeupFileRef.current.value = ""; }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: DS.radius.full, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="x" size={14} color={DS.colors.white} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Icon name="camera" size={20} color={DS.colors.accent} />
                      <p style={{ fontSize: 12, color: DS.colors.textMuted, marginTop: 6 }}>Tap to upload swatch</p>
                    </>
                  )}
                </div>
                <input ref={makeupFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setMakeupPreview(URL.createObjectURL(f)); }} />
              </>
            )}

            <button onClick={async () => {
              if (!seasonData) return;
              if (makeupCheckMode === "name" && !makeupProductName.trim()) return;
              if (makeupCheckMode === "upload" && !makeupPreview) return;
              setMakeupChecking(true); setMakeupResult(null);
              try {
                let body: any;
                if (makeupCheckMode === "upload") {
                  const file = makeupFileRef.current?.files?.[0];
                  if (!file) return;
                  const img = new Image();
                  const url = URL.createObjectURL(file);
                  const base64 = await new Promise<string>((resolve, reject) => {
                    img.onload = () => {
                      URL.revokeObjectURL(url);
                      let { width, height } = img;
                      const max = 1024;
                      if (width > height) { if (width > max) { height = Math.round(height * max / width); width = max; } }
                      else { if (height > max) { width = Math.round(width * max / height); height = max; } }
                      const canvas = document.createElement("canvas");
                      canvas.width = width; canvas.height = height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) { reject(new Error("Canvas error")); return; }
                      ctx.drawImage(img, 0, 0, width, height);
                      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
                    };
                    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
                    img.src = url;
                  });
                  body = { type: "check_item", image: base64, season: seasonData.season, mode: "single" };
                } else {
                  const savedFoundations = localStorage.getItem(`solla_foundation_shades_${user?.id}`) || "";
                  body = {
                    type: "makeup_check_product",
                    season: seasonData.season,
                    subseason: seasonData.subseason,
                    undertone: seasonData.colour_profile?.undertone || "",
                    depth: seasonData.colour_profile?.depth || "",
                    products: [{ name: makeupProductName.trim(), category: makeupProductCategory }],
                    foundation: savedFoundations || null,
                  };
                }
                const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
                  body: JSON.stringify(body),
                });
                const data = await res.json();
                if (makeupCheckMode === "upload") {
                  setMakeupResult(data);
                } else if (data.results) {
                  setMakeupResult({ mode: "single", items: data.results.map((r: any) => ({ colour_name: r.shade || r.name, hex: r.hex || "#C4A882", verdict: r.verdict !== false, verdict_v2: r.verdict_v2 || "yes", reason: r.reason || "", tip: r.tip || "" })) });
                }
              } catch {}
              finally { setMakeupChecking(false); }
            }} disabled={makeupChecking || (makeupCheckMode === "name" ? !makeupProductName.trim() : !makeupPreview)} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: makeupChecking || (makeupCheckMode === "name" ? !makeupProductName.trim() : !makeupPreview) ? DS.colors.border : "#C2185B", color: DS.colors.white, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              {makeupChecking ? "Checking..." : "Check this product"}
            </button>

            {/* Makeup results */}
            {makeupResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                <button onClick={() => { setMakeupResult(null); setMakeupPreview(null); setMakeupProductName(""); if (makeupFileRef.current) makeupFileRef.current.value = ""; }} style={{ padding: "8px 16px", borderRadius: DS.radius.full, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, fontSize: 12, color: DS.colors.textMuted, fontWeight: 500, alignSelf: "flex-start" }}>
                  ← Check another
                </button>
                {makeupResult.items.map((item, i) => (
                  <div key={i} style={{ padding: "14px", borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, background: DS.colors.bg }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: DS.radius.full, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{item.colour_name}</p>
                        <span style={{ fontSize: 12, fontWeight: 600, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger }}>
                          {item.verdict_v2 === "yes" ? "✓ Suits your season" : item.verdict_v2 === "neutral" ? "~ Works with care" : "✗ Doesn't suit your season"}
                        </span>
                        <span style={{ fontSize: 10, color: DS.colors.textFaint, background: DS.colors.surface, padding: "1px 6px", borderRadius: DS.radius.full, display: "block", marginTop: 3 }}>
                          {makeupCheckMode === "upload" ? "Photo check — result may vary with lighting" : "Name check — high confidence"}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.reason}</p>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: DS.colors.accent, fontWeight: 500, lineHeight: 1.5 }}>{item.tip}</p>
                    {user && user.plan !== "free" && (
                      <button onClick={() => {
                        setSaveMakeupSheet({ item, previewSrc: makeupPreview || undefined });
                        setSaveMakeupName(makeupCheckMode === "name" ? makeupProductName : item.colour_name);
                        setSaveMakeupShade(item.colour_name);
                        setSaveMakeupCategory(makeupProductCategory);
                        setSaveMakeupBrand("");
                      }} style={{ padding: "6px 14px", borderRadius: DS.radius.full, background: "#FFF0F5", fontSize: 12, color: "#C2185B", fontWeight: 500 }}>
                        + Save to my kit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Save to kit sheet */}
            {saveMakeupSheet && (
              <div onClick={() => setSaveMakeupSheet(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-end" }}>
                <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }}>
                  <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
                    <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
                  </div>
                  <div style={{ padding: "16px 24px" }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Save to my kit</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 14px", borderRadius: DS.radius.md, background: DS.colors.surface }}>
                      <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: saveMakeupSheet.item.hex, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 13, color: DS.colors.text }}>{saveMakeupSheet.item.colour_name}</p>
                    </div>
                    <input value={saveMakeupName} onChange={e => setSaveMakeupName(e.target.value)} placeholder="Product name" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 10, fontFamily: DS.font }} />
                    <input value={saveMakeupBrand} onChange={e => setSaveMakeupBrand(e.target.value)} placeholder="Brand (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 10, fontFamily: DS.font }} />
                    <input value={saveMakeupShade} onChange={e => setSaveMakeupShade(e.target.value)} placeholder="Shade name (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
                    <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Category</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                      {["Lip", "Blush", "Foundation", "Concealer", "Bronzer", "Eye", "Highlighter", "Other"].map(cat => (
                        <button key={cat} onClick={() => setSaveMakeupCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: saveMakeupCategory === cat ? "#C2185B" : DS.colors.surface, color: saveMakeupCategory === cat ? DS.colors.white : DS.colors.textMuted }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                    <button onClick={async () => {
                      if (!user?.id || !saveMakeupName.trim()) return;
                      const token = localStorage.getItem("solla_token");
                      let image_url: string | null = null;
                      if (saveMakeupSheet.previewSrc) {
                        try {
                          const imgRes = await fetch(saveMakeupSheet.previewSrc);
                          const blob = await imgRes.blob();
                          const ext = blob.type === "image/png" ? "png" : "jpg";
                          const path = `${user.id}/makeup/${Date.now()}.${ext}`;
                          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/wardrobe-items/${path}`, {
                            method: "POST",
                            headers: { "Content-Type": blob.type, apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` },
                            body: blob,
                          });
                          if (uploadRes.ok) image_url = `${SUPABASE_URL}/storage/v1/object/public/wardrobe-items/${path}`;
                        } catch {}
                      }
                      const res = await fetch(`${SUPABASE_URL}/rest/v1/makeup_items`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}`, Prefer: "return=minimal" },
                        body: JSON.stringify({
                          user_id: user.id, name: saveMakeupName.trim(), brand: saveMakeupBrand.trim() || null,
                          category: saveMakeupCategory, shade_name: saveMakeupShade.trim() || null,
                          hex: saveMakeupSheet.item.hex, verdict_v2: saveMakeupSheet.item.verdict_v2 || "yes",
                          verdict: saveMakeupSheet.item.verdict, tip: saveMakeupSheet.item.tip, image_url, starred: false,
                        }),
                      });
                      if (res.ok) setSaveMakeupSheet(null);
                    }} disabled={!saveMakeupName.trim()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !saveMakeupName.trim() ? DS.colors.border : "#C2185B", color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                      Save to my kit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode description — single/outfit only */}
        {mode !== "makeup" && <p style={{ fontSize: 13, color: DS.colors.textFaint, marginBottom: 16, lineHeight: 1.5 }}>
          {mode === "single" && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6, margin: "0 0 6px" }}>Upload one item or multiple items at once — Solla checks each colour separately. Photograph your actual garment in natural light against a plain background for the most accurate result. You can also upload multiple items in one go.</p>
              <p style={{ fontSize: 12, color: "#D97706", margin: 0, lineHeight: 1.5 }}>Avoid website or sales photos — they're often colour-corrected and will give a less accurate reading than your own photo.</p>
            </div>
          )}
          {mode === "outfit" && "Upload a full outfit photo for an overall verdict and per-piece breakdown. Photograph in natural light for the most accurate colour reading."}
        </p>}

        {/* Upload area — single/outfit only */}
        {mode !== "makeup" && results.length === 0 && (
          <div
            onClick={() => previews.length === 0 && fileRef.current?.click()}
            style={{ borderRadius: DS.radius.xl, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: previews.length > 0 ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 16, height: 220 }}
          >
            {previews.length > 0 ? (
              <>
                <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt={`preview ${i + 1}`} style={{ flex: 1, minWidth: 0, height: "100%", objectFit: "cover" }} />
                  ))}
                </div>
                <button onClick={e => { e.stopPropagation(); reset(); }} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: DS.radius.full, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={16} color={DS.colors.white} />
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 52, height: 52, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon name="camera" size={24} color={DS.colors.accent} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, color: DS.colors.text, marginBottom: 4 }}>Upload photo</p>
                <p style={{ fontSize: 12, color: DS.colors.textFaint }}>Tap to choose</p>
              </>
            )}
          </div>
        )}

        {mode !== "makeup" && <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }} />}

        {/* CTA — single/outfit only */}
        {mode !== "makeup" && previews.length > 0 && results.length === 0 && (
          <button onClick={handleCheck} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: loading ? DS.colors.textFaint : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {loading ? (checkingIndex !== null && previews.length > 1 ? `Checking ${checkingIndex + 1} of ${previews.length}...` : "Checking...") : "Check this"}
          </button>
        )}

        {error && <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm, marginBottom: 16 }}>{error}</p>}

        {/* Save to Wardrobe Sheet */}
        {saveSheet && (
          <div onClick={() => setSaveSheet(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-end" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }}>
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
                <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
              </div>
              <div style={{ padding: "16px 24px" }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Save to wardrobe</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", borderRadius: DS.radius.md, background: saveSheet.item.verdict ? "#F0FDF4" : "#FEF2F2" }}>
                  <div style={{ width: 36, height: 36, borderRadius: DS.radius.sm, background: saveSheet.item.hex, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{saveSheet.item.colour_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: DS.colors.textMuted }}>{saveSheet.item.verdict ? "✓ Suits your season" : "✗ Doesn't suit your season"}</p>
                  </div>
                </div>
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Item name" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {["Top", "Knitwear", "Jackets & Coats", "Bottoms", "Dresses & Jumpsuits", "Shoes", "Bags", "Accessories"].map(cat => (
                    <button key={cat} onClick={() => setSaveCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: saveCategory === cat ? DS.colors.accent : DS.colors.surface, color: saveCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                      {cat}
                    </button>
                  ))}
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Formality</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                  {["Casual", "Smart casual", "Work", "Formal", "Active"].map(f => (
                    <button key={f} onClick={() => setSaveFormality(f)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: saveFormality === f ? DS.colors.accent : DS.colors.surface, color: saveFormality === f ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={handleSaveToWardrobe} disabled={!saveName.trim() || saving} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !saveName.trim() ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                  {saving ? "Saving..." : "Save to wardrobe"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Lightbox */}
        {lightboxSrc && (
          <div onClick={() => setLightboxSrc(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <img src={lightboxSrc} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: DS.radius.lg, objectFit: "contain" }} />
            <button onClick={() => setLightboxSrc(null)} style={{ position: "absolute", top: 48, right: 20, width: 36, height: 36, borderRadius: DS.radius.full, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={18} color={DS.colors.white} />
            </button>
          </div>
        )}

        {/* Results */}
        {mode !== "makeup" && results.length > 0 && results.map((result, idx) => (
          <div key={idx} style={{ marginBottom: 32 }}>
            {previews[idx] && <img src={previews[idx]} alt={`item ${idx + 1}`} onClick={() => setLightboxSrc(previews[idx])} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: DS.radius.lg, marginBottom: 12, cursor: "pointer" }} />}
            {/* Outfit overall verdict */}
            {result.mode === "outfit" && (
              <div style={{ background: result.overall_verdict ? "#F0FDF4" : "#FEF2F2", borderRadius: DS.radius.lg, padding: "14px 16px", marginBottom: 16, borderLeft: `3px solid ${result.overall_verdict ? DS.colors.success : DS.colors.danger}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Icon name={result.overall_verdict ? "check" : "x"} size={16} color={result.overall_verdict ? DS.colors.success : DS.colors.danger} strokeWidth={2.5} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: result.overall_verdict ? DS.colors.success : DS.colors.danger }}>{result.overall_verdict ? "This outfit works" : "This outfit needs work"}</span>
                </div>
                {result.overall_tip && <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{result.overall_tip}</p>}
              </div>
            )}

            {/* Thumbnail */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{result.items.length} colour{result.items.length !== 1 ? "s" : ""} analysed</p>
                <p style={{ margin: 0, fontSize: 12, color: DS.colors.textFaint }}>{result.items.filter(i => i.verdict).length} of {result.items.length} suit your {seasonData.season} season</p>
              </div>
              {idx === results.length - 1 && (
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <button onClick={reset} style={{ fontSize: 13, color: DS.colors.accent, fontWeight: 500, padding: "6px 12px", borderRadius: DS.radius.full, border: `1px solid ${DS.colors.accentLight}`, background: DS.colors.accentLight }}>
                    Check more
                  </button>
                  <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint }}>Not accurate? Try in better light.</p>
                </div>
              )}
            </div>

            {/* Item cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.items.map((item, i) => (
                <div key={i} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: DS.radius.md, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {item.piece && <span style={{ fontSize: 11, color: DS.colors.textFaint, fontWeight: 500 }}>{item.piece} · </span>}
                        <span style={{ fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{item.colour_name}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: DS.radius.full, background: item.verdict_v2 === "yes" ? "#F0FDF4" : item.verdict_v2 === "neutral" ? "#FFFBEB" : "#FEF2F2", flexShrink: 0 }}>
                      <Icon name={item.verdict_v2 === "yes" ? "check" : item.verdict_v2 === "neutral" ? "info" : "x"} size={12} color={item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger} strokeWidth={2.5} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger }}>{item.verdict_v2 === "yes" ? "Yes" : item.verdict_v2 === "neutral" ? "Neutral" : "No"}</span>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.reason}</p>
                  <p style={{ margin: 0, fontSize: 13, color: DS.colors.accent, lineHeight: 1.5, fontWeight: 500 }}>{item.tip}</p>
{user?.plan === "luxe" && (
  <button onClick={() => openSaveSheet(item, previews[idx])} style={{ marginTop: 8, padding: "6px 14px", borderRadius: DS.radius.full, background: DS.colors.accentLight, fontSize: 12, color: DS.colors.accentDark, fontWeight: 500 }}>
    + Save to wardrobe
  </button>
)}
{user?.plan === "glow" && (
  <button onClick={onUpgrade} style={{ marginTop: 8, padding: "8px 14px", borderRadius: DS.radius.full, background: "#FFF7ED", border: `1px solid #C26B3A`, display: "flex", alignItems: "center", gap: 6 }}>
    <Icon name="lock" size={12} color="#C26B3A" strokeWidth={2} />
    <span style={{ fontSize: 12, color: "#C26B3A", fontWeight: 600 }}>Save to wardrobe — unlock with Luxe</span>
  </button>
)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
const MeTab = ({ user, seasonData, onSignOut, onReanalyse, onUpgrade, onOpenFaq }: {
  user: User | null; seasonData: SeasonData | null;
  onSignOut: () => void; onReanalyse: () => void; onUpgrade: () => void; onOpenFaq: (sheet?: Sheet) => void;
}) => {
  const [showReanalyseWarning, setShowReanalyseWarning] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activePill, setActivePill] = useState<{ label: string; value: string; description: string } | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("solla_token");
    if (!token || !user?.id) return;
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=referral_code,referral_count`, {
      headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(async data => {
      if (data?.[0]) {
        let code = data[0].referral_code;
        if (!code) {
          code = (user.name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6) || "USER") + Math.floor(1000 + Math.random() * 9000);
          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
            method: "PATCH",
            headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
            body: JSON.stringify({ referral_code: code }),
          });
        }
        setReferralCode(code);
        setReferralCount(data[0].referral_count || 0);
      }
    }).catch(() => {});
  }, [user?.id]);

  const handleCancelSubscription = async () => {
  setCancelling(true);
  try {
    const token = localStorage.getItem("solla_token");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
      body: JSON.stringify({ type: "cancel_subscription", user_id: user?.id }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const updatedUser = { ...user!, plan: "free" as Plan };
    localStorage.setItem("solla_user", JSON.stringify(updatedUser));
    // Save cancelled_at
    const cancelToken = localStorage.getItem("solla_token");
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user?.id}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders, Authorization: `Bearer ${cancelToken || SUPABASE_JWT_KEY}`, Prefer: "return=minimal" },
      body: JSON.stringify({ cancelled_at: new Date().toISOString() }),
    }).catch(() => {});
    setShowCancelConfirm(false);
    alert("Your subscription has been cancelled. You'll keep access until the end of your billing period.");
  } catch (e) {
    alert("Something went wrong. Please email hello@solla.com.au to cancel.");
  } finally {
    setCancelling(false);
  }
};
  const planColors: Record<Plan, string> = { free: DS.colors.textFaint, glow: DS.colors.accent, luxe: "#C26B3A" };
  const planLabel: Record<Plan, string> = { free: "Free", glow: "Glow", luxe: "Luxe" };
  const plan = user?.plan || "free";

  const copyReferral = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    });
  };

  const planFeatures: Record<Plan, string[]> = {
    free: ["Your colour season", "4 best colours to wear now", "Your season headline", "Daily colour tip"],
    glow: ["Your subseason", "Full colour palette", "Colour profile — undertone, depth, chroma, contrast", "Makeup guide — foundation, blush, lips, eyes", "Hair colour guide", "Jewellery — metals and stones", "Colour checker"],
    luxe: ["Everything in Glow", "Daily outfit suggestions — wake up knowing what to wear", "Style & Fit guide — silhouettes, patterns, fabrics", "Extended palette — 24+ colours", "Wardrobe builder — see what actually works", "Outfit creator — build looks you know will land", "AI stylist chat — ask anything, get dressed faster", "Capsule wardrobe analysis"],
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: DS.colors.bg }}>
      {/* Profile header */}
      <div style={{ padding: "40px 24px 24px", background: DS.colors.surface, borderBottom: `1px solid ${DS.colors.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: DS.radius.full, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="user" size={24} color={DS.colors.accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: DS.colors.text, letterSpacing: "-0.3px" }}>{user?.name || "Guest"}</p>
            <p style={{ margin: "2px 0 6px", fontSize: 13, color: DS.colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</p>
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: planColors[plan], background: plan === "free" ? DS.colors.surface : plan === "glow" ? DS.colors.accentLight : "#FFF7ED", padding: "2px 10px", borderRadius: DS.radius.full, border: `1px solid ${planColors[plan]}30` }}>
              {planLabel[plan]} plan
            </span>
          </div>
        </div>
        {seasonData && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: "10px 14px", background: DS.colors.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}`, display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon name="sparkles" size={14} color={DS.colors.accent} />
              <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{seasonData.season} · {seasonData.subseason}</span>
            </div>
            {seasonData.colour_profile && (
              <div style={{ padding: "12px 14px", background: DS.colors.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}` }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Your colour profile</p>
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{seasonData.colour_profile.defining_quality}</p>
                {plan === "free" && (
                  <button onClick={onUpgrade} style={{ width: "100%", padding: "10px 14px", background: DS.colors.accentLight, borderRadius: DS.radius.md, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: DS.colors.accent }}>Unlock your full colour profile</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.colors.accentDark }}>Undertone · Depth · Chroma · Contrast</p>
                    </div>
                    <Icon name="lock" size={14} color={DS.colors.accent} strokeWidth={2} />
                  </button>
                )}
                {plan !== "free" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {[
                    { label: "Undertone", value: seasonData.colour_profile.undertone, description: `Your undertone is ${seasonData.colour_profile.undertone.toLowerCase()} - ${seasonData.colour_profile.undertone === "Warm" ? "meaning your skin has golden or yellow hints beneath the surface. Warm undertones harmonise best with earthy, golden and rich colour families. Gold jewellery, camel, terracotta and olive will all work beautifully with your natural colouring." : seasonData.colour_profile.undertone === "Cool" ? "meaning your skin has pink or blue hints beneath the surface. Cool undertones harmonise best with jewel tones, icy shades and blue-based colours. Silver jewellery, navy, berry and soft whites will all complement your natural colouring." : "meaning your skin has a balance of both warm and cool hints. Neutral undertones are versatile - you can wear both warm and cool colours, making you one of the more flexible seasonal types to dress."}` },
                    { label: "Depth", value: seasonData.colour_profile.depth, description: `Your depth is ${seasonData.colour_profile.depth.toLowerCase()} — ${seasonData.colour_profile.depth === "Light" ? "meaning your overall colouring is soft and delicate. You look most radiant in lighter, softer shades that don't overpower your natural features. Heavy, very dark colours worn near your face can overwhelm your complexion." : seasonData.colour_profile.depth === "Deep" ? "meaning your overall colouring is rich and striking. You can carry deep, saturated colours that lighter colouring cannot - dark navy, rich chocolate, and bold jewel tones will enhance your natural intensity." : "meaning your colouring sits between light and deep. You have the most flexibility with depth - you can wear both medium-toned and moderately deep colours without being overwhelmed or washed out."}` },
                    { label: "Chroma", value: seasonData.colour_profile.chroma, description: `Your chroma is ${seasonData.colour_profile.chroma.toLowerCase()} — ${seasonData.colour_profile.chroma === "Bright" ? "meaning your features are vivid and clear. You come alive in bold, saturated colours that match your natural vibrancy. Muted or dusty shades can make you look flat - you need clarity and intensity in your palette." : seasonData.colour_profile.chroma === "Muted" || seasonData.colour_profile.chroma === "Soft" ? "meaning your features have a gentle, blended quality. You look most harmonious in toned-down, less saturated shades. Very bright or highly saturated colours can look jarring against your naturally soft colouring - choose dusty, earthy or muted versions of colours instead." : "meaning your colouring has a balanced level of saturation. You suit colours that are neither extremely bright nor heavily muted - look for colours with a natural, grounded quality."}` },
                    { label: "Contrast", value: seasonData.colour_profile.contrast, description: `Your contrast is ${seasonData.colour_profile.contrast.toLowerCase()} — ${seasonData.colour_profile.contrast === "High" ? "meaning there is a strong difference between your hair, skin and eye colour. You look striking in bold colour combinations and strong patterns. Tonal, blended outfits can make you look washed out - you need some contrast between your pieces to match your natural intensity." : seasonData.colour_profile.contrast === "Low" ? "meaning your hair, skin and eyes are similar in tone. You look most harmonious in tonal, blended outfits where pieces are close in value. Very high contrast combinations like stark black and white can overpower your naturally soft, blended colouring." : "meaning your features have a moderate level of contrast. You suit both tonal combinations and moderately contrasting outfits - you have more flexibility than very high or very low contrast types."}` },
                  ].map(item => (
                    <button key={item.label} onClick={() => setActivePill(item)} style={{ padding: "3px 10px", background: DS.colors.accentLight, borderRadius: DS.radius.full, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: DS.colors.accentDark, fontWeight: 500 }}>{item.label}: {item.value}</span>
                      <Icon name="info" size={10} color={DS.colors.accent} strokeWidth={2} />
                    </button>
                  ))}
                </div>}

                {/* Pill explanation modal */}
                {activePill && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePill(null)}>
                    <div style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "24px 24px 48px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: DS.colors.accentLight, borderRadius: DS.radius.full, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: DS.colors.accentDark, fontWeight: 600 }}>{activePill.label}: {activePill.value}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.7 }}>{activePill.description}</p>
                    </div>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6 }}>{seasonData.colour_profile.season_description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Plan card */}
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Your plan</p>
            {plan !== "luxe" && (
              <button onClick={onUpgrade} style={{ fontSize: 12, fontWeight: 600, color: DS.colors.accent, background: DS.colors.accentLight, padding: "4px 12px", borderRadius: DS.radius.full }}>
                Upgrade
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {planFeatures[plan].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="check" size={13} color={planColors[plan]} strokeWidth={2.5} />
                <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{f}</span>
              </div>
            ))}
         {plan !== "free" && (
            <button onClick={() => setShowCancelConfirm(true)} style={{ marginTop: 12, padding: "8px 16px", borderRadius: DS.radius.full, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, fontSize: 12, color: DS.colors.textMuted, fontWeight: 500 }}>
              Cancel subscription
             </button>
           )}
          </div>
        </div>

        {/* Referral card */}
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="gift" size={16} color={DS.colors.accent} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Refer a friend</p>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>Share your code and help a friend discover their season.</p>
          {referralCode ? (
            <button onClick={copyReferral} style={{ width: "100%", padding: "12px 16px", borderRadius: DS.radius.md, background: DS.colors.surface, border: `1.5px dashed ${DS.colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: DS.colors.accent, letterSpacing: "0.05em" }}>{referralCode}</span>
              <span style={{ fontSize: 12, color: referralCopied ? DS.colors.success : DS.colors.textMuted, fontWeight: 500 }}>{referralCopied ? "Copied!" : "Tap to copy"}</span>
            </button>
          ) : (
            <div style={{ padding: "12px 16px", borderRadius: DS.radius.md, background: DS.colors.surface, fontSize: 13, color: DS.colors.textFaint }}>Loading code...</div>
          )}
          {referralCount > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: DS.colors.textMuted }}>{referralCount} friend{referralCount !== 1 ? "s" : ""} referred</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, overflow: "hidden" }}>
  <button onClick={() => onOpenFaq("faq")} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
    <Icon name="info" size={18} color={DS.colors.text} />
    <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.text }}>Colour theory & FAQ</span>
    <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={16} color={DS.colors.textFaint} /></span>
  </button>
  <button onClick={() => window.location.href = "mailto:hello@solla.com.au?subject=Solla Support"} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
    <Icon name="bell" size={18} color={DS.colors.text} />
    <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.text }}>Contact support</span>
    <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={16} color={DS.colors.textFaint} /></span>
  </button>
  <button onClick={() => setShowReanalyseWarning(true)} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
            <Icon name="refresh" size={18} color={DS.colors.text} />
            <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.text }}>Re-analyse my colours</span>
            <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={16} color={DS.colors.textFaint} /></span>
          </button>
          <button onClick={onSignOut} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="logout" size={18} color={DS.colors.danger} />
            <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.danger }}>Sign out</span>
          </button>
          <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, overflow: "hidden", marginTop: 12 }}>
    {[
  { label: "Privacy Policy", sheet: "privacy" as Sheet },
  { label: "Terms of Service", sheet: "terms" as Sheet },
  { label: "Cookie Policy", sheet: "cookies" as Sheet },
].map((link, i, arr) => (
  <button key={link.label} onClick={() => onOpenFaq(link.sheet)} style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: i < arr.length - 1 ? `1px solid ${DS.colors.border}` : "none", background: "none", textAlign: "left" }}>
    <span style={{ fontSize: 14, color: DS.colors.text }}>{link.label}</span>
    <Icon name="chevronRight" size={16} color={DS.colors.textFaint} />
  </button>
))}
</div>
        </div>
      </div>

      {showCancelConfirm && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }} onClick={() => setShowCancelConfirm(false)}>
    <div style={{ background: DS.colors.bg, borderRadius: DS.radius.xl, padding: "28px 24px", width: "100%" }} onClick={e => e.stopPropagation()}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.3px" }}>Before you cancel...</h3>
      <p style={{ fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Would you like to pause your subscription for a month instead? You won't be charged and your wardrobe and colour profile will be waiting when you're back.</p>
      <button onClick={async () => {
        setCancelling(true);
        try {
          const token = localStorage.getItem("solla_token");
          const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
            body: JSON.stringify({ type: "pause_subscription", user_id: user?.id }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setShowCancelConfirm(false);
          alert("Your subscription has been paused for one month. We'll resume it automatically after that — you can cancel anytime.");
        } catch {
          alert("Something went wrong pausing your subscription. Please email hello@solla.com.au for help.");
        } finally { setCancelling(false); }
      }} disabled={cancelling} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 15, fontWeight: 600, marginBottom: 10, opacity: cancelling ? 0.7 : 1 }}>
        {cancelling ? "Pausing..." : "Pause for 1 month instead"}
      </button>
      <button onClick={handleCancelSubscription} disabled={cancelling} style={{ width: "100%", padding: "12px", borderRadius: DS.radius.lg, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.danger, fontWeight: 500, marginBottom: 8, opacity: cancelling ? 0.7 : 1 }}>
        {cancelling ? "Cancelling..." : "No, cancel my subscription"}
      </button>
      <button onClick={() => setShowCancelConfirm(false)} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Keep my subscription</button>
    </div>
  </div>
)}
      {/* Re-analyse warning */}
      {showReanalyseWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }} onClick={() => setShowReanalyseWarning(false)}>
          <div style={{ background: DS.colors.bg, borderRadius: DS.radius.xl, padding: "28px 24px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.3px" }}>Re-analyse your colours?</h3>
            <p style={{ fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 24 }}>Your current season results will be cleared and you'll need to upload a new selfie. This cannot be undone.</p>
            <button onClick={onReanalyse} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Yes, re-analyse</button>
            <button onClick={() => setShowReanalyseWarning(false)} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
const WardrobeTab = ({ user, seasonData, onUpgrade, onSignUp, isGuest }: { user: User | null; seasonData: SeasonData | null; onUpgrade: () => void; onSignUp?: () => void; isGuest?: boolean; }) => {
  const plan = user?.plan || "free";
  const canAccess = true;
  const freeItemLimit = 3;
  const isFreePlan = plan === "free";

  const [view, setView] = useState<"items" | "outfits" | "plan" | "makeup" | "chat">("items");
const [weeklyPlan, setWeeklyPlan] = useState<{ day: string; coat: string | null; base: string; shoes: string; accessories: string; locked: boolean; item_ids?: string[]; }[]>(() => {
  try {
    const saved = localStorage.getItem(`solla_weekly_plan_${user?.id}`);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
});
const [loadingPlan, setLoadingPlan] = useState(false);
const [planGenerated, setPlanGenerated] = useState(() => {
  try {
    return !!localStorage.getItem(`solla_weekly_plan_${user?.id}`);
  } catch { return false; }
});
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [editOutfitName, setEditOutfitName] = useState("");
  const [editOutfitCategory, setEditOutfitCategory] = useState("Casual");
  const [editOutfitItemIds, setEditOutfitItemIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStarred, setFilterStarred] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [gridView, setGridView] = useState(false);
  const [filterVerdict, setFilterVerdict] = useState<"yes" | "neutral" | "no" | null>(null);
  const [filterOutfitCategory, setFilterOutfitCategory] = useState("All");
  const [planItemSelector, setPlanItemSelector] = useState<string | null>(null);
  const [planItemSearch, setPlanItemSearch] = useState("");
  const [planItemCategoryFilter, setPlanItemCategoryFilter] = useState("All");
  const [pendingPlanItemIds, setPendingPlanItemIds] = useState<string[]>([]);
  const [makeupItems, setMakeupItems] = useState<MakeupItem[]>([]);
  const [makeupLoading, setMakeupLoading] = useState(false);
  const [makeupOnboarded, setMakeupOnboarded] = useState(() => !!localStorage.getItem(`solla_makeup_onboarded_${user?.id}`));
  const [makeupOnboardingStep, setMakeupOnboardingStep] = useState(0);
  const [makeupFoundationShades, setMakeupFoundationShades] = useState<string[]>([""]);
  const [makeupConcealerShades, setMakeupConcealerShades] = useState<string[]>([""]);
  const [makeupFilterCategory, setMakeupFilterCategory] = useState("All");
  const [makeupCheckMode, setMakeupCheckMode] = useState<"upload" | "name">("upload");
  const [makeupProductName, setMakeupProductName] = useState("");
  const [makeupProductCategory, setMakeupProductCategory] = useState("Lip");
  const [makeupCheckResult, setMakeupCheckResult] = useState<CheckResult | null>(null);
  const [makeupChecking, setMakeupChecking] = useState(false);
  const [makeupPreview, setMakeupPreview] = useState<string | null>(null);
  const [saveMakeupSheet, setSaveMakeupSheet] = useState<{ item: CheckResult["items"][0]; previewSrc?: string } | null>(null);
  const [saveMakeupName, setSaveMakeupName] = useState("");
  const [saveMakeupBrand, setSaveMakeupBrand] = useState("");
  const [saveMakeupCategory, setSaveMakeupCategory] = useState("Lip");
  const [saveMakeupShade, setSaveMakeupShade] = useState("");
  const makeupFileRef = useRef<HTMLInputElement>(null);

  // Add item form
  const [itemPrice, setItemPrice] = useState("");
  const [itemChecking, setItemChecking] = useState(false);
  const [itemCheckingIndex, setItemCheckingIndex] = useState<number | null>(null);
  const [itemResults, setItemResults] = useState<{ colour_name: string; hex: string; verdict: boolean; verdict_v2?: "yes" | "neutral" | "no"; tip: string; piece?: string }[]>([]);
  const [itemPreviews, setItemPreviews] = useState<string[]>([]);
  const [itemNames, setItemNames] = useState<string[]>([]);
  const [itemCategories, setItemCategories] = useState<string[]>([]);
  const [itemFormalities, setItemFormalities] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Add outfit form
  const [outfitName, setOutfitName] = useState("");
  const [outfitCategory, setOutfitCategory] = useState("Casual");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Pick up prefill from Season tab "Style with AI" button
  useEffect(() => {
    const prefill = localStorage.getItem("solla_stylist_prefill");
    if (prefill) {
      setView("chat");
      setChatInput(prefill);
      localStorage.removeItem("solla_stylist_prefill");
    }
  }, []);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const categories = ["All", "Top", "Knitwear", "Jackets & Coats", "Bottoms", "Dresses & Jumpsuits", "Shoes", "Bags", "Accessories"];
  const getAuthHeaders = () => {
  const token = localStorage.getItem("solla_token");
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_JWT_KEY}`
  };
};
  useEffect(() => {
    if (!user?.id) return;
    loadItems();
    if (plan !== "free") {
      loadOutfits();
    }
    loadMakeupItems();
  }, [user?.id, plan]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadItems = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?user_id=eq.${user!.id}&order=created_at.desc`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
        localStorage.setItem(`solla_wardrobe_count_${user!.id}`, data.length.toString());
      }
    } catch {}
  };

  const loadMakeupItems = async () => {
    try {
      const token = localStorage.getItem("solla_token");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/makeup_items?user_id=eq.${user!.id}&order=created_at.desc`, {
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setMakeupItems(data);
    } catch {}
  };
  const loadOutfits = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits?user_id=eq.${user!.id}&order=created_at.desc`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) setOutfits(data);
    } catch {}
  };

  const resizeAndEncode = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const max = 1024;
        if (width > height) { if (width > max) { height = Math.round(height * max / width); width = max; } }
        else { if (height > max) { width = Math.round(width * max / height); height = max; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
      img.src = url;
    });

  const uploadToStorage = async (file: File, userId: string): Promise<string | null> => {
    try {
      let uploadFile = file;
      const ext = uploadFile.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/wardrobe-items/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": uploadFile.type,
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${localStorage.getItem("solla_token") || SUPABASE_JWT_KEY}`,
        },
        body: uploadFile,
      });
      if (!res.ok) return null;
      return `${SUPABASE_URL}/storage/v1/object/public/wardrobe-items/${path}`;
    } catch { return null; }
  };

  const handleItemPhotos = async (files: FileList) => {
    const previews = Array.from(files).map(f => URL.createObjectURL(f));
    setItemPreviews(previews);
    setItemResults([]);
    setItemNames([]);
    setItemCategories([]);
    setItemFormalities([]);
    if (!seasonData) return;
    setItemChecking(true);

    const pieceToCategory: Record<string, string> = {
      Top: "Top", Knitwear: "Knitwear", Jacket: "Jackets & Coats", Coat: "Jackets & Coats",
      Bottom: "Bottoms", Dress: "Dresses & Jumpsuits", Jumpsuit: "Dresses & Jumpsuits",
      Shoes: "Shoes", Bag: "Bags", Accessory: "Accessories"
    };
    try {
      const results: { colour_name: string; hex: string; verdict: boolean; tip: string; piece?: string }[] = [];
      const names: string[] = [];
      const cats: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setItemCheckingIndex(i);
        const base64 = await resizeAndEncode(files[i]);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
          body: JSON.stringify({ type: "check_item", image: base64, season: seasonData.season, mode: "single" }),
        });
        const data = await res.json();
        const item = data.items?.[0];
        if (item) {
          results.push(item);
          names.push(item.piece ? `${item.colour_name} ${item.piece.toLowerCase()}` : item.colour_name);
          cats.push(item.piece ? (pieceToCategory[item.piece] || "Top") : "Top");
          setItemFormalities(prev => [...prev, "Casual"]);
        }
      }
      setItemResults(results);
      setItemNames(names);
      setItemCategories(cats);
    } catch {}
    finally { setItemChecking(false); setItemCheckingIndex(null); }
  };

  const handleAddItems = async () => {
    if (!itemResults.length || !user?.id) return;
    setLoading(true);
    try {
      const fileList = fileRef.current?.files;
      for (let i = 0; i < itemResults.length; i++) {
        const result = itemResults[i];
        let image_url: string | null = null;
        if (fileList?.[i]) {
          image_url = await uploadToStorage(fileList[i], user.id);
        }
        const newItem = {
          user_id: user.id,
          name: (itemNames[i] || result.colour_name).trim(),
          category: itemCategories[i] || "Top",
          formality: itemFormalities[i] || "Casual",
          colour_name: result.colour_name,
          hex: result.hex,
          verdict: result.verdict,
          verdict_v2: result.verdict_v2 || (result.verdict ? "yes" : "no"),
          tip: result.tip,
          starred: false,
          price: null,
          image_url,
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items`, {
          method: "POST",
          headers: { ...getAuthHeaders(), Prefer: "return=representation" },
          body: JSON.stringify(newItem),
        });
        const data = await res.json();
        if (Array.isArray(data)) setItems(prev => [data[0], ...prev]);
      }
      setShowAddItem(false);
      setItemPreviews([]); setItemResults([]); setItemNames([]); setItemCategories([]);
      setItemPrice("");
      if (fileRef.current) fileRef.current.value = "";
    } catch {}
    finally { setLoading(false); }
  };

  const handleToggleStar = async (item: WardrobeItem) => {
    const updated = { ...item, starred: !item.starred };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.${item.id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ starred: updated.starred }),
    }).catch(() => {});
  };
const handleDeleteOutfit = async (id: string) => {
  if (!window.confirm("Delete this outfit? This can't be undone.")) return;
  setOutfits(prev => prev.filter(o => o.id !== id));
  await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  }).catch(() => {});
};
  const handleDeleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.${id}`, {
      method: "DELETE", headers: getAuthHeaders(),
    }).catch(() => {});
  };
  const handleEditItem = async () => {
  if (!editingItem || !editName.trim()) return;
  const updated = { ...editingItem, name: editName, category: editCategory };
  setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
  await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.${editingItem.id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ name: editName, category: editCategory, formality: editingItem.formality }),
  }).catch(() => {});
  setEditingItem(null);
};
  const handleAddOutfit = async () => {
    if (!outfitName.trim() || selectedItemIds.length < 2 || !user?.id) return;
    setLoading(true);
    try {
      const outfitItems = items.filter(i => selectedItemIds.includes(i.id));
      const overall_verdict = outfitItems.filter(i => i.verdict).length >= outfitItems.length / 2;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits`, {
        method: "POST",
        headers: { ...getAuthHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, name: outfitName.trim(), item_ids: selectedItemIds, overall_verdict, starred: false, category: outfitCategory }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setOutfits(prev => [data[0], ...prev]);
      setShowAddOutfit(false); setOutfitName(""); setSelectedItemIds([]);
    } catch {}
    finally { setLoading(false); }
  };
const handleEditOutfit = async () => {
    if (!editingOutfit || !editOutfitName.trim()) return;
    setLoading(true);
    try {
      const outfitItems = items.filter(i => editOutfitItemIds.includes(i.id));
      const overall_verdict = outfitItems.filter(i => (i.verdict_v2 || (i.verdict ? "yes" : "no")) !== "no").length >= outfitItems.length / 2;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${editingOutfit.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({ name: editOutfitName.trim(), item_ids: editOutfitItemIds, overall_verdict, category: editOutfitCategory }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setOutfits(prev => prev.map(o => o.id === editingOutfit.id ? data[0] : o));
      else setOutfits(prev => prev.map(o => o.id === editingOutfit.id ? { ...o, name: editOutfitName.trim(), item_ids: editOutfitItemIds, overall_verdict } : o));
      setEditingOutfit(null);
    } catch {}
    finally { setLoading(false); }
  };
  const handleToggleOutfitStar = async (outfit: Outfit) => {
    const updated = { ...outfit, starred: !outfit.starred };
    setOutfits(prev => prev.map(o => o.id === outfit.id ? updated : o));
    await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${outfit.id}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ starred: updated.starred }),
    }).catch(() => {});
  };

  const regenerateDay = async (dayName: string) => {
    if (!seasonData) return;
    const wardrobeContext = items.filter(i => (i.verdict_v2 || (i.verdict ? "yes" : "no")) !== "no")
      .map(i => `${i.name} (${i.category}${i.formality ? `, ${i.formality}` : ""})`).join(", ");
    setWeeklyPlan(prev => prev.map(d => d.day === dayName ? { ...d, base: "Regenerating..." } : d));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({
          type: "weather_outfit",
          season: seasonData.season,
          palette: (seasonData.palette?.best || []).map((c: PaletteColour) => c.name).slice(0, 4).join(", "),
          temp: 18,
          desc: "mild",
          wardrobe: wardrobeContext,
        }),
      });
      const data = await res.json();
      if (data.outfit) {
        try {
          const parsed = JSON.parse(data.outfit);
          setWeeklyPlan(prev => {
            const updated = prev.map(d => d.day === dayName ? { ...d, coat: parsed.coat || null, base: parsed.base || d.base, shoes: parsed.shoes || d.shoes, accessories: parsed.accessories || d.accessories } : d);
            localStorage.setItem(`solla_weekly_plan_${user?.id}`, JSON.stringify(updated));
            return updated;
          });
        } catch {}
      }
    } catch {}
  };
  const generateWeeklyPlan = async () => {
    if (!seasonData) return;
    setLoadingPlan(true);
    try {
      const wardrobeContext = items.filter(i => (i.verdict_v2 || (i.verdict ? "yes" : "no")) !== "no")
        .map(i => `${i.name} (${i.category}${i.formality ? `, ${i.formality}` : ""})`).join(", ");
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({
          type: "weekly_plan",
          season: seasonData.season,
          palette: (seasonData.palette?.best || []).map((c: PaletteColour) => c.name).slice(0, 4).join(", "),
          wardrobe: wardrobeContext,
          days,
        }),
      });
      const data = await res.json();
      if (data.plan && Array.isArray(data.plan)) {
        setWeeklyPlan(prev => {
          const lockedDays = prev.filter(d => d.locked).map(d => d.day);
          const merged = data.plan.map((d: { day: string; coat: string | null; base: string; shoes: string; accessories: string }) => {
            const existing = prev.find(p => p.day === d.day);
            if (existing?.locked) return existing;
            return { ...d, locked: false };
          });
          localStorage.setItem(`solla_weekly_plan_${user?.id}`, JSON.stringify(merged));
          return merged;
        });
        setPlanGenerated(true);
      }
    } catch {}
    finally { setLoadingPlan(false); }
  };
  const handleChat = async () => {
    if (!chatInput.trim() || !seasonData) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
  body: JSON.stringify({
    type: "stylist_chat",
    message: userMsg.content,
    history: chatMessages.map(m => ({ role: m.role, content: m.content })),
    season: seasonData.season,
    subseason: seasonData.subseason,
    wardrobe: [
      ...items.map(i => `${i.name} (${i.category}, ${i.formality || "casual"}, ${i.colour_name}, ${i.verdict ? "suits season" : "doesn't suit season"})`),
      ...outfits.map(o => `Saved outfit: "${o.name}" (${items.filter(i => o.item_ids.includes(i.id)).map(i => i.name).join(", ")})`)
    ].join(", "),
  }),
});
const data = await res.json();
const text = data.reply || "I couldn't generate a response. Please try again.";
      setChatMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    }
    finally { setChatLoading(false); }
  };

  // Free users can access wardrobe with 3 item limit

  const filteredItems = items.filter(i => {
  if (filterStarred && !i.starred) return false;
  if (filterCategory !== "All" && i.category !== filterCategory) return false;
  if (filterVerdict !== null) {
    const v = i.verdict_v2 || (i.verdict ? "yes" : "no");
    if (v !== filterVerdict) return false;
  }
  return true;
});

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: DS.colors.bg }}>
      {/* Tab switcher */}
      <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.lg, padding: 4, gap: 4 }}>
          {(["items", "outfits", "plan", "makeup", "chat"] as const).map(v => (
            <button key={v} onClick={() => {
              if (isGuest && v !== "items") { onSignUp?.(); return; }
              if (isFreePlan && (v === "outfits" || v === "plan" || v === "chat")) { onUpgrade(); return; }
              setView(v);
            }} style={{ flex: 1, padding: "6px 2px", borderRadius: DS.radius.md, fontSize: 12, fontWeight: view === v ? 600 : 400, color: view === v ? DS.colors.white : DS.colors.textMuted, background: view === v ? DS.colors.accent : "transparent", transition: "all 0.2s", position: "relative" }}>
              {v === "items" ? "Wardrobe" : v === "outfits" ? "Outfits" : v === "plan" ? "Plan" : v === "makeup" ? "Makeup" : "Stylist"}
              {isFreePlan && (v === "outfits" || v === "plan" || v === "chat") && (
                <span style={{ position: "absolute", top: 1, right: 2, fontSize: 8, color: DS.colors.textFaint }}>🔒</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Items view */}
      {view === "items" && (
  <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

    {/* Guest prompt */}
        {isGuest && (
          <div style={{ margin: "0 16px 12px", padding: "16px", background: DS.colors.accentLight, borderRadius: DS.radius.lg, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Save your wardrobe</p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>Create a free account to save up to 3 items and check if they suit your {seasonData?.season} season.</p>
            <button onClick={() => onSignUp?.()} style={{ padding: "10px 20px", borderRadius: DS.radius.full, background: DS.colors.accent, color: DS.colors.white, fontSize: 13, fontWeight: 600 }}>Create free account</button>
          </div>
        )}
    {/* Free tier banner */}
        {isFreePlan && (
          <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: DS.colors.accentLight, borderRadius: DS.radius.lg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.accentDark }}>{items.length}/{freeItemLimit} free items used</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: DS.colors.accentDark, opacity: 0.8 }}>Upgrade to Luxe for unlimited wardrobe + daily outfits</p>
            </div>
            <button onClick={onUpgrade} style={{ padding: "6px 12px", borderRadius: DS.radius.full, background: DS.colors.accent, color: DS.colors.white, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              Upgrade
            </button>
          </div>
        )}
    {/* Stats card */}
    {items.length > 0 && (() => {
      const suits = items.filter(i => i.verdict).length;
      const pct = Math.round((suits / items.length) * 100);
      const categoryCounts = items.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {} as Record<string, number>);
      const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return (
        <div style={{ background: DS.colors.accentLight, borderRadius: DS.radius.lg, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 0 }}>
          {[
            { label: "Items", value: items.length.toString() },
            { label: "Suits season", value: `${pct}%` },
            { label: "Most worn", value: topCategory },
          ].map((stat, i) => (
            <div key={stat.label} style={{ flex: 1, textAlign: "center", borderLeft: i > 0 ? `1px solid ${DS.colors.accent}20` : "none", padding: "0 8px" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: DS.colors.accent }}>{stat.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: DS.colors.accentDark, marginTop: 2 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      );
    })()}

    {/* Filters */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, flex: 1 }}>
    <button onClick={() => setFilterStarred(!filterStarred)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterStarred ? "#FFD700" : DS.colors.surface, color: filterStarred ? "#7A5800" : DS.colors.textMuted, flexShrink: 0 }}>
  ★ Starred
</button>
<button onClick={() => setFilterVerdict(v => v === null ? "yes" : v === "yes" ? "neutral" : v === "neutral" ? "no" : null)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterVerdict === "yes" ? "#F0FDF4" : filterVerdict === "neutral" ? "#FFFBEB" : filterVerdict === "no" ? "#FEF2F2" : DS.colors.surface, color: filterVerdict === "yes" ? DS.colors.success : filterVerdict === "neutral" ? "#D97706" : filterVerdict === "no" ? DS.colors.danger : DS.colors.textMuted, flexShrink: 0 }}>
  {filterVerdict === "yes" ? "✓ Suits season" : filterVerdict === "neutral" ? "~ Neutral" : filterVerdict === "no" ? "✗ Avoid" : "All verdicts"}
</button>
            {categories.map(cat => {
      const count = cat === "All" ? items.length : items.filter(i => i.category === cat).length;
      if (cat !== "All" && count === 0) return null;
      return (
        <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterCategory === cat ? DS.colors.accent : DS.colors.surface, color: filterCategory === cat ? DS.colors.white : DS.colors.textMuted, flexShrink: 0, transition: "all 0.2s" }}>
          {cat}{count > 0 ? ` (${count})` : ""}
        </button>
      );
    })}
  </div>
  <button onClick={() => setGridView(!gridView)} style={{ padding: "5px 10px", borderRadius: DS.radius.md, background: DS.colors.surface, flexShrink: 0 }}>
    <Icon name={gridView ? "list" : "grid"} size={16} color={DS.colors.textMuted} />
  </button>
</div>

          {/* Items grid */}
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Icon name="hanger" size={40} color={DS.colors.border} />
              <p style={{ fontSize: 15, fontWeight: 600, color: DS.colors.textMuted, marginTop: 12 }}>Your wardrobe is empty</p>
              <p style={{ fontSize: 13, color: DS.colors.textFaint, marginTop: 4, lineHeight: 1.6, maxWidth: 260, margin: "8px auto 0" }}>Add your clothes and your daily outfit suggestions get smarter — Solla learns what you own, what suits your season, and what you love wearing.</p>
            </div>
          ) : gridView ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 80 }}>
              {filteredItems.map(item => (
                <div key={item.id} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, overflow: "hidden" }}>
                  <div style={{ width: "100%", aspectRatio: "1", background: item.image_url ? "#F5F5F5" : item.hex, position: "relative" }}>
                    {item.image_url && <img src={item.image_url} style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, padding: 4 }} />}
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                      <button onClick={() => handleToggleStar(item)} style={{ width: 28, height: 28, borderRadius: DS.radius.full, background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: item.starred ? "#FFD700" : DS.colors.border }}>★</button>
                    </div>
                    <div style={{ position: "absolute", bottom: 8, left: 8, padding: "2px 8px", borderRadius: DS.radius.full, background: item.verdict_v2 === "yes" ? "#F0FDF4" : item.verdict_v2 === "neutral" ? "#FFFBEB" : item.verdict_v2 === "no" ? "#FEF2F2" : item.verdict ? "#F0FDF4" : "#FEF2F2" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : item.verdict_v2 === "no" ? DS.colors.danger : item.verdict ? DS.colors.success : DS.colors.danger }}>{item.verdict_v2 === "yes" ? "✓" : item.verdict_v2 === "neutral" ? "~" : item.verdict_v2 === "no" ? "✗" : item.verdict ? "✓" : "✗"}</span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.colors.textFaint }}>{item.category}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button onClick={() => { setEditingItem(item); setEditName(item.name); setEditCategory(item.category); }} style={{ flex: 1, padding: "5px", borderRadius: DS.radius.sm, background: DS.colors.surface, fontSize: 11, color: DS.colors.textMuted }}>Edit</button>
                      <button onClick={() => handleDeleteItem(item.id)} style={{ padding: "5px 8px", borderRadius: DS.radius.sm, background: DS.colors.surface }}>
                        <Icon name="trash" size={12} color={DS.colors.textFaint} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 80 }}>
              {filteredItems.map(item => (
                <div key={item.id} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {item.image_url ? (
                      <div style={{ width: 60, height: 60, borderRadius: DS.radius.md, background: "#F5F5F5", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={item.image_url} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                      </div>
                    ) : (
                      <div style={{ width: 60, height: 60, borderRadius: DS.radius.md, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{item.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.category}</span>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>·</span>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.colour_name}</span>
                        {item.formality && <><span style={{ fontSize: 11, color: DS.colors.textFaint }}>·</span><span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.formality}</span></>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ padding: "3px 8px", borderRadius: DS.radius.full, background: item.verdict_v2 === "yes" ? "#F0FDF4" : item.verdict_v2 === "neutral" ? "#FFFBEB" : item.verdict_v2 === "no" ? "#FEF2F2" : item.verdict ? "#F0FDF4" : "#FEF2F2" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : item.verdict_v2 === "no" ? DS.colors.danger : item.verdict ? DS.colors.success : DS.colors.danger }}>{item.verdict_v2 === "yes" ? "✓" : item.verdict_v2 === "neutral" ? "~" : item.verdict_v2 === "no" ? "✗" : item.verdict ? "✓" : "✗"}</span>
                      </div>
                      <button onClick={() => handleToggleStar(item)} style={{ fontSize: 16, color: item.starred ? "#FFD700" : DS.colors.border }}>★</button>
                      <button onClick={() => { setEditingItem(item); setEditName(item.name); setEditCategory(item.category); }}><Icon name="refresh" size={14} color={DS.colors.textFaint} /></button>
                      <button onClick={() => handleDeleteItem(item.id)}><Icon name="trash" size={14} color={DS.colors.textFaint} /></button>
                    </div>
                  </div>
                  {item.tip && <p style={{ margin: "8px 0 0", fontSize: 12, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.tip}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Add item button */}
         {!isGuest && <button onClick={() => {
            if (!seasonData) {
              alert("Complete your colour analysis first — tap the Season tab to get started.");
              return;
            }
            if (isFreePlan && items.length >= freeItemLimit) {
              onUpgrade();
              return;
            }
            setShowAddItem(true);
          }}  style={{ position: "fixed", bottom: 96, right: 20, width: 52, height: 52, borderRadius: DS.radius.full, background: DS.colors.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.lg }}>
            <Icon name="plus" size={24} color={DS.colors.white} />
          </button>}
        </div>
      )}

      {/* Outfits view */}
      {view === "outfits" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {outfits.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
            {["All", "Casual", "Work", "Going out", "Active", "Special occasion"].map(cat => {
              const count = cat === "All" ? outfits.length : outfits.filter(o => o.category === cat).length;
              if (cat !== "All" && count === 0) return null;
              return (
                <button key={cat} onClick={() => setFilterOutfitCategory(cat)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterOutfitCategory === cat ? DS.colors.accent : DS.colors.surface, color: filterOutfitCategory === cat ? DS.colors.white : DS.colors.textMuted, flexShrink: 0, transition: "all 0.2s" }}>
                  {cat}{count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
        )}
          {outfits.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Icon name="star" size={40} color={DS.colors.border} />
              <p style={{ fontSize: 15, color: DS.colors.textMuted, marginTop: 12 }}>No outfits yet</p>
              <p style={{ fontSize: 13, color: DS.colors.textFaint, marginTop: 4 }}>Pick items from your wardrobe and save them as an outfit</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 80 }}>
              {outfits.filter(o => filterOutfitCategory === "All" || o.category === filterOutfitCategory).map(outfit => {
                const outfitItems = items.filter(i => outfit.item_ids.includes(i.id));
                return (
                  <div key={outfit.id} onClick={() => { setView("chat"); setChatInput(`Tell me about this outfit: ${outfit.name} — ${items.filter(i => outfit.item_ids.includes(i.id)).map(i => i.name).join(", ")}. How can I style it and what occasions does it work for?`); }} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{outfit.name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          {outfit.category && <span style={{ fontSize: 11, color: DS.colors.accent, fontWeight: 500, background: DS.colors.accentLight, padding: "1px 8px", borderRadius: DS.radius.full }}>{outfit.category}</span>}
                          <span style={{ fontSize: 11, color: DS.colors.textFaint }}>Tap to style with AI →</span>
                        </div>
                        <div style={{ padding: "2px 8px", borderRadius: DS.radius.full, background: outfit.overall_verdict ? "#F0FDF4" : "#FEF2F2" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: outfit.overall_verdict ? DS.colors.success : DS.colors.danger }}>{outfit.overall_verdict ? "Works" : "Needs work"}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleToggleOutfitStar(outfit); }} style={{ fontSize: 16, color: outfit.starred ? "#FFD700" : DS.colors.border }}>★</button>
                      <button onClick={e => { e.stopPropagation(); setEditingOutfit(outfit); setEditOutfitName(outfit.name); setEditOutfitCategory(outfit.category || "Casual"); setEditOutfitItemIds(outfit.item_ids); }}><Icon name="refresh" size={14} color={DS.colors.textFaint} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteOutfit(outfit.id); }}><Icon name="trash" size={14} color={DS.colors.textFaint} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {outfitItems.map(item => (
                        <div key={item.id} style={{ textAlign: "center" }}>
                          {item.image_url ? (
                            <img src={item.image_url} style={{ width: 52, height: 52, borderRadius: DS.radius.sm, objectFit: "contain", background: "#F5F5F5", border: "1px solid rgba(0,0,0,0.08)" }} />
                          ) : (
                            <div style={{ width: 52, height: 52, borderRadius: DS.radius.sm, background: item.hex, border: "1px solid rgba(0,0,0,0.08)" }} />
                          )}
                          <p style={{ margin: "3px 0 0", fontSize: 9, color: DS.colors.textFaint, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => setShowAddOutfit(true)} style={{ position: "fixed", bottom: 96, right: 20, width: 52, height: 52, borderRadius: DS.radius.full, background: DS.colors.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.lg }}>
            <Icon name="plus" size={24} color={DS.colors.white} />
          </button>
        </div>
      )}

      {/* Weekly plan */}
      {view === "plan" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DS.colors.text }}>Your week ahead</p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: DS.colors.textMuted }}>Season-approved outfits for every day</p>
            </div>
            <button onClick={generateWeeklyPlan} disabled={loadingPlan} style={{ padding: "8px 16px", borderRadius: DS.radius.full, background: DS.colors.accent, color: DS.colors.white, fontSize: 13, fontWeight: 600, opacity: loadingPlan ? 0.7 : 1 }}>
              {loadingPlan ? "Planning..." : planGenerated ? "Regenerate" : "Generate plan"}
            </button>
          </div>
          {!planGenerated && !loadingPlan && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Icon name="sparkles" size={40} color={DS.colors.border} />
              <p style={{ fontSize: 15, fontWeight: 600, color: DS.colors.textMuted, marginTop: 12 }}>No plan yet</p>
              <p style={{ fontSize: 13, color: DS.colors.textFaint, marginTop: 4, maxWidth: 240, margin: "8px auto 0", lineHeight: 1.6 }}>Tap Generate plan and Solla will build a full week of season-approved outfits from your wardrobe.</p>
            </div>
          )}
          {loadingPlan && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: DS.colors.accent, animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
              </div>
              <p style={{ fontSize: 14, color: DS.colors.textMuted }}>Building your week...</p>
            </div>
          )}
          {planGenerated && !loadingPlan && weeklyPlan.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 80 }}>
              {weeklyPlan.map((day, i) => (
                <div key={i} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1.5px solid ${day.locked ? DS.colors.accent : DS.colors.border}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: day.locked ? DS.colors.accent : DS.colors.text }}>{day.day}{day.locked ? " 🔒" : ""}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        setWeeklyPlan(prev => {
                          const updated = prev.map(d => d.day === day.day ? { ...d, locked: !d.locked } : d);
                          localStorage.setItem(`solla_weekly_plan_${user?.id}`, JSON.stringify(updated));
                          return updated;
                        });
                      }} style={{ fontSize: 11, color: day.locked ? DS.colors.accent : DS.colors.textFaint, fontWeight: 500, padding: "3px 8px", borderRadius: DS.radius.full, background: day.locked ? DS.colors.accentLight : DS.colors.surface }}>
                        {day.locked ? "Locked" : "Lock"}
                      </button>
                      {!day.locked && (
                        <button onClick={() => regenerateDay(day.day)} style={{ fontSize: 11, color: DS.colors.textMuted, fontWeight: 500, padding: "3px 8px", borderRadius: DS.radius.full, background: DS.colors.surface }}>
                          Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                  {day.locked ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(() => {
                        const selectedItems = items.filter(item => (day.item_ids || []).includes(item.id));
                        return selectedItems.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {selectedItems.map(item => (
                              <div key={item.id} style={{ textAlign: "center" }}>
                                {item.image_url ? (
                                  <img src={item.image_url} style={{ width: 56, height: 56, borderRadius: DS.radius.md, objectFit: "cover", border: `1px solid ${DS.colors.border}` }} />
                                ) : (
                                  <div style={{ width: 56, height: 56, borderRadius: DS.radius.md, background: item.hex, border: `1px solid ${DS.colors.border}` }} />
                                )}
                                <p style={{ margin: "3px 0 0", fontSize: 9, color: DS.colors.textFaint, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {[
                              { label: "Coat", value: day.coat },
                              { label: "Base", value: day.base },
                              { label: "Shoes", value: day.shoes },
                              { label: "Accessories", value: day.accessories },
                            ].filter(f => f.value && f.value !== "null").map(field => (
                              <div key={field.label} style={{ display: "flex", gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.textFaint, minWidth: 80 }}>{field.label}</span>
                                <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{field.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Coat", value: day.coat, key: "coat" },
                      { label: "Base", value: day.base, key: "base" },
                      { label: "Shoes", value: day.shoes, key: "shoes" },
                      { label: "Accessories", value: day.accessories, key: "accessories" },
                    ].filter(f => f.value && f.value !== "null").map(field => (
                      <div key={field.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: DS.colors.textFaint, minWidth: 80, paddingTop: 2 }}>{field.label}</span>
                        <input
                          value={field.value || ""}
                          onChange={e => {
                            setWeeklyPlan(prev => {
                              const updated = prev.map(d => d.day === day.day ? { ...d, [field.key]: e.target.value } : d);
                              localStorage.setItem(`solla_weekly_plan_${user?.id}`, JSON.stringify(updated));
                              return updated;
                            });
                          }}
                          style={{ flex: 1, fontSize: 13, color: DS.colors.text, border: "none", borderBottom: `1px solid ${DS.colors.border}`, outline: "none", background: "transparent", padding: "2px 0", fontFamily: DS.font }}
                        />
                      </div>
                    ))}
                  </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                    {!day.locked && (
                      <button onClick={() => { setPendingPlanItemIds(day.item_ids || []); setPlanItemSelector(day.day); }} style={{ fontSize: 12, color: DS.colors.textMuted, fontWeight: 500 }}>
                        + Select items
                      </button>
                    )}
                    <button onClick={() => { setView("chat"); setChatInput(`Can you help me style ${day.day}'s outfit? ${day.base}${day.coat ? `, ${day.coat}` : ""}, ${day.shoes}, ${day.accessories}`); }} style={{ fontSize: 12, color: DS.colors.accent, fontWeight: 500 }}>
                      Style with AI →
                    </button>
                    <button onClick={async () => {
                      if (!user?.id) return;
                      const outfitName = `${day.day}'s outfit`;
                      const matchedIds = day.item_ids || [];
                      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits`, {
                        method: "POST",
                        headers: { ...getAuthHeaders(), Prefer: "return=representation" },
                        body: JSON.stringify({
                          user_id: user.id,
                          name: outfitName,
                          item_ids: matchedIds,
                          overall_verdict: true,
                          starred: false,
                          category: "Casual",
                        }),
                      });
                      const data = await res.json();
                      if (Array.isArray(data)) {
                        setOutfits(prev => [data[0], ...prev]);
                        alert(`Saved "${outfitName}" to your outfits${matchedIds.length > 0 ? ` with ${matchedIds.length} matching item${matchedIds.length !== 1 ? "s" : ""}` : " — add items in the Outfits tab"} ✓`);
                      }
                    }} style={{ fontSize: 12, color: DS.colors.success, fontWeight: 500 }}>
                      + Save to outfits
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
{/* Makeup tab */}
      {view === "makeup" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Onboarding — first time */}
          {!makeupOnboarded && (
            <div style={{ background: DS.colors.accentLight, borderRadius: DS.radius.lg, padding: "20px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: DS.colors.text }}>Set up your makeup profile</p>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6 }}>Tell us what foundation and concealer shades you currently use — even if you're not sure they suit you. The more shades you give us, the better we can triangulate your skin tone and season match.</p>

              {makeupOnboardingStep === 0 && (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: DS.colors.text }}>Foundation shades you wear</p>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: DS.colors.textFaint }}>Include brand and shade name — e.g. "MAC Studio Fix NC15", "Fenty 130N". Add multiple if you use more than one or have tried a few.</p>
                  {makeupFoundationShades.map((shade, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        value={shade}
                        onChange={e => setMakeupFoundationShades(prev => prev.map((s, idx) => idx === i ? e.target.value : s))}
                        placeholder={i === 0 ? "e.g. MAC Studio Fix NC15" : "Add another shade..."}
                        style={{ flex: 1, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", fontFamily: DS.font }}
                      />
                      {i > 0 && (
                        <button onClick={() => setMakeupFoundationShades(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: "10px", color: DS.colors.textFaint }}>
                          <Icon name="x" size={14} color={DS.colors.textFaint} />
                        </button>
                      )}
                    </div>
                  ))}
                  {makeupFoundationShades.length < 4 && (
                    <button onClick={() => setMakeupFoundationShades(prev => [...prev, ""])} style={{ fontSize: 12, color: DS.colors.accent, fontWeight: 500, marginBottom: 14 }}>
                      + Add another foundation shade
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setMakeupOnboardingStep(1)} style={{ flex: 1, padding: "12px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 14, fontWeight: 600 }}>Next</button>
                    <button onClick={() => { localStorage.setItem(`solla_makeup_onboarded_${user?.id}`, "true"); setMakeupOnboarded(true); }} style={{ padding: "12px 16px", borderRadius: DS.radius.lg, background: DS.colors.surface, color: DS.colors.textMuted, fontSize: 14 }}>Skip</button>
                  </div>
                </div>
              )}

              {makeupOnboardingStep === 1 && (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: DS.colors.text }}>Concealer shades you wear</p>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: DS.colors.textFaint }}>e.g. "NARS Radiant Creamy Vanilla", "Maybelline Fit Me 110". Optional but helps us get your undertone right.</p>
                  {makeupConcealerShades.map((shade, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        value={shade}
                        onChange={e => setMakeupConcealerShades(prev => prev.map((s, idx) => idx === i ? e.target.value : s))}
                        placeholder={i === 0 ? "e.g. NARS Radiant Creamy Vanilla" : "Add another shade..."}
                        style={{ flex: 1, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", fontFamily: DS.font }}
                      />
                      {i > 0 && (
                        <button onClick={() => setMakeupConcealerShades(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: "10px", color: DS.colors.textFaint }}>
                          <Icon name="x" size={14} color={DS.colors.textFaint} />
                        </button>
                      )}
                    </div>
                  ))}
                  {makeupConcealerShades.length < 4 && (
                    <button onClick={() => setMakeupConcealerShades(prev => [...prev, ""])} style={{ fontSize: 12, color: DS.colors.accent, fontWeight: 500, marginBottom: 14 }}>
                      + Add another concealer shade
                    </button>
                  )}
                  <button onClick={async () => {
                    if (!user?.id) return;
                    setMakeupLoading(true);
                    const token = localStorage.getItem("solla_token");
                    const allFoundations = makeupFoundationShades.filter(s => s.trim());
                    const allConcealers = makeupConcealerShades.filter(s => s.trim());
                    // Save as calibration data — no verdict, these inform future checks
                    const products = [
                      ...allFoundations.map(s => ({ name: s, category: "Foundation" })),
                      ...allConcealers.map(s => ({ name: s, category: "Concealer" })),
                    ];
                    try {
                      for (const product of products) {
                        await fetch(`${SUPABASE_URL}/rest/v1/makeup_items`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}`, Prefer: "return=minimal" },
                          body: JSON.stringify({
                            user_id: user.id,
                            name: product.name,
                            brand: null,
                            category: product.category,
                            shade_name: null,
                            hex: "#C4A882",
                            verdict_v2: "neutral",
                            verdict: true,
                            tip: "Added as calibration — check this product to get your season verdict.",
                            starred: false,
                          }),
                        });
                      }
                      await loadMakeupItems();
                    } catch {}
                    finally { setMakeupLoading(false); }
                    localStorage.setItem(`solla_makeup_onboarded_${user?.id}`, "true");
                    // Save foundation shades for use in future checks
                    localStorage.setItem(`solla_foundation_shades_${user?.id}`, allFoundations.join("|"));
                    setMakeupOnboarded(true);
                  }} style={{ width: "100%", padding: "12px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {makeupLoading ? "Saving..." : "Save to my kit"}
                  </button>
                  <button onClick={() => setMakeupOnboardingStep(0)} style={{ width: "100%", padding: "10px", fontSize: 13, color: DS.colors.textMuted, marginTop: 6 }}>← Back</button>
                </div>
              )}
            </div>
          )}

          {/* Check a product */}
          <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Check a product</p>
            <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.md, padding: 3, gap: 3, marginBottom: 12 }}>
              {(["upload", "name"] as const).map(m => (
                <button key={m} onClick={() => { setMakeupCheckMode(m); setMakeupCheckResult(null); setMakeupPreview(null); }} style={{ flex: 1, padding: "7px", borderRadius: DS.radius.sm, fontSize: 12, fontWeight: makeupCheckMode === m ? 600 : 400, color: makeupCheckMode === m ? DS.colors.white : DS.colors.textMuted, background: makeupCheckMode === m ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
                  {m === "upload" ? "Upload photo" : "Enter name"}
                </button>
              ))}
            </div>

            {/* Product category selector — always visible */}
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: DS.colors.textMuted }}>Product type</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {["Lip", "Blush", "Foundation", "Concealer", "Bronzer", "Eye", "Highlighter", "Other"].map(cat => (
                <button key={cat} onClick={() => setMakeupProductCategory(cat)} style={{ padding: "4px 10px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: makeupProductCategory === cat ? "#C2185B" : DS.colors.surface, color: makeupProductCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                  {cat}
                </button>
              ))}
            </div>

            {makeupCheckMode === "upload" && (
              <>
                <div style={{ background: DS.colors.surface, borderRadius: DS.radius.md, padding: "10px 12px", marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: DS.colors.textMuted }}>For best results:</p>
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: DS.colors.textFaint }}>· Swatch on inner arm in natural light — best for lip, blush and eye</p>
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: DS.colors.textFaint }}>· Photograph your actual garment, not a product image from a website</p>
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: DS.colors.textFaint }}>· Natural light only — no flash, no filters, no artificial lighting</p>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: DS.colors.textFaint }}>· White or neutral background where possible</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#D97706", fontWeight: 500 }}>For any product with a known shade name — always use "Enter name". Photo checking is best for unknown shades swatched directly on your inner arm in natural daylight. Product photos and packaging shots will give unreliable colour readings.</p>
                </div>
                <div onClick={() => !makeupPreview && makeupFileRef.current?.click()} style={{ borderRadius: DS.radius.lg, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: makeupPreview ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 10 }}>
                  {makeupPreview ? (
                    <>
                      <img src={makeupPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={e => { e.stopPropagation(); setMakeupPreview(null); setMakeupCheckResult(null); if (makeupFileRef.current) makeupFileRef.current.value = ""; }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: DS.radius.full, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="x" size={14} color={DS.colors.white} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Icon name="camera" size={20} color={DS.colors.accent} />
                      <p style={{ fontSize: 12, color: DS.colors.textMuted, marginTop: 6 }}>Tap to upload</p>
                    </>
                  )}
                </div>
                <input ref={makeupFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setMakeupPreview(URL.createObjectURL(f));
                }} />
              </>
            )}

            {makeupCheckMode === "name" && (
              <input value={makeupProductName} onChange={e => setMakeupProductName(e.target.value)} placeholder={`e.g. "Charlotte Tilbury Pillow Talk" or "MAC Ruby Woo"`} style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 10, fontFamily: DS.font }} />
            )}

            <button onClick={async () => {
              if (!seasonData) return;
              if (makeupCheckMode === "upload" && !makeupPreview) return;
              if (makeupCheckMode === "name" && !makeupProductName.trim()) return;
              setMakeupChecking(true);
              setMakeupCheckResult(null);
              try {
                let body: any;
                if (makeupCheckMode === "upload") {
                  const file = makeupFileRef.current?.files?.[0];
                  if (!file) return;
                  const img = new Image();
                  const url = URL.createObjectURL(file);
                  const base64 = await new Promise<string>((resolve, reject) => {
                    img.onload = () => {
                      URL.revokeObjectURL(url);
                      let { width, height } = img;
                      const max = 1024;
                      if (width > height) { if (width > max) { height = Math.round(height * max / width); width = max; } }
                      else { if (height > max) { width = Math.round(width * max / height); height = max; } }
                      const canvas = document.createElement("canvas");
                      canvas.width = width; canvas.height = height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) { reject(new Error("Canvas error")); return; }
                      ctx.drawImage(img, 0, 0, width, height);
                      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
                    };
                    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
                    img.src = url;
                  });
                  body = {
                    type: "check_item",
                    image: base64,
                    season: seasonData.season,
                    mode: "single",
                  };
                } else {
                  const savedFoundations = localStorage.getItem(`solla_foundation_shades_${user?.id}`) || "";
                body = {
                    type: "makeup_check_product",
                    season: seasonData.season,
                    subseason: seasonData.subseason,
                    undertone: (seasonData as any).colour_profile?.undertone || "",
                    depth: (seasonData as any).colour_profile?.depth || "",
                    products: [{ name: makeupProductName.trim(), category: makeupProductCategory }],
                    foundation: savedFoundations || makeupFoundationShades.filter(s => s.trim()).join(", ") || null,
                  };
                }
                const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
                  body: JSON.stringify(body),
                });
                const data = await res.json();
                if (makeupCheckMode === "upload") {
                  setMakeupCheckResult(data);
                } else if (data.results) {
                  setMakeupCheckResult({ mode: "single", items: data.results.map((r: any) => ({ colour_name: r.shade || r.name, hex: r.hex || "#C4A882", verdict: r.verdict !== false, verdict_v2: r.verdict_v2 || "yes", reason: r.reason || "", tip: r.tip || "" })) });
                }
              } catch {}
              finally { setMakeupChecking(false); }
            }} disabled={makeupChecking || (makeupCheckMode === "upload" ? !makeupPreview : !makeupProductName.trim())} style={{ width: "100%", padding: "12px", borderRadius: DS.radius.lg, background: makeupChecking || (makeupCheckMode === "upload" ? !makeupPreview : !makeupProductName.trim()) ? DS.colors.border : "#C2185B", color: DS.colors.white, fontSize: 14, fontWeight: 600 }}>
              {makeupChecking ? "Checking..." : "Check this product"}
            </button>

            {/* Check results */}
            {makeupCheckResult && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => { setMakeupCheckResult(null); setMakeupPreview(null); setMakeupProductName(""); if (makeupFileRef.current) makeupFileRef.current.value = ""; }} style={{ padding: "8px 16px", borderRadius: DS.radius.full, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, fontSize: 12, color: DS.colors.textMuted, fontWeight: 500, alignSelf: "flex-start" }}>
                  ← Check another
                </button>
                {makeupCheckResult.items.map((item, i) => (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}`, background: DS.colors.bg }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{item.colour_name}</p>
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger }}>
                          {item.verdict_v2 === "yes" ? "✓ Suits your season" : item.verdict_v2 === "neutral" ? "~ Works with care" : "✗ Doesn't suit your season"}
                        </span>
                        <span style={{ fontSize: 10, color: DS.colors.textFaint, background: DS.colors.surface, padding: "1px 6px", borderRadius: DS.radius.full, display: "block", marginTop: 3 }}>
                          {makeupCheckMode === "upload" ? "Photo check — result may vary with lighting" : "Name check — high confidence"}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.reason}</p>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: DS.colors.accent, fontWeight: 500 }}>{item.tip}</p>
                    <button onClick={() => {
                      setSaveMakeupSheet({ item, previewSrc: makeupPreview || undefined });
                      setSaveMakeupName(makeupCheckMode === "name" ? makeupProductName : item.colour_name);
                      setSaveMakeupShade(item.colour_name);
                      setSaveMakeupCategory(makeupProductCategory);
                      setSaveMakeupBrand("");
                    }} style={{ padding: "6px 14px", borderRadius: DS.radius.full, background: "#FFF0F5", fontSize: 12, color: "#C2185B", fontWeight: 500 }}>
                      + Save to my kit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My kit */}
          <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px", marginBottom: 80 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>My kit {makeupItems.length > 0 && <span style={{ fontSize: 12, color: DS.colors.textFaint }}>({makeupItems.length})</span>}</p>
            </div>

            {/* What's missing */}
            {seasonData && makeupItems.length > 0 && (() => {
              const cats = ["Foundation", "Concealer", "Blush", "Lip", "Eye"];
              const missing = cats.filter(c => !makeupItems.some(i => i.category === c && i.verdict_v2 === "yes"));
              return missing.length > 0 ? (
                <div style={{ padding: "10px 12px", background: DS.colors.accentLight, borderRadius: DS.radius.md, marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, color: DS.colors.accentDark, fontWeight: 500 }}>Still needed for your {seasonData.season} kit: <strong>{missing.join(", ")}</strong></p>
                </div>
              ) : (
                <div style={{ padding: "10px 12px", background: "#F0FDF4", borderRadius: DS.radius.md, marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, color: DS.colors.success, fontWeight: 500 }}>✓ Full kit — all essential categories covered</p>
                </div>
              );
            })()}

            {/* Category filter */}
            {makeupItems.length > 0 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
                {["All", "Foundation", "Concealer", "Blush", "Lip", "Eye", "Bronzer", "Highlighter", "Other"].map(cat => {
                  const count = cat === "All" ? makeupItems.length : makeupItems.filter(i => i.category === cat).length;
                  if (cat !== "All" && count === 0) return null;
                  return (
                    <button key={cat} onClick={() => setMakeupFilterCategory(cat)} style={{ padding: "4px 10px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: makeupFilterCategory === cat ? "#C2185B" : DS.colors.surface, color: makeupFilterCategory === cat ? DS.colors.white : DS.colors.textMuted, flexShrink: 0 }}>
                      {cat}{count > 0 ? ` (${count})` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {makeupLoading && <p style={{ fontSize: 13, color: DS.colors.textMuted }}>Loading...</p>}

            {!makeupLoading && makeupItems.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 4 }}>Your kit is empty</p>
                <p style={{ fontSize: 13, color: DS.colors.textFaint, lineHeight: 1.5 }}>Check a product above and save it to build your kit.</p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {makeupItems.filter(i => makeupFilterCategory === "All" || i.category === makeupFilterCategory).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}` }}>
                  {item.image_url ? (
                    <img src={item.image_url} style={{ width: 44, height: 44, borderRadius: DS.radius.full, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: DS.radius.full, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                      {item.brand && <span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.brand}</span>}
                      {item.shade_name && <span style={{ fontSize: 11, color: DS.colors.textFaint }}>· {item.shade_name}</span>}
                      <span style={{ fontSize: 10, color: DS.colors.textFaint, background: DS.colors.surface, padding: "1px 6px", borderRadius: DS.radius.full }}>{item.category}</span>
                    </div>
                    {item.tip && <p style={{ margin: "4px 0 0", fontSize: 12, color: DS.colors.textMuted, lineHeight: 1.4 }}>{item.tip}</p>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.verdict_v2 === "yes" ? DS.colors.success : item.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger }}>
                      {item.verdict_v2 === "yes" ? "✓" : item.verdict_v2 === "neutral" ? "~" : "✗"}
                    </span>
                    <button onClick={async () => {
                      if (!window.confirm("Remove from kit?")) return;
                      const token = localStorage.getItem("solla_token");
                      setMakeupItems(prev => prev.filter(i => i.id !== item.id));
                      await fetch(`${SUPABASE_URL}/rest/v1/makeup_items?id=eq.${item.id}`, {
                        method: "DELETE",
                        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` },
                      }).catch(() => {});
                    }}>
                      <Icon name="trash" size={13} color={DS.colors.textFaint} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save makeup sheet */}
          {saveMakeupSheet && (
            <div onClick={() => setSaveMakeupSheet(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-end" }}>
              <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }}>
                <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
                  <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
                </div>
                <div style={{ padding: "16px 24px" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Save to my kit</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 14px", borderRadius: DS.radius.md, background: DS.colors.surface }}>
                    <div style={{ width: 32, height: 32, borderRadius: DS.radius.full, background: saveMakeupSheet.item.hex, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 13, color: DS.colors.text }}>{saveMakeupSheet.item.colour_name}</p>
                  </div>
                  <input value={saveMakeupName} onChange={e => setSaveMakeupName(e.target.value)} placeholder="Product name" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 10, fontFamily: DS.font }} />
                  <input value={saveMakeupBrand} onChange={e => setSaveMakeupBrand(e.target.value)} placeholder="Brand (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 10, fontFamily: DS.font }} />
                  <input value={saveMakeupShade} onChange={e => setSaveMakeupShade(e.target.value)} placeholder="Shade name (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Category</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                    {["Lip", "Blush", "Foundation", "Concealer", "Bronzer", "Eye", "Highlighter", "Other"].map(cat => (
                      <button key={cat} onClick={() => setSaveMakeupCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: saveMakeupCategory === cat ? "#C2185B" : DS.colors.surface, color: saveMakeupCategory === cat ? DS.colors.white : DS.colors.textMuted }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button onClick={async () => {
                    if (!user?.id || !saveMakeupName.trim()) return;
                    const token = localStorage.getItem("solla_token");
                    let image_url: string | null = null;
                    if (saveMakeupSheet.previewSrc) {
                      try {
                        const imgRes = await fetch(saveMakeupSheet.previewSrc);
                        const blob = await imgRes.blob();
                        const ext = blob.type === "image/png" ? "png" : "jpg";
                        const path = `${user.id}/makeup/${Date.now()}.${ext}`;
                        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/wardrobe-items/${path}`, {
                          method: "POST",
                          headers: { "Content-Type": blob.type, apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` },
                          body: blob,
                        });
                        if (uploadRes.ok) image_url = `${SUPABASE_URL}/storage/v1/object/public/wardrobe-items/${path}`;
                      } catch {}
                    }
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/makeup_items`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_JWT_KEY}`, Prefer: "return=minimal" },
                      body: JSON.stringify({
                        user_id: user.id,
                        name: saveMakeupName.trim(),
                        brand: saveMakeupBrand.trim() || null,
                        category: saveMakeupCategory,
                        shade_name: saveMakeupShade.trim() || null,
                        hex: saveMakeupSheet.item.hex,
                        verdict_v2: saveMakeupSheet.item.verdict_v2 || "yes",
                        verdict: saveMakeupSheet.item.verdict,
                        tip: saveMakeupSheet.item.tip,
                        image_url,
                        starred: false,
                      }),
                    });
                    if (res.ok) {
                      await loadMakeupItems();
                      setSaveMakeupSheet(null);
                    }
                  }} disabled={!saveMakeupName.trim()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !saveMakeupName.trim() ? DS.colors.border : "#C2185B", color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                    Save to my kit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* AI Stylist chat */}
      {view === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Icon name="sparkles" size={24} color={DS.colors.accent} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: DS.colors.text, marginBottom: 8 }}>Your AI Stylist</p>
<div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: items.length > 0 ? DS.colors.accentLight : DS.colors.surface, borderRadius: DS.radius.full, marginBottom: 8 }}>
  <span style={{ fontSize: 11, color: items.length > 0 ? DS.colors.accentDark : DS.colors.textFaint, fontWeight: 500 }}>{items.length > 0 ? `${items.length} wardrobe item${items.length !== 1 ? "s" : ""} loaded` : "No wardrobe items yet"}</span>
</div>
                <p style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6, maxWidth: 240, margin: "0 auto" }}>Your personal stylist is ready. The more you chat and the more clothes you add, the better Solla knows your style, preferences and lifestyle — so every suggestion gets more personal over time.</p>
                <button onClick={() => { setChatInput("Analyse my wardrobe and tell me what's missing, what doesn't suit my season, and what key pieces I should add."); }} style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.lg, background: DS.colors.accentLight, fontSize: 13, color: DS.colors.accentDark, fontWeight: 600, textAlign: "left", border: `1px solid ${DS.colors.accent}30`, marginTop: 20, marginBottom: 8 }}>
  ✦ Analyse my wardrobe
</button>
<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
  {["What should I wear to a job interview?", "Put together a weekend outfit from my wardrobe", "What colours work with my season?"].map(suggestion => (
                    <button key={suggestion} onClick={() => { setChatInput(suggestion); }} style={{ padding: "10px 14px", borderRadius: DS.radius.md, background: DS.colors.surface, fontSize: 13, color: DS.colors.textMuted, textAlign: "left", border: `1px solid ${DS.colors.border}` }}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? `${DS.radius.lg} ${DS.radius.lg} 4px ${DS.radius.lg}` : `${DS.radius.lg} ${DS.radius.lg} ${DS.radius.lg} 4px`, background: msg.role === "user" ? DS.colors.accent : DS.colors.surface, color: msg.role === "user" ? DS.colors.white : DS.colors.text }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: msg.content
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\n/g, '<br/>')
}} />
                </div>
                {msg.role === "assistant" && !msg.feedback && (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button onClick={() => setChatMessages(prev => prev.map((m, j) => j === i ? { ...m, feedback: "up" } : m))} style={{ padding: "3px 10px", borderRadius: DS.radius.full, background: DS.colors.surface, fontSize: 12, color: DS.colors.textMuted }}>👍</button>
                    <button onClick={() => { setChatMessages(prev => prev.map((m, j) => j === i ? { ...m, feedback: "down" } : m)); setChatInput("That didn't quite work — "); }} style={{ padding: "3px 10px", borderRadius: DS.radius.full, background: DS.colors.surface, fontSize: 12, color: DS.colors.textMuted }}>👎</button>
                  </div>
                )}
                {msg.role === "assistant" && msg.feedback === "up" && (
                  <span style={{ fontSize: 11, color: DS.colors.textFaint, marginTop: 4 }}>Glad that worked 🌸</span>
                )}
                {msg.role === "assistant" && msg.feedback === "down" && (
                  <span style={{ fontSize: 11, color: DS.colors.textFaint, marginTop: 4 }}>Tell me what didn't work and I'll try again</span>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: DS.radius.lg, background: DS.colors.surface }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: DS.colors.textFaint, animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${DS.colors.border}`, display: "flex", gap: 8, flexShrink: 0, paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }} placeholder="Ask your stylist..." style={{ flex: 1, padding: "12px 14px", borderRadius: DS.radius.lg, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", fontFamily: DS.font }} />
            <button onClick={handleChat} disabled={!chatInput.trim() || chatLoading} style={{ width: 44, height: 44, borderRadius: DS.radius.lg, background: chatInput.trim() ? DS.colors.accent : DS.colors.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="chevronRight" size={18} color={DS.colors.white} />
            </button>
          </div>
        </div>
      )}
      {/* Plan Item Selector Sheet */}
      {planItemSelector && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setPlanItemSelector(null)}>
          <div style={{ width: "100%", maxHeight: "90vh", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, overflowY: "auto", padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
            </div>
            <div style={{ padding: "16px 24px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Select items for {planItemSelector}</h2>
              <p style={{ fontSize: 13, color: DS.colors.textMuted, marginBottom: 16 }}>Tap to select or deselect. Tap Done to save.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(item => {
                  const isSelected = pendingPlanItemIds.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => {
                      setPendingPlanItemIds(prev =>
                        isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                      );
                    }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${isSelected ? DS.colors.accent : DS.colors.border}`, background: isSelected ? DS.colors.accentLight : DS.colors.bg, textAlign: "left" }}>
                      {item.image_url ? (
                        <img src={item.image_url} style={{ width: 44, height: 44, borderRadius: DS.radius.sm, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: DS.radius.sm, background: item.hex, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{item.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint }}>{item.category} · {item.colour_name}</p>
                      </div>
                      {isSelected && <Icon name="check" size={16} color={DS.colors.accent} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => {
                setWeeklyPlan(prev => {
                  const updated = prev.map(d =>
                    d.day === planItemSelector ? { ...d, item_ids: pendingPlanItemIds } : d
                  );
                  localStorage.setItem(`solla_weekly_plan_${user?.id}`, JSON.stringify(updated));
                  return updated;
                });
                setPlanItemSelector(null);
              }} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 15, fontWeight: 600, marginTop: 20 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Item Sheet */}
      {showAddItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowAddItem(false)}>
          <div style={{ width: "100%", maxHeight: "90vh", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, overflowY: "auto", padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
            </div>
            <div style={{ padding: "16px 24px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Add item</h2>

              {/* Photo upload */}
              <div onClick={() => { if (isGuest) { onSignUp?.(); return; } if (!itemPreviews.length) fileRef.current?.click(); }} style={{ borderRadius: DS.radius.lg, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: itemPreviews.length ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 16 }}>
                {itemPreviews.length > 0 ? (
                  <div style={{ display: "flex", width: "100%", height: "100%" }}>
                    {itemPreviews.map((src, i) => (
                      <img key={i} src={src} style={{ flex: 1, minWidth: 0, height: "100%", objectFit: "cover" }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <Icon name="camera" size={24} color={DS.colors.accent} />
                    <p style={{ fontSize: 13, color: DS.colors.textMuted, marginTop: 8 }}>Tap to add items</p>
                    <p style={{ fontSize: 11, color: DS.colors.textFaint, marginTop: 2 }}>Select one or more photos</p>
                  </>
                )}
                {itemChecking && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ color: DS.colors.white, fontSize: 13 }}>{itemCheckingIndex !== null && itemPreviews.length > 1 ? `Checking ${itemCheckingIndex + 1} of ${itemPreviews.length}...` : "Checking colour..."}</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { if (e.target.files?.length) { if (isGuest) { onSignUp?.(); return; } handleItemPhotos(e.target.files); } }}/>

              {/* Results — one card per item */}
              {itemResults.map((result, i) => (
                <div key={i} style={{ marginBottom: 16, padding: "12px 14px", borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}`, background: DS.colors.bg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <img src={itemPreviews[i]} style={{ width: 44, height: 44, borderRadius: DS.radius.sm, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ width: 28, height: 28, borderRadius: DS.radius.sm, background: result.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: result.verdict_v2 === "yes" ? DS.colors.success : result.verdict_v2 === "neutral" ? "#D97706" : DS.colors.danger }}>{result.verdict_v2 === "yes" ? "✓ Suits your season" : result.verdict_v2 === "neutral" ? "~ Neutral — works away from face" : "✗ Doesn't suit your season"}</p>
                      <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint }}>{result.colour_name}</p>
                    </div>
                  </div>
                  <input value={itemNames[i] || ""} onChange={e => setItemNames(prev => prev.map((n, j) => j === i ? e.target.value : n))} placeholder="Item name" style={{ width: "100%", padding: "10px 12px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 13, color: DS.colors.text, background: DS.colors.surface, outline: "none", marginBottom: 8, fontFamily: DS.font }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Top", "Knitwear", "Jackets & Coats", "Bottoms", "Dresses & Jumpsuits", "Shoes", "Bags", "Accessories"].map(cat => (
                      <button key={cat} onClick={() => setItemCategories(prev => prev.map((c, j) => j === i ? cat : c))} style={{ padding: "4px 10px", borderRadius: DS.radius.full, fontSize: 11, fontWeight: 500, background: itemCategories[i] === cat ? DS.colors.accent : DS.colors.surface, color: itemCategories[i] === cat ? DS.colors.white : DS.colors.textMuted }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 6px", fontSize: 12, fontWeight: 600, color: DS.colors.textMuted }}>Formality</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Casual", "Smart casual", "Work", "Formal", "Active"].map(f => (
                      <button key={f} onClick={() => setItemFormalities(prev => prev.map((v, j) => j === i ? f : v))} style={{ padding: "4px 10px", borderRadius: DS.radius.full, fontSize: 11, fontWeight: 500, background: itemFormalities[i] === f ? DS.colors.accent : DS.colors.surface, color: itemFormalities[i] === f ? DS.colors.white : DS.colors.textMuted }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={handleAddItems} disabled={!itemResults.length || loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !itemResults.length ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                {loading ? "Adding..." : itemResults.length > 1 ? `Add ${itemResults.length} items to wardrobe` : "Add to wardrobe"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Outfit Sheet */}
      {editingOutfit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setEditingOutfit(null)}>
          <div style={{ width: "100%", maxHeight: "90vh", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, overflowY: "auto", padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
            </div>
            <div style={{ padding: "16px 24px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Edit outfit</h2>
              <input value={editOutfitName} onChange={e => setEditOutfitName(e.target.value)} placeholder="Outfit name" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Category</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {["Casual", "Work", "Going out", "Active", "Special occasion"].map(cat => (
                  <button key={cat} onClick={() => setEditOutfitCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: editOutfitCategory === cat ? DS.colors.accent : DS.colors.surface, color: editOutfitCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                    {cat}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: DS.colors.textMuted, marginBottom: 12 }}>Select items (minimum 2):</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {items.map(item => {
                  const selected = editOutfitItemIds.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => setEditOutfitItemIds(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id])} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${selected ? DS.colors.accent : DS.colors.border}`, background: selected ? DS.colors.accentLight : DS.colors.bg, textAlign: "left" }}>
                      {item.image_url ? (
                        <img src={item.image_url} style={{ width: 44, height: 44, borderRadius: DS.radius.sm, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: item.hex, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{item.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint }}>{item.category} · {item.colour_name}</p>
                      </div>
                      {selected && <Icon name="check" size={16} color={DS.colors.accent} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={handleEditOutfit} disabled={!editOutfitName.trim() || loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !editOutfitName.trim() ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                {loading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Outfit Sheet */}
      {showAddOutfit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowAddOutfit(false)}>
          <div style={{ width: "100%", maxHeight: "90vh", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, overflowY: "auto", padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
            </div>
            <div style={{ padding: "16px 24px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Create outfit</h2>
              <input value={outfitName} onChange={e => setOutfitName(e.target.value)} placeholder="Outfit name (e.g. Work Monday)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Category</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {["Casual", "Work", "Going out", "Active", "Special occasion"].map(cat => (
                  <button key={cat} onClick={() => setOutfitCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: outfitCategory === cat ? DS.colors.accent : DS.colors.surface, color: outfitCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                    {cat}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: DS.colors.textMuted, marginBottom: 12 }}>Select items (minimum 2):</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {items.map(item => {
                  const selected = selectedItemIds.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => setSelectedItemIds(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id])} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${selected ? DS.colors.accent : DS.colors.border}`, background: selected ? DS.colors.accentLight : DS.colors.bg, textAlign: "left" }}>
                      {item.image_url ? (
                        <img src={item.image_url} style={{ width: 44, height: 44, borderRadius: DS.radius.sm, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: item.hex, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{item.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: DS.colors.textFaint }}>{item.category} · {item.colour_name}</p>
                      </div>
                      {selected && <Icon name="check" size={16} color={DS.colors.accent} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={handleAddOutfit} disabled={!outfitName.trim() || selectedItemIds.length < 2 || loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !outfitName.trim() || selectedItemIds.length < 2 ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                {loading ? "Creating..." : "Save outfit"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Item Sheet */}
{editingItem && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setEditingItem(null)}>
    <div style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
        <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
      </div>
      <div style={{ padding: "16px 24px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Edit item</h2>
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          placeholder="Item name"
          style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {["Top", "Knitwear", "Jackets & Coats", "Bottoms", "Dresses & Jumpsuits", "Shoes", "Bags", "Accessories"].map(cat => (
            <button key={cat} onClick={() => setEditCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: editCategory === cat ? DS.colors.accent : DS.colors.surface, color: editCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
              {cat}
            </button>
          ))}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: DS.colors.textMuted }}>Formality</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {["Casual", "Smart casual", "Work", "Formal", "Active"].map(f => (
            <button key={f} onClick={() => setEditingItem(prev => prev ? { ...prev, formality: f } : prev)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: editingItem?.formality === f ? DS.colors.accent : DS.colors.surface, color: editingItem?.formality === f ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={handleEditItem} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
          Save changes
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};
const ShareCard = ({ seasonData, onClose }: { seasonData: SeasonData; onClose: () => void }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const gradient = seasonGradients[seasonData.season] || seasonGradients.Summer;
  const textColor = seasonTextColors[seasonData.season] || "#1a2a4a";
  const accentColor = seasonAccentColors[seasonData.season] || "#4A6FD4";

  const handleShare = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const imageUrl = canvas.toDataURL("image/png");
      if (navigator.share) {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], "my-solla-season.png", { type: "image/png" });
        await navigator.share({ files: [file], title: `My colour season is ${seasonData.season}` });
      } else {
        const link = document.createElement("a");
        link.download = "my-solla-season.png";
        link.href = imageUrl;
        link.click();
      }
    } catch (e) {
      console.error(e);
    }
    finally { setGenerating(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 48, right: 20, width: 36, height: 36, borderRadius: DS.radius.full, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="x" size={18} color={DS.colors.white} />
      </button>

      {/* The actual share card */}
      <div ref={cardRef} style={{ width: 320, background: gradient, borderRadius: DS.radius.xl, overflow: "hidden", boxShadow: DS.shadow.lg }}>
        {/* Header */}
        <div style={{ padding: "40px 28px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: DS.radius.md, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles" size={14} color={textColor} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: textColor, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>Solla</span>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>My colour season</p>
          <h1 style={{ margin: "0 0 6px", fontSize: 52, fontWeight: 700, color: textColor, letterSpacing: "-2px", lineHeight: 1 }}>{seasonData.season}</h1>
          <p style={{ margin: "0 0 16px", fontSize: 15, color: accentColor, fontWeight: 500 }}>{seasonData.subseason}</p>
          {seasonData.colour_profile && (
            <p style={{ margin: 0, fontSize: 13, color: textColor, opacity: 0.75, fontStyle: "italic" }}>{seasonData.colour_profile.defining_quality}</p>
          )}
        </div>

        {/* Palette strip */}
        <div style={{ padding: "0 28px 20px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(seasonData.palette?.best || []).slice(0, 6).map(colour => (
              <div key={colour.hex} style={{ flex: 1, height: 40, borderRadius: DS.radius.md, background: colour.hex, border: "1px solid rgba(255,255,255,0.3)" }} />
            ))}
          </div>
        </div>

        {/* Headline */}
        <div style={{ padding: "0 28px 28px" }}>
          <p style={{ margin: 0, fontSize: 13, color: textColor, lineHeight: 1.6, opacity: 0.8 }}>{seasonData.headline}</p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `${textColor}20`, margin: "0 28px" }} />

        {/* Footer */}
        <div style={{ padding: "20px 28px 28px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: textColor }}>Stop guessing. Start dressing with confidence.</p>
          <p style={{ margin: "0 0 2px", fontSize: 11, color: textColor, opacity: 0.6 }}>Your daily outfit engine · Powered by colour science</p>
          <p style={{ margin: 0, fontSize: 11, color: accentColor, fontWeight: 600 }}>solla.com.au · @sollaapp</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: textColor, opacity: 0.5 }}>© 2026 Solla™. All rights reserved.</p>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 320, marginTop: 20 }}>
        <button onClick={handleShare} disabled={generating} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.white, color: DS.colors.text, fontSize: 16, fontWeight: 600 }}>
          {generating ? "Generating..." : "Save & Share"}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "14px", fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
          Close
        </button>
      </div>
    </div>
  );
};
const PlaceholderTab = ({ tab, isGuest, onSignUp }: { tab: Tab; isGuest: boolean; onSignUp: () => void; }) => {
  const locked = isGuest && tab !== "home";
  if (locked) {
    const tabInfo: Record<string, { icon: string; title: string; body: string }> = {
      checker: { icon: "image", title: "Check your colours", body: "Check any item or outfit against your season. Check makeup products in the Makeup tab." },
      wardrobe: { icon: "hanger", title: "Your daily outfit engine", body: "Add your clothes, get daily outfit suggestions and never ask 'what do I wear?' again." },
      me: { icon: "user", title: "Your profile", body: "Manage your profile, plan and preferences." },
    };
    const info = tabInfo[tab];
    return (
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, filter: "blur(4px)", opacity: 0.3 }}>
          <Icon name={info.icon} size={40} color={DS.colors.border} />
          <p style={{ fontSize: 15, fontWeight: 500, color: DS.colors.textMuted }}>{info.title}</p>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
          <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Icon name="lock" size={28} color={DS.colors.accent} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>{info.title}</h2>
          <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, marginBottom: 32, maxWidth: 260 }}>{info.body}</p>
          <button onClick={onSignUp} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Create account</button>
          <button onClick={onSignUp} style={{ width: "100%", padding: "14px", borderRadius: DS.radius.lg, background: DS.colors.bg, color: DS.colors.text, fontSize: 15, fontWeight: 500, border: `1.5px solid ${DS.colors.border}` }}>Sign in</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: DS.colors.textMuted }}>
      <Icon name={tabs.find(t => t.id === tab)?.icon || "sparkles"} size={40} color={DS.colors.border} />
      <p style={{ fontSize: 15, fontWeight: 500 }}>{tab.charAt(0).toUpperCase() + tab.slice(1)} - coming soon</p>
      <p style={{ fontSize: 13, color: DS.colors.textFaint }}>Coming soon</p>
    </div>
  );
};

// MainApp — NO SheetOverlay here, it lives at root level
const MainApp = ({ activeTab, onTabChange, seasonData, user, isGuest, onSignUp, onOpenSheet, onUpgrade, onSignOut, onReanalyse }: {
  activeTab: Tab; onTabChange: (tab: Tab) => void; seasonData: SeasonData | null;
  user: User | null; isGuest: boolean; onSignUp: () => void;
  onOpenSheet: (sheet: Sheet) => void; onUpgrade: () => void; onSignOut: () => void; onReanalyse: () => void;
}) => (
  <div className="screen fade-in" style={{ background: DS.colors.bg, height: "100dvh" }}>
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {activeTab === "home" ? (
        <HomeTab seasonData={seasonData} user={user} onOpenSheet={onOpenSheet} onUpgrade={onUpgrade} onReanalyse={onReanalyse} onTabChange={onTabChange} />
      ) : activeTab === "checker" ? (
        <CheckerTab seasonData={seasonData} user={user} onUpgrade={onUpgrade} />
      ) : activeTab === "me" ? (
        <MeTab user={user} seasonData={seasonData} onSignOut={onSignOut} onReanalyse={onReanalyse} onUpgrade={onUpgrade} onOpenFaq={(sheet) => onOpenSheet(sheet || "faq")} />
      ) : activeTab === "wardrobe" ? (
        <WardrobeTab user={user} seasonData={seasonData} onUpgrade={onUpgrade} onSignUp={onSignUp} isGuest={isGuest} />
      ) : (
        <PlaceholderTab tab={activeTab} isGuest={isGuest} onSignUp={onSignUp} />
      )}
    </div>
    <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
  </div>
);

export default function App() {
  const [state, setState] = useState<AppState>({
    screen: "splash", activeTab: "home", activeSheet: null,
    user: null, isGuest: false, seasonData: null,
    wardrobeItems: [], checkerMode: "single", onboardingIndex: 0, tourStep: null, showDay3Prompt: false,
  });
  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));

  const handleSignOut = () => {
    localStorage.removeItem("solla_token");
    localStorage.removeItem("solla_refresh");
    localStorage.removeItem("solla_user");
    update({ screen: "auth", user: null, seasonData: null, isGuest: false, activeSheet: null, activeTab: "home" });
  };

  const handleReanalyse = () => {
    localStorage.removeItem(`solla_season_${state.user?.id || "guest"}`);
    update({ screen: "upload", seasonData: null, activeTab: "home" });
  };

  const handleUpgrade = (plan: Plan) => {
    const updatedUser = state.user ? { ...state.user, plan } : null;
    if (updatedUser) localStorage.setItem("solla_user", JSON.stringify(updatedUser));
    update({ user: updatedUser, activeSheet: null });
  };
  const refreshToken = async () => {
  const refresh = localStorage.getItem("solla_refresh");
  if (!refresh) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("solla_token", data.access_token);
      localStorage.setItem("solla_refresh", data.refresh_token || refresh);
    }
  } catch {}
};
  useEffect(() => {
  refreshToken();
  const token = localStorage.getItem("solla_token");
  const cachedUser = localStorage.getItem("solla_user");
  if (token && cachedUser) {
    try {
      const parsedUser = JSON.parse(cachedUser);
      const confirmParams = new URLSearchParams(window.location.search);
      const isEmailConfirmation = window.location.hash.includes("access_token") || confirmParams.get("token_hash");
      if (isEmailConfirmation) {
        localStorage.removeItem("solla_token");
        localStorage.removeItem("solla_refresh");
        localStorage.removeItem("solla_user");
        // Don't clear guest season data — it will be copied when they sign in
        update({ screen: "auth" });
        window.history.replaceState({}, "", "/");
        return;
      }
      const cachedSeason = localStorage.getItem(`solla_season_${parsedUser.id}`);
      if (cachedSeason) {
        const parsedSeason = JSON.parse(cachedSeason);
        const analysedDate = localStorage.getItem(`solla_analysed_${parsedUser.id}`);
const daysSince = analysedDate ? Math.floor((Date.now() - new Date(analysedDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
update({ screen: "main", user: parsedUser, seasonData: parsedSeason, showDay3Prompt: parsedUser.plan === "free" && daysSince >= 3 });

// Day 3 and Day 7 email triggers
if (parsedUser.email && parsedSeason?.season) {
  fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}&select=day3_email_sent,day7_email_sent,trial_end_date,trial_ending_email_sent,cancelled_at,winback_email_sent,wardrobe_nudge_sent`, {
    headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
  }).then(r => r.json()).then(data => {
    const profile = data?.[0];
    if (!profile) return;
    if (daysSince >= 3 && !profile.day3_email_sent) {
      fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({ type: "day3", email: parsedUser.email, name: parsedUser.name, season: parsedSeason.season }),
      }).then(() => {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({ day3_email_sent: true }),
        }).catch(() => {});
      }).catch(() => {});
    }
    if (daysSince >= 7 && !profile.day7_email_sent) {
      fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({ type: "day7", email: parsedUser.email, name: parsedUser.name, season: parsedSeason.season }),
      }).then(() => {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({ day7_email_sent: true }),
        }).catch(() => {});
      }).catch(() => {});
    }

    // Trial ending reminder — 24 hours before trial ends
    if (profile.trial_end_date && !profile.trial_ending_email_sent) {
      const trialEnd = new Date(profile.trial_end_date);
      const hoursUntilEnd = (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilEnd <= 24 && hoursUntilEnd > 0) {
        fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
          body: JSON.stringify({ type: "trial_ending", email: parsedUser.email, name: parsedUser.name, season: parsedSeason?.season }),
        }).then(() => {
          fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
            method: "PATCH",
            headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
            body: JSON.stringify({ trial_ending_email_sent: true }),
          }).catch(() => {});
        }).catch(() => {});
      }
    }

    // Winback — 3 days after cancellation
    if (profile.cancelled_at && !profile.winback_email_sent) {
      const cancelledAt = new Date(profile.cancelled_at);
      const daysSinceCancelled = Math.floor((Date.now() - cancelledAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCancelled >= 3) {
        fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
          body: JSON.stringify({ type: "winback", email: parsedUser.email, name: parsedUser.name, season: parsedSeason?.season }),
        }).then(() => {
          fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
            method: "PATCH",
            headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
            body: JSON.stringify({ winback_email_sent: true }),
          }).catch(() => {});
        }).catch(() => {});
      }
    }

    // Wardrobe nudge — Day 5, Luxe users with no wardrobe items
    if (parsedUser.plan === "luxe" && !profile.wardrobe_nudge_sent && daysSince >= 5) {
      fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?user_id=eq.${parsedUser.id}&select=id&limit=1`, {
        headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(items => {
        if (Array.isArray(items) && items.length === 0) {
          fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
            body: JSON.stringify({ type: "wardrobe_nudge", email: parsedUser.email, name: parsedUser.name, season: parsedSeason?.season }),
          }).then(() => {
            fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
              method: "PATCH",
              headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
              body: JSON.stringify({ wardrobe_nudge_sent: true }),
            }).catch(() => {});
          }).catch(() => {});
        }
      }).catch(() => {});
    }

  }).catch(() => {});
}
      } else {
        update({ screen: "main", user: parsedUser });
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}&select=season_data`, {
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(data => {
          if (data?.[0]?.season_data) {
            const season = data[0].season_data;
            localStorage.setItem(`solla_season_${parsedUser.id}`, JSON.stringify(season));
            update({ seasonData: season });
          }
        }).catch(() => {});
      }

      // Check for successful Stripe checkout
      const stripeParams = new URLSearchParams(window.location.search);
      const checkout = stripeParams.get("checkout");
      const plan = stripeParams.get("plan") as Plan | null;
      const billing = stripeParams.get("billing");
      if (checkout === "success" && plan && token) {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({ user_plan: plan, user_billing: billing || "monthly" }),
        }).catch(() => {});
        const updatedUser = { ...parsedUser, plan };
        localStorage.setItem("solla_user", JSON.stringify(updatedUser));
        // Save trial_end_date — 7 days from now
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({ trial_end_date: trialEnd.toISOString() }),
        }).catch(() => {});
        update({ screen: "main", user: updatedUser, seasonData: cachedSeason ? JSON.parse(cachedSeason) : null });
        window.history.replaceState({}, "", "/");
      }

      fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.id) update({ user: { id: data.id, email: data.email, name: data.user_metadata?.name || data.email.split("@")[0], plan: parsedUser.plan || "free" } }); })
        .catch(() => {});
    } catch { update({ screen: "onboarding" }); }
  }
}, []);

  const resizeAndEncode = (file: File, maxDimension = 1024, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > height) { if (width > maxDimension) { height = Math.round(height * maxDimension / width); width = maxDimension; } }
        else { if (height > maxDimension) { width = Math.round(width * maxDimension / height); height = maxDimension; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
      img.src = objectUrl;
    });

  const handleUpload = async (file: File) => {
  update({ screen: "analysing" });
  try {
    const base64 = await resizeAndEncode(file);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: "analyse", image: base64 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem(`solla_season_${state.user?.id || "guest"}`, JSON.stringify(data));
    localStorage.setItem(`solla_analysed_${state.user?.id || "guest"}`, new Date().toISOString());
    // Save to Supabase if logged in
    const token = localStorage.getItem("solla_token");
    if (token && state.user?.id) {
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${state.user.id}`, {
        method: "PATCH",
        headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
        body: JSON.stringify({ season_data: data }),
      }).catch(() => {});
    }
    if (!data.hair?.best_colours || !data.makeup?.foundation || !data.palette?.best) {
  update({ screen: "upload" });
  alert("Analysis incomplete - please try again with a clearer photo in natural light.");
  return;
}
update({ seasonData: data, screen: "lifestyle-onboarding", activeSheet: null, tourStep: null });
  } catch { update({ screen: "upload" }); alert("Something went wrong — please try again with a clear selfie in natural light."); }
};

  const { screen, activeTab, user, isGuest, seasonData } = state;

  return (
    <>
      <GlobalStyles />
      {/* Root container — SheetOverlay renders here, OUTSIDE all overflow:hidden screens */}
      <div style={{ position: "relative", width: "100vw", height: "100vh", maxWidth: 430, margin: "0 auto" }}>
        {screen === "splash" && <SplashScreen onComplete={() => update({ screen: "onboarding" })} />}
        {screen === "onboarding" && <OnboardingScreen onComplete={() => update({ screen: "auth" })} />}
{screen === "lifestyle-onboarding" && <LifestyleOnboardingScreen userId={user?.id || ""} token={localStorage.getItem("solla_token") || ""} onComplete={() => update({ screen: "main", activeSheet: "preview" as Sheet, tourStep: null, activeTab: "home" })} />}
        {screen === "auth" && <AuthScreen onOpenTerms={sheet => update({ activeSheet: sheet })} onSignIn={u => {
  // Check user's own cached season first, then fall back to guest season
  const cachedSeason = localStorage.getItem(`solla_season_${u.id}`) || localStorage.getItem(`solla_season_guest`);
  const cachedGuestSeason = localStorage.getItem(`solla_season_guest`);
  if (cachedGuestSeason) {
    // Copy guest season to user's ID
    localStorage.setItem(`solla_season_${u.id}`, cachedGuestSeason);
    localStorage.removeItem(`solla_season_guest`);
  }
  if (cachedSeason) {
    try {
      const parsedSeason = JSON.parse(cachedSeason);
      update({ user: u, screen: "main", seasonData: parsedSeason, isGuest: false });
    } catch {
      update({ user: u, screen: "upload", isGuest: false });
    }
  } else {
    update({ user: u, screen: "upload", isGuest: false });
  }
}} onGuest={() => update({ isGuest: true, screen: "upload" })} />}
        {screen === "upload" && <UploadScreen onUpload={handleUpload} />}
        {screen === "analysing" && <AnalysingScreen />}
        {screen === "main" && (
          <MainApp
            activeTab={activeTab}
            onTabChange={tab => update({ activeTab: tab })}
            seasonData={seasonData}
            user={user}
            isGuest={isGuest}
            onSignUp={() => update({ activeSheet: "welcome" as Sheet })}
            onOpenSheet={sheet => update({ activeSheet: sheet })}
            onUpgrade={() => update({ activeSheet: "paywall" })}
            onSignOut={handleSignOut}
            onReanalyse={handleReanalyse}
          />
        )}
{/* SheetOverlay at root level — position:fixed works here, not clipped by any overflow:hidden */}
        {state.activeSheet && state.activeSheet !== "paywall" && state.activeSheet !== "welcome" && (state.activeSheet === "faq" || state.activeSheet === "privacy" || state.activeSheet === "terms" || state.activeSheet === "cookies" || seasonData) && (
          <SheetOverlay
            activeSheet={state.activeSheet}
            seasonData={seasonData}
            onClose={() => update({ activeSheet: null })}
          />
        )}
        {state.activeSheet === "preview" && state.seasonData && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => update({ activeSheet: "welcome" as Sheet })}>
    <div style={{ width: "100%", background: DS.colors.bg, borderRadius: `${DS.radius.xl} ${DS.radius.xl} 0 0`, padding: "0 0 48px" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
        <div style={{ width: 36, height: 4, borderRadius: DS.radius.full, background: DS.colors.border }} />
      </div>
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ background: seasonGradients[state.seasonData.season] || seasonGradients.Summer, borderRadius: DS.radius.lg, padding: "20px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: seasonAccentColors[state.seasonData.season] || "#4A6FD4", letterSpacing: "0.08em", textTransform: "uppercase" }}>Your colour season</p>
          <h2 style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 700, color: seasonTextColors[state.seasonData.season] || "#1a2a4a", letterSpacing: "-1px" }}>{state.seasonData.season}</h2>
          <p style={{ margin: 0, fontSize: 13, color: seasonTextColors[state.seasonData.season] || "#1a2a4a", opacity: 0.8 }}>{state.seasonData.headline}</p>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Your full guide includes:</p>
        {[
          { icon: "droplet", label: "Makeup", desc: `Your exact foundation undertone, blush and lip shades as a ${state.seasonData.season}` },
          { icon: "scissors", label: "Hair colours", desc: `The exact shades that make your ${state.seasonData.season} colouring come alive` },
          { icon: "gem", label: "Jewellery", desc: "Your metals and stones — personalised to your season" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: DS.radius.md, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={item.icon} size={18} color={DS.colors.accent} strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: DS.colors.textMuted }}>{item.desc}</p>
            </div>
          </div>
        ))}
        <button onClick={() => update({ activeSheet: "paywall" as Sheet })} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginTop: 8 }}>
          Build my outfit engine — free for 7 days
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 0" }}>
          <div style={{ flex: 1, height: 1, background: DS.colors.border }} />
          <span style={{ fontSize: 11, color: DS.colors.textFaint, fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: DS.colors.border }} />
        </div>
        <button onClick={() => { update({ activeSheet: null }); setTimeout(() => { const shareBtn = document.querySelector('[data-share-trigger]') as HTMLElement; if (shareBtn) shareBtn.click(); }, 100); }} style={{ width: "100%", padding: "12px", borderRadius: DS.radius.lg, background: DS.colors.surface, border: `1px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, fontWeight: 500, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="share" size={16} color={DS.colors.text} />
          Share my {state.seasonData?.season} season
        </button>
        <button onClick={() => update({ activeSheet: "welcome" as Sheet })} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500, marginTop: 4 }}>
          Maybe later
        </button>
      </div>
    </div>
  </div>
)}
        {state.activeSheet === "welcome" && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }} onClick={() => update({ activeSheet: null })}>
    <div style={{ background: DS.colors.bg, borderRadius: DS.radius.xl, padding: "32px 24px", width: "100%" }} onClick={e => e.stopPropagation()}>
      <div style={{ width: 56, height: 56, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <Icon name="sparkles" size={24} color={DS.colors.accent} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8, textAlign: "center" }}>{state.isGuest ? "Save your colour profile 🌸" : "Your season is ready 🌸"}</h2>
      <p style={{ fontSize: 14, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>{state.isGuest ? "Create a free account to save your colours, add wardrobe items and access your full colour guide. Your analysis is saved and ready." : "Your colour profile is ready. Now let's build your daily outfit engine — add your wardrobe, create outfits and never ask \"what do I wear?\" again."}</p>
      {state.isGuest ? (
        <>
          <button onClick={() => { update({ activeSheet: null, screen: "auth" }); }} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Create free account</button>
          <button onClick={() => update({ activeSheet: null })} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Maybe later</button>
        </>
      ) : (
        <button onClick={() => update({ activeSheet: null, tourStep: 0 })} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Explore my colours</button>
      )}
    </div>
  </div>
)}
        {state.tourStep !== null && state.screen === "main" && (
  <TourTooltip
    step={state.tourStep}
    total={tourSteps.length}
    onNext={() => update({ tourStep: state.tourStep! + 1 < tourSteps.length ? state.tourStep! + 1 : null })}
    onSkip={() => update({ tourStep: null })}
    activeTab={state.activeTab}
    onTabChange={tab => update({ activeTab: tab })}
  />
)}
{state.showDay3Prompt && state.screen === "main" && state.user?.plan === "free" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }} onClick={() => update({ showDay3Prompt: false })}>
            <div style={{ background: DS.colors.bg, borderRadius: DS.radius.xl, padding: "32px 24px", width: "100%" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 56, height: 56, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <Icon name="sparkles" size={24} color={DS.colors.accent} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8, textAlign: "center" }}>You found your {state.seasonData?.season} season 🌸</h2>
              <p style={{ fontSize: 14, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>Most {state.seasonData?.season}s tell us the makeup guide is what changes everything. Your exact foundation undertone, blush and lip shades are ready — unlock them free for 7 days.</p>
              <button onClick={() => update({ showDay3Prompt: false, activeSheet: "paywall" as Sheet })} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
                See my makeup guide — free for 7 days
              </button>
              <button onClick={() => update({ showDay3Prompt: false })} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Maybe later</button>
            </div>
          </div>
        )}
        {state.activeSheet === "paywall" && (
  <PaywallSheet
    currentPlan={state.user?.plan || "free"}
    onUpgrade={handleUpgrade}
    onClose={() => update({ activeSheet: null })}
    isGuest={state.isGuest}
    onSignUp={() => update({ activeSheet: "welcome" as Sheet })}
  />
)}
      </div>
    <Analytics />
    </>
  );
}