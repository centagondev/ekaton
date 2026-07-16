import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center bg-[#FBF9F5] px-4 py-12 text-center">
      <div className="mx-auto flex max-w-2xl flex-col items-center space-y-8">
        {/* Top Badge */}
        <div className="border-2 border-black bg-white px-4 py-1 font-mono text-xs font-bold tracking-widest text-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          ANONYMOUS & SECURE
        </div>

        {/* Main Headline */}
        <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-4xl font-black tracking-tight text-black uppercase sm:text-6xl">
          <span>MEET SOMEONE</span>
          <span className="inline-block -rotate-1 transform border-2 border-black bg-[#FFD600] px-3 py-1 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            NEW.
          </span>
        </h1>

        {/* Subheading Description */}
        <p className="max-w-lg text-base font-medium text-gray-700 sm:text-lg">
          Real conversations with real students, completely anonymous. No
          profiles, no pressure, just connection.
        </p>

        {/* Call To Action Button */}
        <button className="group relative flex cursor-pointer items-center justify-center space-x-3 border-2 border-black bg-[#FFD600] px-8 py-4 text-base font-extrabold tracking-wider text-black uppercase shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none">
          <span>START CHAT</span>
          <ArrowRight className="h-5 w-5 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-1" />
        </button>

        {/* Live Status Card */}
        <div className="flex flex-col items-center justify-center space-y-0.5 border-2 border-black bg-white px-5 py-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold tracking-wider text-black uppercase">
              247 STUDENTS ONLINE
            </span>
          </div>
          <span className="text-[11px] font-medium text-gray-500">
            Average wait time: 5 seconds
          </span>
        </div>
      </div>
    </main>
  );
}
