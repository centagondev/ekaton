import { GuestNavbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { Hero } from "@/features/home/Hero";
import { useUiStore } from "@/stores/ui.store";

/** Guests land here; "Start chat" raises the auth modal instead of navigating. */
export function LandingPage() {
  const openAuthModal = useUiStore((state) => state.openAuthModal);

  return (
    <div className="flex min-h-dvh flex-col">
      <GuestNavbar onLogin={() => openAuthModal("/home")} />
      <PageTransition className="flex flex-1 items-center justify-center">
        <Hero onStart={() => openAuthModal("/home")} />
      </PageTransition>
    </div>
  );
}
