import { requireGuest } from "@/lib/auth-session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireGuest(); // already logged in → redirect to /dashboard

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#070b12] overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] size-[500px] rounded-full bg-blue-500/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] size-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />
      
      <div className="relative z-10 w-full max-w-md px-4 py-12">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <span className="text-2xl font-black text-white italic tracking-tighter">X</span>
          </div>
          <p className="mt-4 text-xs font-bold tracking-widest text-slate-500 uppercase">
            Future of Exchange
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}