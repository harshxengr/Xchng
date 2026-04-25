import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { AppTopNav } from "@/components/AppTopNav";
import { getSession } from "@/lib/auth-session";

export default async function HomePage() {
  const session = await getSession();
  
  const user = session ? {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null
  } : null;

  return (
    <main className="min-h-screen bg-[#070a11] text-white selection:bg-emerald-500/30">
      <AppTopNav user={user} />
      
      {/* Hero Section - Single Section Design */}
      <section className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
        {/* Background Gradients */}
        <div className="absolute top-1/4 -left-20 size-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 size-96 rounded-full bg-blue-500/10 blur-[120px]" />
        
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-400">
            <Zap className="size-3" />
            <span>Next Generation Crypto Exchange</span>
          </div>
          
          <h1 className="mb-6 text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">
            Trade with <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Confidence.</span>
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
            The world's most advanced digital asset exchange. Fast, secure, and built for everyone. Experience seamless trading with zero compromise.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {session ? (
              <Link href="/markets">
                <Button size="lg" className="h-14 rounded-2xl bg-emerald-500 px-8 text-base font-bold text-slate-950 hover:bg-emerald-400">
                  Go to Markets
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-up">
                  <Button size="lg" className="h-14 rounded-2xl bg-emerald-500 px-8 text-base font-bold text-slate-950 hover:bg-emerald-400">
                    Get Started Now
                    <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
                <Link href="/markets">
                  <Button size="lg" variant="outline" className="h-14 rounded-2xl border-white/10 bg-white/5 px-8 text-base font-bold text-white hover:bg-white/10">
                    View Live Markets
                  </Button>
                </Link>
              </>
            )}
          </div>
          
          {/* Simple Feature Bar */}
          <div className="mt-20 grid grid-cols-1 gap-8 border-t border-white/5 pt-12 sm:grid-cols-3">
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                <Zap className="size-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Ultra-Fast</p>
                <p className="text-xs text-slate-500">100k+ TPS matching engine</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                <ShieldCheck className="size-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Secure</p>
                <p className="text-xs text-slate-500">Bank-grade encryption</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                <BarChart3 className="size-5 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Analytics</p>
                <p className="text-xs text-slate-500">Real-time market insights</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle Bottom Glow */}
        <div className="absolute bottom-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      </section>
    </main>
  );
}
