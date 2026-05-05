import { useState, useEffect, useRef } from "react";

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

type Screen = "splash" | "onboarding" | "auth" | "upload" | "analysing" | "main";
type Tab = "home" | "checker" | "wardrobe" | "me";
type Sheet = "palette" | "makeup" | "hair" | "jewellery" | "style" | "paywall" | null;
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
  };
  makeup: { foundation: string; blush: string; lip: string; eye: string; };
  hair: { best_colours: string[]; avoid: string[]; tip: string; };
  jewellery: { metals: string[]; stones: string[]; tip: string; };
  style: { silhouettes: string; patterns: string; fabrics: string; tip: string; };
  body_shape: string; daily_tip: string;
}
interface WardrobeItem {
  id: string; user_id: string; name: string; category: string;
  colour_name: string; hex: string; verdict: boolean; tip: string;
  starred: boolean; image_url?: string; price?: number; created_at: string;
}
interface Outfit {
  id: string; user_id: string; name: string; item_ids: string[];
  overall_verdict: boolean; starred: boolean; created_at: string;
}
interface ChatMessage {
  role: "user" | "assistant"; content: string;
}
interface AppState {
  screen: Screen; activeTab: Tab; activeSheet: Sheet;
  user: User | null; isGuest: boolean; seasonData: SeasonData | null;
  wardrobeItems: WardrobeItem[]; checkerMode: "single" | "swatch"; onboardingIndex: number;
}

const SUPABASE_URL = "https://hnbpasabtwafnlxzlppr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e14xp3bV8O2Wu-gdC6HiUQ_gRYU5rbp";
const SUPABASE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnBhc2FidHdhZm5seHpscHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTY5NjcsImV4cCI6MjA5MjU5Mjk2N30.YrBhMxN96k_OFEcWHYZ41up73ZEvEtRZWXwExo8GTxY";
const supabaseHeaders = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; min-height: 100dvh; overflow: hidden; background: ${DS.colors.bg}; font-family: ${DS.font}; color: ${DS.colors.text}; -webkit-font-smoothing: antialiased; }
    button { cursor: pointer; border: none; background: none; font-family: inherit; }
    input { font-family: inherit; }
    ::-webkit-scrollbar { width: 0px; }
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
          <div style={{ fontSize: 42, fontWeight: 700, color: DS.colors.white, letterSpacing: "-1px" }}>Chroma</div>
        </div>
        <div className="tag-anim" style={{ marginTop: 12, fontSize: 15, color: "rgba(255,255,255,0.75)", fontWeight: 400, letterSpacing: "0.02em" }}>Your colour season, revealed</div>
        <div className="dots-anim" style={{ marginTop: 48, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: DS.radius.full, background: DS.colors.white, animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
        </div>
      </div>
    </div>
  );
};

