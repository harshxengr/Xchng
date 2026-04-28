import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      
      <section className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        
        <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />
        
        <div className="relative z-10 mx-auto max-w-5xl pt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Exchange
          </div>

          <h1 className="mb-8 text-7xl font-black tracking-tight sm:text-8xl lg:text-9xl">
            <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">XCHNG</span>
            <span className="text-emerald-500">.</span>
          </h1>
          
          <p className="mx-auto mb-12 max-w-2xl text-lg font-light text-slate-400 sm:text-2xl">
            The next generation of <span className="text-white font-normal">digital asset trading</span>. 
            High performance, zero compromise.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
            {session ? (
              <Link href="/markets">
                <Button size="lg" className="h-16 rounded-full bg-emerald-500 px-10 text-lg font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105 hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                  Enter Exchange
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/sign-up">
                <Button size="lg" className="h-16 rounded-full bg-emerald-500 px-10 text-lg font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105 hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                  Start Trading
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="relative z-10 py-10 text-center border-t border-white/5">
        <p className="text-sm text-slate-500">
          © 2026 Xchng. Built by{" "}
          <Link 
            href="https://harshsaini.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
          >
            Harsh Saini
          </Link>
        </p>
      </footer>
    </main>
  );
}