const slides = [
  { icon: "camera", title: "Take a selfie", body: "One clear photo in natural light is all we need. No filters, no sunglasses.", bg: "#EDE9FF", accent: DS.colors.accent },
  { icon: "palette", title: "Discover your season", body: "Our AI analyses your skin tone, undertone, eye and hair colour to find your perfect palette.", bg: "#E8F4FD", accent: "#4A90C4" },
  { icon: "sparkles", title: "Get your full guide", body: "Colours, makeup, hair, jewellery and style - everything personalised to you, so getting dressed becomes the easy part.", bg: "#FFF1E6", accent: "#E8845A" },
  { icon: "shirt", title: "Check any item", body: "Check a single item, a full outfit, or try colour swatches - Chroma reads every colour and tells you what works.", bg: "#E8F5EE", accent: "#1A9E6E" },
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

const AuthScreen = ({ onSignIn, onGuest }: { onSignIn: (user: User) => void; onGuest: () => void; }) => {
  const [mode, setMode] = useState<"landing" | "signin" | "signup">("landing");
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
      const userName = data.user?.user_metadata?.name || name || email.split("@")[0];
      let plan: Plan = "free";
      if (userId) {
        try {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=user_plan`, { headers: { ...supabaseHeaders, Authorization: `Bearer ${data.access_token}` } });
          const profiles = await pr.json();
          if (profiles?.[0]?.user_plan) plan = profiles[0].user_plan as Plan;
        } catch {}
      }
      if (mode === "signup" && userId) await saveProfile(userId, userName, userEmail, data.access_token, generateReferralCode(userName), referralCode);
      const userObj: User = { id: userId, email: userEmail, name: userName, plan };
      localStorage.setItem("chroma_token", data.access_token);
      localStorage.setItem("chroma_refresh", data.refresh_token || "");
      localStorage.setItem("chroma_user", JSON.stringify(userObj));
      onSignIn(userObj);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };
  if (mode === "landing") return (
    <div className="screen fade-in" style={{ background: DS.colors.bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
        <div style={{ width: 72, height: 72, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Icon name="sparkles" size={32} color={DS.colors.accent} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: DS.colors.text, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>Welcome to Chroma</h1>
        <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 48 }}>Create an account to save your results and unlock your full colour guide.</p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => setMode("signup")} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Create account</button>
          <button onClick={() => setMode("signin")} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.bg, color: DS.colors.text, fontSize: 15, fontWeight: 500, border: `1.5px solid ${DS.colors.border}` }}>Sign in</button>
          <button onClick={onGuest} style={{ width: "100%", padding: "14px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Continue as guest</button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, overflowY: "auto" }}>
      <div style={{ padding: "40px 28px 48px", display: "flex", flexDirection: "column", gap: 0 }}>
        <button onClick={() => { setMode("landing"); setError(""); }} style={{ alignSelf: "flex-start", marginBottom: 32, color: DS.colors.textMuted }}><Icon name="chevronLeft" size={20} color={DS.colors.textMuted} /></button>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>{mode === "signup" ? "Create account" : "Welcome back"}</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32 }}>{mode === "signup" ? "Start your colour journey today" : "Sign in to your Chroma account"}</p>
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
                <span style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>I agree to the Terms & Privacy Policy</span>
              </button>
            </>
          )}
          {error && <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm }}>{error}</p>}
          <button onClick={handleAuth} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: loading ? DS.colors.textFaint : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginTop: 8 }}>
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>
        <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} style={{ marginTop: 20, fontSize: 14, color: DS.colors.accent, fontWeight: 500, alignSelf: "center" }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New to Chroma? Create account"}
        </button>
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
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg }}>
      <div style={{ padding: "40px 28px 0", flex: 1, display: "flex", flexDirection: "column" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Take your selfie</h1>
        <p style={{ fontSize: 14, color: DS.colors.textMuted, marginBottom: 32, lineHeight: 1.6 }}>Use natural light, face the camera directly, and remove sunglasses.</p>
        <div onClick={() => !preview && fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          style={{ flex: 1, borderRadius: DS.radius.xl, border: `2px dashed ${isDragging ? DS.colors.accent : DS.colors.border}`, background: isDragging ? DS.colors.accentLight : DS.colors.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: preview ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 24, maxHeight: 400 }}>
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
              <p style={{ fontSize: 13, color: DS.colors.textMuted }}>Tap to take or choose a photo</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleChange} style={{ display: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
          {preview ? (
            <button onClick={handleAnalyse} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Analyse my colours</button>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Choose photo</button>
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

const AnalysingScreen = () => {
  const steps = ["Reading your features", "Mapping your palette", "Building your guide"];
  const [step, setStep] = useState(0); const [progress, setProgress] = useState(0);
  useEffect(() => {
    const pi = setInterval(() => setProgress(p => Math.min(p + 1, 90)), 120);
    const t1 = setTimeout(() => setStep(1), 3000); const t2 = setTimeout(() => setStep(2), 6000);
    return () => { clearInterval(pi); clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="screen fade-in" style={{ background: DS.colors.bg, alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
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
      <p style={{ fontSize: 13, color: DS.colors.textFaint, textAlign: "center", marginBottom: 32, maxWidth: 260 }}>This usually takes 15–20 seconds. Stay on this screen until your results are ready.</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
  {steps.map((s, i) => (
    <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, width: 280 }}>
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
  const [selected, setSelected] = useState<"glow" | "luxe">("glow");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);

  const pricing = {
    glow: { monthly: "$6.99", annual: "$49.99", monthlyEquiv: "$4.17/mo" },
    luxe: { monthly: "$14.99", annual: "$99.99", monthlyEquiv: "$8.33/mo" },
  };

  const plans: { id: "glow" | "luxe"; name: string; color: string; features: string[] }[] = [
    { id: "glow", name: "Glow", color: DS.colors.accent, features: ["Season & palette", "Makeup guide", "Hair colours", "Jewellery guide", "Colour checker"] },
    { id: "luxe", name: "Luxe", color: "#C26B3A", features: ["Everything in Glow", "Style & Fit guide", "Wardrobe tab"] },
  ];

  const handleUpgrade = async () => {
  if (isGuest && onSignUp) { onSignUp(); return; }
  setLoading(true);
  try {
    const token = localStorage.getItem("chroma_token");
    const cachedUser = localStorage.getItem("chroma_user");
    if (!token || !cachedUser) { onSignUp?.(); return; }
    const user = JSON.parse(cachedUser);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
      body: JSON.stringify({
        type: "create_checkout",
        plan: selected,
        billing,
        user_id: user.id,
        email: user.email,
        return_url: "https://chromaapp.com.au",
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
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 4 }}>
            {isGuest ? "Create an account to upgrade" : "Unlock your full guide"}
          </h2>
          <p style={{ fontSize: 14, color: DS.colors.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
            {isGuest ? "Sign up first, then choose your plan to unlock your complete colour guide." : "Start your 7-day free trial. Cancel anytime."}
          </p>
          {!isGuest && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0FDF4", padding: "4px 12px", borderRadius: DS.radius.full, marginBottom: 20 }}>
              <Icon name="check" size={12} color={DS.colors.success} strokeWidth={2.5} />
              <span style={{ fontSize: 12, color: DS.colors.success, fontWeight: 600 }}>7-day free trial — no charge until day 8</span>
            </div>
          )}
          {!isGuest && (
            <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.lg, padding: 4, marginBottom: 16, gap: 4 }}>
              {(["monthly", "annual"] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ flex: 1, padding: "8px", borderRadius: DS.radius.md, fontSize: 13, fontWeight: billing === b ? 600 : 400, color: billing === b ? DS.colors.white : DS.colors.textMuted, background: billing === b ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
                  {b === "monthly" ? "Monthly" : "Annual — save 40%"}
                </button>
              ))}
            </div>
          )}
          {!isGuest && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {plans.map(plan => {
                const isSelected = selected === plan.id;
                const price = pricing[plan.id][billing];
                const equiv = billing === "annual" ? pricing[plan.id].monthlyEquiv : null;
                return (
                  <button key={plan.id} onClick={() => setSelected(plan.id)} style={{ width: "100%", padding: "14px 16px", borderRadius: DS.radius.lg, textAlign: "left", border: `2px solid ${isSelected ? plan.color : DS.colors.border}`, background: isSelected ? (plan.id === "glow" ? DS.colors.accentLight : "#FFF7ED") : DS.colors.bg, transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: isSelected ? plan.color : DS.colors.text }}>{plan.name}</span>
                        {plan.id === "glow" && <span style={{ fontSize: 10, background: DS.colors.success, color: DS.colors.white, padding: "2px 7px", borderRadius: DS.radius.full, fontWeight: 600 }}>POPULAR</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? plan.color : DS.colors.textMuted }}>{price}</div>
                        {equiv && <div style={{ fontSize: 11, color: DS.colors.textFaint }}>{equiv}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="check" size={12} color={plan.color} strokeWidth={2.5} />
                          <span style={{ fontSize: 13, color: DS.colors.textMuted }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={handleUpgrade} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: isGuest ? DS.colors.accent : selected === "luxe" ? "#C26B3A" : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Starting trial..." : isGuest ? "Create account to continue" : `Start 7-day free trial`}
          </button>
          {!isGuest && <p style={{ textAlign: "center", fontSize: 11, color: DS.colors.textFaint, marginBottom: 12, lineHeight: 1.5 }}>After your trial, {selected === "glow" ? (billing === "monthly" ? "$6.99/mo" : "$49.99/yr") : (billing === "monthly" ? "$14.99/mo" : "$99.99/yr")} — cancel anytime before day 8.</p>}
          <button onClick={onClose} style={{ width: "100%", padding: "12px", fontSize: 14, color: DS.colors.textMuted, fontWeight: 500 }}>Maybe later</button>
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
// SheetOverlay — rendered at ROOT level, outside all overflow:hidden containers
const SheetOverlay = ({ activeSheet, seasonData, onClose }: { activeSheet: Sheet; seasonData: SeasonData; onClose: () => void; }) => (
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
          {[{ label: "Foundation", value: seasonData.makeup.foundation }, { label: "Blush", value: seasonData.makeup.blush }, { label: "Lips", value: seasonData.makeup.lip }, { label: "Eyes", value: seasonData.makeup.eye }].map(item => (
            <div key={item.label} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{item.value}</p>
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
              {seasonData.hair.best_colours.map(c => (
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
              {seasonData.hair.avoid.map(c => (
                <span key={c} style={{ padding: "6px 14px 6px 10px", background: "#FEF2F2", borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.danger, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: hairColourMap[c.toLowerCase()] || guessColourFromName(c), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Stylist tip</p>
            <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{seasonData.hair.tip}</p>
          </div>
        </div>
      )}
      {activeSheet === "jewellery" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>Jewellery</h2>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Metals</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {seasonData.jewellery.metals.map(m => (
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
              {seasonData.jewellery.stones.map(s => (
  <span key={s} style={{ padding: "6px 14px 6px 10px", background: DS.colors.surface, borderRadius: DS.radius.full, fontSize: 13, color: DS.colors.textMuted, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span style={{ width: 12, height: 12, borderRadius: "50%", background: stoneColourMap[s.toLowerCase()] || guessColourFromName(s), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
    {s}
  </span>
))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>Tip</p>
            <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{seasonData.jewellery.tip}</p>
          </div>
        </div>
      )}
      {activeSheet === "style" && (
        <div style={{ padding: "16px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>Style & Fit</h2>
          {[{ label: "Silhouettes", value: seasonData.style.silhouettes }, { label: "Patterns", value: seasonData.style.patterns }, { label: "Fabrics", value: seasonData.style.fabrics }, { label: "Philosophy", value: seasonData.style.tip }].map(item => (
            <div key={item.label} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: DS.colors.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: 14, color: DS.colors.text, lineHeight: 1.7 }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const HomeTab = ({ seasonData, user, onOpenSheet, onUpgrade }: { seasonData: SeasonData | null; user: User | null; onOpenSheet: (sheet: Sheet) => void; onUpgrade: () => void; }) => {
  const plan = user?.plan || "free";
  if (!seasonData) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "40px 28px" }}>
      <Icon name="sparkles" size={40} color={DS.colors.border} />
      <p style={{ fontSize: 15, fontWeight: 500, color: DS.colors.textMuted, textAlign: "center" }}>No season data yet</p>
      <p style={{ fontSize: 13, color: DS.colors.textFaint, textAlign: "center" }}>Upload a selfie to discover your colour season</p>
    </div>
  );
  const gradient = seasonGradients[seasonData.season] || seasonGradients.Summer;
  const textColor = seasonTextColors[seasonData.season] || "#1a2a4a";
  const accentColor = seasonAccentColors[seasonData.season] || "#4A6FD4";
  const canAccessMakeup = plan !== "free";
  const canAccessHair = plan !== "free";
  const canAccessJewellery = plan !== "free";
  const canAccessStyle = plan === "luxe";
  const categoryCards = [
    { id: "makeup" as Sheet, icon: "droplet", label: "Makeup", teaser: seasonData.makeup.foundation.split(".")[0] + ".", locked: !canAccessMakeup, requiredPlan: "Glow" },
    { id: "hair" as Sheet, icon: "scissors", label: "Hair", teaser: seasonData.hair.best_colours.slice(0, 2).join(", ") + " and more...", locked: !canAccessHair, requiredPlan: "Glow" },
    { id: "jewellery" as Sheet, icon: "gem", label: "Jewellery", teaser: seasonData.jewellery.metals.join(", "), locked: !canAccessJewellery, requiredPlan: "Glow" },
    { id: "style" as Sheet, icon: "shirt", label: "Style & Fit", teaser: seasonData.style.tip, locked: !canAccessStyle, requiredPlan: "Luxe" },
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
      </div>
      <div style={{ margin: "0 16px", background: DS.colors.bg, borderRadius: `0 0 ${DS.radius.lg} ${DS.radius.lg}`, padding: "12px 16px", borderLeft: `3px solid ${accentColor}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon name="sparkles" size={14} color={accentColor} strokeWidth={2} />
        <p style={{ margin: 0, fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{seasonData.daily_tip}</p>
      </div>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "16px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: DS.colors.text }}>Your palette</p>
          
          {/* Best colours */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {(seasonData.palette.best || []).map(colour => (
              <div key={colour.hex} style={{ textAlign: "center" }}>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: colour.hex, marginBottom: 4, border: colour.hex === "#FFFFFF" ? `1px solid ${DS.colors.border}` : "none" }} />
                <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
              </div>
            ))}
          </div>

          {/* Base colours */}
          {seasonData.palette.base && seasonData.palette.base.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Base neutrals</p>
              <div style={{ display: "flex", gap: 8 }}>
                {seasonData.palette.base.map(colour => (
                  <div key={colour.hex} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: colour.hex, marginBottom: 4, border: `1px solid ${DS.colors.border}` }} />
                    <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accent colours */}
          {seasonData.palette.accent && seasonData.palette.accent.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Accent colours</p>
              <div style={{ display: "flex", gap: 8 }}>
                {seasonData.palette.accent.map(colour => (
                  <div key={colour.hex} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: colour.hex, marginBottom: 4, border: `1px solid ${DS.colors.border}` }} />
                    <p style={{ margin: 0, fontSize: 9, color: DS.colors.textMuted, lineHeight: 1.3 }}>{colour.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avoid colours */}
          <div style={{ paddingTop: 14, borderTop: `1px solid ${DS.colors.border}` }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: DS.colors.textMuted }}>Avoid</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(seasonData.palette.avoid || []).map(colour => (
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
          </div>
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
    </div>
  );
};

interface CheckResult {
  mode: string;
  overall_verdict?: boolean;
  overall_tip?: string;
  items: {
    piece?: string;
    colour_name: string;
    hex: string;
    verdict: boolean;
    reason: string;
    tip: string;
  }[];
}

const CheckerTab = ({ seasonData, user, onUpgrade }: { seasonData: SeasonData | null; user: User | null; onUpgrade: () => void; }) => {
  const [mode, setMode] = useState<"single" | "outfit" | "swatch">("single");
  const [preview, setPreview] = useState<string | null>(null);
  const [swatchLabel, setSwatchLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
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

  const handleFile = (file: File) => {
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  const handleCheck = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !seasonData) return;
    setLoading(true); setError("");
    try {
      const base64 = await resizeAndEncode(file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smooth-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ type: "check_item", image: base64, season: seasonData.season, mode, swatchLabel: swatchLabel || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError("");
    setSwatchLabel("");
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!canAccess) return (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
    <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
      <Icon name="lock" size={28} color={DS.colors.accent} />
    </div>
    <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>Colour Checker</h2>
    <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 24 }}>Upgrade to Glow to check items, outfits and swatches against your season.</p>
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
          {(["single", "outfit", "swatch"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); reset(); }} style={{ flex: 1, padding: "8px 4px", borderRadius: DS.radius.md, fontSize: 13, fontWeight: mode === m ? 600 : 400, color: mode === m ? DS.colors.white : DS.colors.textMuted, background: mode === m ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Mode description */}
        <p style={{ fontSize: 13, color: DS.colors.textFaint, marginBottom: 16, lineHeight: 1.5 }}>
          {mode === "single" && "Upload a photo of one item. For best results, photograph in natural light against a neutral background — results may vary with filters or poor lighting."}
          {mode === "outfit" && "Upload a full outfit photo for an overall verdict and per-piece breakdown. Natural light gives the most accurate colour reading."}
          {mode === "swatch" && "Upload a photo of your swatches in natural light (e.g. lipsticks swatched on your arm). The clearer the photo, the more precise each verdict will be."}
        </p>

        {/* Swatch label */}
        {mode === "swatch" && (
          <input
            value={swatchLabel}
            onChange={e => setSwatchLabel(e.target.value)}
            placeholder="What are these swatches? (e.g. lipstick shades)"
            style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 16, fontFamily: DS.font }}
          />
        )}

        {/* Upload area */}
        {!result && (
          <div
            onClick={() => !preview && fileRef.current?.click()}
            style={{ borderRadius: DS.radius.xl, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: preview ? "default" : "pointer", overflow: "hidden", position: "relative", marginBottom: 16, height: 220 }}
          >
            {preview ? (
              <>
                <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {/* CTA */}
        {preview && !result && (
          <button onClick={handleCheck} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: loading ? DS.colors.textFaint : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {loading ? "Checking..." : "Check this"}
          </button>
        )}

        {error && <p style={{ fontSize: 13, color: DS.colors.danger, padding: "8px 12px", background: "#FEF2F2", borderRadius: DS.radius.sm, marginBottom: 16 }}>{error}</p>}

        {/* Results */}
        {result && (
          <div style={{ marginBottom: 32 }}>
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
            {preview && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <img src={preview} style={{ width: 56, height: 56, borderRadius: DS.radius.md, objectFit: "cover", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{result.items.length} colour{result.items.length !== 1 ? "s" : ""} analysed</p>
                  <p style={{ margin: 0, fontSize: 12, color: DS.colors.textFaint }}>{result.items.filter(i => i.verdict).length} of {result.items.length} suit your {seasonData.season} season</p>
                </div>
                <button onClick={reset} style={{ marginLeft: "auto", fontSize: 13, color: DS.colors.accent, fontWeight: 500, padding: "6px 12px", borderRadius: DS.radius.full, border: `1px solid ${DS.colors.accentLight}`, background: DS.colors.accentLight }}>
                  Check another
                </button>
              </div>
            )}

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
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: DS.radius.full, background: item.verdict ? "#F0FDF4" : "#FEF2F2", flexShrink: 0 }}>
                      <Icon name={item.verdict ? "check" : "x"} size={12} color={item.verdict ? DS.colors.success : DS.colors.danger} strokeWidth={2.5} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: item.verdict ? DS.colors.success : DS.colors.danger }}>{item.verdict ? "Yes" : "No"}</span>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.reason}</p>
                  <p style={{ margin: 0, fontSize: 13, color: DS.colors.accent, lineHeight: 1.5, fontWeight: 500 }}>{item.tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
const MeTab = ({ user, seasonData, onSignOut, onReanalyse, onUpgrade }: {
  user: User | null; seasonData: SeasonData | null;
  onSignOut: () => void; onReanalyse: () => void; onUpgrade: () => void;
}) => {
  const [showReanalyseWarning, setShowReanalyseWarning] = useState(false);
  const [activePill, setActivePill] = useState<{ label: string; value: string; description: string } | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("chroma_token");
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
    free: ["Season & palette", "Daily tip"],
    glow: ["Season & palette", "Makeup guide", "Hair colours", "Jewellery guide", "Colour checker"],
    luxe: ["Everything in Glow", "Style & Fit guide", "Wardrobe tab"],
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {[
                    { label: "Undertone", value: seasonData.colour_profile.undertone, description: "Undertone is the subtle hue beneath your skin's surface — warm (golden/yellow), cool (pink/blue), or neutral (a mix of both). It's the most important factor in colour analysis and determines which colour families will harmonise with your natural colouring." },
                    { label: "Depth", value: seasonData.colour_profile.depth, description: "Depth refers to how light or dark your overall colouring is — your skin, hair and eyes combined. Light colouring is best matched with lighter, softer shades. Deep colouring can carry richer, darker tones. Wearing colours that match your depth keeps you looking balanced and vibrant." },
                    { label: "Chroma", value: seasonData.colour_profile.chroma, description: "Chroma describes how clear or muted your colouring is. Bright chroma means your features are vivid and saturated — you can wear bold, saturated colours. Muted or soft chroma means your features have a gentle, blended quality — you look best in toned-down, less saturated shades." },
                    { label: "Contrast", value: seasonData.colour_profile.contrast, description: "Contrast is the difference in value between your hair, skin and eyes. High contrast colouring (e.g. dark hair, light skin) suits bold colour combinations and strong patterns. Low contrast colouring looks best in tonal, harmonious combinations without stark differences between pieces." },
                  ].map(item => (
                    <button key={item.label} onClick={() => setActivePill(item)} style={{ padding: "3px 10px", background: DS.colors.accentLight, borderRadius: DS.radius.full, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: DS.colors.accentDark, fontWeight: 500 }}>{item.label}: {item.value}</span>
                      <Icon name="info" size={10} color={DS.colors.accent} strokeWidth={2} />
                    </button>
                  ))}
                </div>

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
          <button onClick={() => setShowReanalyseWarning(true)} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DS.colors.border}` }}>
            <Icon name="refresh" size={18} color={DS.colors.text} />
            <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.text }}>Re-analyse my colours</span>
            <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={16} color={DS.colors.textFaint} /></span>
          </button>
          <button onClick={onSignOut} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="logout" size={18} color={DS.colors.danger} />
            <span style={{ fontSize: 14, fontWeight: 500, color: DS.colors.danger }}>Sign out</span>
          </button>
        </div>
      </div>

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
const WardrobeTab = ({ user, seasonData, onUpgrade }: { user: User | null; seasonData: SeasonData | null; onUpgrade: () => void; }) => {
  const plan = user?.plan || "free";
  const canAccess = plan === "luxe";

  const [view, setView] = useState<"items" | "outfits" | "chat">("items");
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStarred, setFilterStarred] = useState(false);

  // Add item form
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("Top");
  const [itemPrice, setItemPrice] = useState("");
  const [itemPreview, setItemPreview] = useState<string | null>(null);
  const [itemChecking, setItemChecking] = useState(false);
  const [itemResult, setItemResult] = useState<{ colour_name: string; hex: string; verdict: boolean; tip: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Add outfit form
  const [outfitName, setOutfitName] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const categories = ["All", "Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessories"];

  const token = localStorage.getItem("chroma_token");
  const authHeaders = { 
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token || SUPABASE_JWT_KEY}` 
};
  useEffect(() => {
    if (!canAccess || !user?.id) return;
    loadItems();
    loadOutfits();
  }, [canAccess, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadItems = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?user_id=eq.${user!.id}&order=created_at.desc`, { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {}
  };

  const loadOutfits = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits?user_id=eq.${user!.id}&order=created_at.desc`, { headers: authHeaders });
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

  const handleItemPhoto = async (file: File) => {
    setItemPreview(URL.createObjectURL(file));
    setItemResult(null);
    if (!seasonData) return;
    setItemChecking(true);
    try {
      const base64 = await resizeAndEncode(file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
        body: JSON.stringify({ type: "check_item", image: base64, season: seasonData.season, mode: "single" }),
      });
      const data = await res.json();
      if (data.items?.[0]) setItemResult(data.items[0]);
    } catch {}
    finally { setItemChecking(false); }
  };

  const handleAddItem = async () => {
    if (!itemName.trim() || !itemResult || !user?.id) return;
    setLoading(true);
    try {
      const newItem = {
        user_id: user.id, name: itemName.trim(), category: itemCategory,
        colour_name: itemResult.colour_name, hex: itemResult.hex,
        verdict: itemResult.verdict, tip: itemResult.tip,
        starred: false, price: itemPrice ? parseFloat(itemPrice) : null,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(newItem),
      });
      const data = await res.json();
      if (Array.isArray(data)) setItems(prev => [data[0], ...prev]);
      setShowAddItem(false);
      setItemName(""); setItemCategory("Top"); setItemPrice("");
      setItemPreview(null); setItemResult(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {}
    finally { setLoading(false); }
  };

  const handleToggleStar = async (item: WardrobeItem) => {
    const updated = { ...item, starred: !item.starred };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.${item.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ starred: updated.starred }),
    }).catch(() => {});
  };
const handleDeleteOutfit = async (id: string) => {
  setOutfits(prev => prev.filter(o => o.id !== id));
  await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${id}`, {
    method: "DELETE", headers: authHeaders,
  }).catch(() => {});
};
  const handleDeleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`${SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.${id}`, {
      method: "DELETE", headers: authHeaders,
    }).catch(() => {});
  };

  const handleAddOutfit = async () => {
    if (!outfitName.trim() || selectedItemIds.length < 2 || !user?.id) return;
    setLoading(true);
    try {
      const outfitItems = items.filter(i => selectedItemIds.includes(i.id));
      const overall_verdict = outfitItems.filter(i => i.verdict).length >= outfitItems.length / 2;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/outfits`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, name: outfitName.trim(), item_ids: selectedItemIds, overall_verdict, starred: false }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setOutfits(prev => [data[0], ...prev]);
      setShowAddOutfit(false); setOutfitName(""); setSelectedItemIds([]);
    } catch {}
    finally { setLoading(false); }
  };

  const handleToggleOutfitStar = async (outfit: Outfit) => {
    const updated = { ...outfit, starred: !outfit.starred };
    setOutfits(prev => prev.map(o => o.id === outfit.id ? updated : o));
    await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${outfit.id}`, {
      method: "PATCH", headers: { ...authHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ starred: updated.starred }),
    }).catch(() => {});
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !seasonData) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const wardrobeContext = items.map(i => `${i.name} (${i.category}, ${i.colour_name}, ${i.verdict ? "suits season" : "doesn't suit season"})`).join(", ");
     const res = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT_KEY}` },
  body: JSON.stringify({
    type: "stylist_chat",
    message: userMsg.content,
    history: chatMessages.map(m => ({ role: m.role, content: m.content })),
    season: seasonData.season,
    subseason: seasonData.subseason,
    body_shape: seasonData.body_shape,
    wardrobe: items.map(i => `${i.name} (${i.category}, ${i.colour_name}, ${i.verdict ? "suits season" : "doesn't suit season"})`).join(", "),
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

  if (!canAccess) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
      <div style={{ width: 64, height: 64, borderRadius: DS.radius.lg, background: DS.colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Icon name="hanger" size={28} color={DS.colors.accent} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 10, textAlign: "center" }}>Your Wardrobe</h2>
      <p style={{ fontSize: 15, color: DS.colors.textMuted, textAlign: "center", lineHeight: 1.6, maxWidth: 260, marginBottom: 24 }}>Upgrade to Luxe to build your wardrobe, create outfits, and chat with your AI stylist.</p>
      <button onClick={onUpgrade} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: "#C26B3A", color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>Unlock Wardrobe</button>
    </div>
  );

  const filteredItems = items.filter(i => {
    if (filterStarred && !i.starred) return false;
    if (filterCategory !== "All" && i.category !== filterCategory) return false;
    return true;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: DS.colors.bg }}>
      {/* Tab switcher */}
      <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", background: DS.colors.surface, borderRadius: DS.radius.lg, padding: 4, gap: 4 }}>
          {(["items", "outfits", "chat"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "8px 4px", borderRadius: DS.radius.md, fontSize: 13, fontWeight: view === v ? 600 : 400, color: view === v ? DS.colors.white : DS.colors.textMuted, background: view === v ? DS.colors.accent : "transparent", transition: "all 0.2s" }}>
              {v === "items" ? "Wardrobe" : v === "outfits" ? "Outfits" : "Stylist"}
            </button>
          ))}
        </div>
      </div>

      {/* Items view */}
      {view === "items" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            <button onClick={() => setFilterStarred(!filterStarred)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterStarred ? "#FFD700" : DS.colors.surface, color: filterStarred ? "#7A5800" : DS.colors.textMuted, flexShrink: 0 }}>
              ★ Starred
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "5px 12px", borderRadius: DS.radius.full, fontSize: 12, fontWeight: 500, background: filterCategory === cat ? DS.colors.accent : DS.colors.surface, color: filterCategory === cat ? DS.colors.white : DS.colors.textMuted, flexShrink: 0, transition: "all 0.2s" }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Items grid */}
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Icon name="hanger" size={40} color={DS.colors.border} />
              <p style={{ fontSize: 15, color: DS.colors.textMuted, marginTop: 12 }}>No items yet</p>
              <p style={{ fontSize: 13, color: DS.colors.textFaint, marginTop: 4 }}>Add your first item to get started</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 80 }}>
              {filteredItems.map(item => (
                <div key={item.id} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: DS.radius.md, background: item.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{item.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.category}</span>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>·</span>
                        <span style={{ fontSize: 11, color: DS.colors.textFaint }}>{item.colour_name}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ padding: "3px 8px", borderRadius: DS.radius.full, background: item.verdict ? "#F0FDF4" : "#FEF2F2" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.verdict ? DS.colors.success : DS.colors.danger }}>{item.verdict ? "✓" : "✗"}</span>
                      </div>
                      <button onClick={() => handleToggleStar(item)} style={{ fontSize: 16, color: item.starred ? "#FFD700" : DS.colors.border }}>★</button>
                      <button onClick={() => handleDeleteItem(item.id)}><Icon name="trash" size={14} color={DS.colors.textFaint} /></button>
                    </div>
                  </div>
                  {item.tip && <p style={{ margin: "8px 0 0", fontSize: 12, color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.tip}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Add item button */}
          <button onClick={() => setShowAddItem(true)} style={{ position: "fixed", bottom: 96, right: 20, width: 52, height: 52, borderRadius: DS.radius.full, background: DS.colors.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: DS.shadow.lg }}>
            <Icon name="plus" size={24} color={DS.colors.white} />
          </button>
        </div>
      )}

      {/* Outfits view */}
      {view === "outfits" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {outfits.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Icon name="star" size={40} color={DS.colors.border} />
              <p style={{ fontSize: 15, color: DS.colors.textMuted, marginTop: 12 }}>No outfits yet</p>
              <p style={{ fontSize: 13, color: DS.colors.textFaint, marginTop: 4 }}>Combine wardrobe items into saved outfits</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 80 }}>
              {outfits.map(outfit => {
                const outfitItems = items.filter(i => outfit.item_ids.includes(i.id));
                return (
                  <div key={outfit.id} style={{ background: DS.colors.bg, borderRadius: DS.radius.lg, border: `1px solid ${DS.colors.border}`, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DS.colors.text }}>{outfit.name}</p>
                        <div style={{ padding: "2px 8px", borderRadius: DS.radius.full, background: outfit.overall_verdict ? "#F0FDF4" : "#FEF2F2" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: outfit.overall_verdict ? DS.colors.success : DS.colors.danger }}>{outfit.overall_verdict ? "Works" : "Needs work"}</span>
                        </div>
                      </div>
                      <button onClick={() => handleToggleOutfitStar(outfit)} style={{ fontSize: 16, color: outfit.starred ? "#FFD700" : DS.colors.border }}>★</button>
                      <button onClick={() => handleDeleteOutfit(outfit.id)}><Icon name="trash" size={14} color={DS.colors.textFaint} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {outfitItems.map(item => (
                        <div key={item.id} style={{ textAlign: "center" }}>
                          <div style={{ width: 36, height: 36, borderRadius: DS.radius.sm, background: item.hex, border: "1px solid rgba(0,0,0,0.08)" }} />
                          <p style={{ margin: "3px 0 0", fontSize: 9, color: DS.colors.textFaint, maxWidth: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
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
                <p style={{ fontSize: 13, color: DS.colors.textMuted, lineHeight: 1.6, maxWidth: 240, margin: "0 auto" }}>Ask me anything about your style, outfits, or what to wear for any occasion. Add items to your wardrobe first for personalised outfit suggestions.</p>
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
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? `${DS.radius.lg} ${DS.radius.lg} 4px ${DS.radius.lg}` : `${DS.radius.lg} ${DS.radius.lg} ${DS.radius.lg} 4px`, background: msg.role === "user" ? DS.colors.accent : DS.colors.surface, color: msg.role === "user" ? DS.colors.white : DS.colors.text }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
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
              <div onClick={() => fileRef.current?.click()} style={{ borderRadius: DS.radius.lg, border: `2px dashed ${DS.colors.border}`, background: DS.colors.surface, height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative", marginBottom: 16 }}>
                {itemPreview ? (
                  <img src={itemPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <Icon name="camera" size={24} color={DS.colors.accent} />
                    <p style={{ fontSize: 13, color: DS.colors.textMuted, marginTop: 8 }}>Photo of item</p>
                  </>
                )}
                {itemChecking && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ color: DS.colors.white, fontSize: 13 }}>Checking colour...</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleItemPhoto(f); }} />

              {/* Colour result */}
              {itemResult && (
                <div style={{ padding: "10px 14px", borderRadius: DS.radius.md, background: itemResult.verdict ? "#F0FDF4" : "#FEF2F2", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: itemResult.hex, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.colors.text }}>{itemResult.colour_name} — {itemResult.verdict ? "✓ Suits your season" : "✗ Doesn't suit your season"}</p>
                    <p style={{ margin: 0, fontSize: 12, color: DS.colors.textMuted }}>{itemResult.tip}</p>
                  </div>
                </div>
              )}

              {/* Item name */}
              <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item name (e.g. Blue linen top)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 12, fontFamily: DS.font }} />

              {/* Category */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessories"].map(cat => (
                  <button key={cat} onClick={() => setItemCategory(cat)} style={{ padding: "6px 14px", borderRadius: DS.radius.full, fontSize: 13, fontWeight: 500, background: itemCategory === cat ? DS.colors.accent : DS.colors.surface, color: itemCategory === cat ? DS.colors.white : DS.colors.textMuted, transition: "all 0.2s" }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Price (optional) */}
              <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="Price (optional, e.g. 49.99)" type="number" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 20, fontFamily: DS.font }} />

              <button onClick={handleAddItem} disabled={!itemName.trim() || !itemResult || loading} style={{ width: "100%", padding: "16px", borderRadius: DS.radius.lg, background: !itemName.trim() || !itemResult ? DS.colors.border : DS.colors.accent, color: DS.colors.white, fontSize: 16, fontWeight: 600 }}>
                {loading ? "Adding..." : "Add to wardrobe"}
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
              <input value={outfitName} onChange={e => setOutfitName(e.target.value)} placeholder="Outfit name (e.g. Work Monday)" style={{ width: "100%", padding: "12px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${DS.colors.border}`, fontSize: 14, color: DS.colors.text, background: DS.colors.bg, outline: "none", marginBottom: 16, fontFamily: DS.font }} />
              <p style={{ fontSize: 13, color: DS.colors.textMuted, marginBottom: 12 }}>Select items (minimum 2):</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {items.map(item => {
                  const selected = selectedItemIds.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => setSelectedItemIds(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id])} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: DS.radius.md, border: `1.5px solid ${selected ? DS.colors.accent : DS.colors.border}`, background: selected ? DS.colors.accentLight : DS.colors.bg, textAlign: "left" }}>
                      <div style={{ width: 32, height: 32, borderRadius: DS.radius.sm, background: item.hex, flexShrink: 0 }} />
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
    </div>
  );
};
const PlaceholderTab = ({ tab, isGuest, onSignUp }: { tab: Tab; isGuest: boolean; onSignUp: () => void; }) => {
  const locked = isGuest && tab !== "home";
  if (locked) {
    const tabInfo: Record<string, { icon: string; title: string; body: string }> = {
      checker: { icon: "image", title: "Check your colours", body: "Check any item, outfit or swatches against your season." },
      wardrobe: { icon: "hanger", title: "Build your wardrobe", body: "Save and manage your colour-approved wardrobe." },
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
      <p style={{ fontSize: 13, color: DS.colors.textFaint }}>Foundation deployed</p>
    </div>
  );
};

// MainApp — NO SheetOverlay here, it lives at root level
const MainApp = ({ activeTab, onTabChange, seasonData, user, isGuest, onSignUp, onOpenSheet, onUpgrade, onSignOut, onReanalyse }: {
  activeTab: Tab; onTabChange: (tab: Tab) => void; seasonData: SeasonData | null;
  user: User | null; isGuest: boolean; onSignUp: () => void;
  onOpenSheet: (sheet: Sheet) => void; onUpgrade: () => void; onSignOut: () => void; onReanalyse: () => void;
}) => (
  <div className="screen fade-in" style={{ background: DS.colors.bg }}>
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {activeTab === "home" ? (
  <HomeTab seasonData={seasonData} user={user} onOpenSheet={onOpenSheet} onUpgrade={onUpgrade} />
       ) : activeTab === "checker" ? (
  <CheckerTab seasonData={seasonData} user={user} onUpgrade={onUpgrade} />
) : activeTab === "me" ? (
  <MeTab user={user} seasonData={seasonData} onSignOut={onSignOut} onReanalyse={onReanalyse} onUpgrade={onUpgrade} />
) : activeTab === "wardrobe" ? (
  <WardrobeTab user={user} seasonData={seasonData} onUpgrade={onUpgrade} />
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
    wardrobeItems: [], checkerMode: "single", onboardingIndex: 0,
  });
  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));

  const handleSignOut = () => {
    localStorage.removeItem("chroma_token");
    localStorage.removeItem("chroma_refresh");
    localStorage.removeItem("chroma_user");
    update({ screen: "auth", user: null, seasonData: null, isGuest: false, activeSheet: null, activeTab: "home" });
  };

  const handleReanalyse = () => {
    localStorage.removeItem(`chroma_season_${state.user?.id || "guest"}`);
    update({ screen: "upload", seasonData: null, activeTab: "home" });
  };

  const handleUpgrade = (plan: Plan) => {
    const updatedUser = state.user ? { ...state.user, plan } : null;
    if (updatedUser) localStorage.setItem("chroma_user", JSON.stringify(updatedUser));
    update({ user: updatedUser, activeSheet: null });
  };
  useEffect(() => {
  const token = localStorage.getItem("chroma_token");
  const cachedUser = localStorage.getItem("chroma_user");
  if (token && cachedUser) {
    try {
      const parsedUser = JSON.parse(cachedUser);
      const cachedSeason = localStorage.getItem(`chroma_season_${parsedUser.id}`);
      if (cachedSeason) {
        const parsedSeason = JSON.parse(cachedSeason);
        update({ screen: "main", user: parsedUser, seasonData: parsedSeason });
      } else {
        update({ screen: "main", user: parsedUser });
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}&select=season_data`, {
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(data => {
          if (data?.[0]?.season_data) {
            const season = data[0].season_data;
            localStorage.setItem(`chroma_season_${parsedUser.id}`, JSON.stringify(season));
            update({ seasonData: season });
          }
        }).catch(() => {});
      }

      // Check for successful Stripe checkout
      const params = new URLSearchParams(window.location.search);
      const checkout = params.get("checkout");
      const plan = params.get("plan") as Plan | null;
      const billing = params.get("billing");
      if (checkout === "success" && plan && token) {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${parsedUser.id}`, {
          method: "PATCH",
          headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
          body: JSON.stringify({ user_plan: plan, user_billing: billing || "monthly" }),
        }).catch(() => {});
        const updatedUser = { ...parsedUser, plan };
        localStorage.setItem("chroma_user", JSON.stringify(updatedUser));
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
    localStorage.setItem(`chroma_season_${state.user?.id || "guest"}`, JSON.stringify(data));
    // Save to Supabase if logged in
    const token = localStorage.getItem("chroma_token");
    if (token && state.user?.id) {
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${state.user.id}`, {
        method: "PATCH",
        headers: { ...supabaseHeaders, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
        body: JSON.stringify({ season_data: data }),
      }).catch(() => {});
    }
    update({ seasonData: data, screen: "main" });
  } catch { update({ screen: "main" }); }
};

  const { screen, activeTab, user, isGuest, seasonData } = state;

  return (
    <>
      <GlobalStyles />
      {/* Root container — SheetOverlay renders here, OUTSIDE all overflow:hidden screens */}
      <div style={{ position: "relative", width: "100vw", height: "100vh", maxWidth: 430, margin: "0 auto" }}>
        {screen === "splash" && <SplashScreen onComplete={() => update({ screen: "onboarding" })} />}
        {screen === "onboarding" && <OnboardingScreen onComplete={() => update({ screen: "auth" })} />}
        {screen === "auth" && <AuthScreen onSignIn={u => {
  const cachedSeason = localStorage.getItem(`chroma_season_${u.id}`);
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
            onSignUp={() => update({ screen: "auth" })}
            onOpenSheet={sheet => update({ activeSheet: sheet })}
            onUpgrade={() => update({ activeSheet: "paywall" })}
            onSignOut={handleSignOut}
            onReanalyse={handleReanalyse}
          />
        )}
{/* SheetOverlay at root level — position:fixed works here, not clipped by any overflow:hidden */}
        {state.activeSheet && state.activeSheet !== "paywall" && seasonData && (
          <SheetOverlay
            activeSheet={state.activeSheet}
            seasonData={seasonData}
            onClose={() => update({ activeSheet: null })}
          />
        )}
        {state.activeSheet === "paywall" && (
  <PaywallSheet
    currentPlan={state.user?.plan || "free"}
    onUpgrade={handleUpgrade}
    onClose={() => update({ activeSheet: null })}
    isGuest={state.isGuest}
    onSignUp={() => { update({ activeSheet: null, screen: "auth" }); }}
  />
)}
      </div>
    </>
  );
}