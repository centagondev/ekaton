import { useState } from "react";
import { Bell, Menu, User } from "lucide-react";

import NavItem from "./NavItem";
import MobileMenu from "./MobileMenu";
import { getNavLinks } from "./nav-links";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";


const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);


  const user= useAuthStore((state) => state.user);
  const logout= useAuthStore((state)=> state.logout)
const isAuthenticated= !!user
const navigate= useNavigate()

  const navLinks = getNavLinks(isAuthenticated);

  const handleLogout = () => {
    logout()
    toast.success("Logout successfully")
    navigate("/verify-email")
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <h1 className="text-lg font-extrabold">CAMPUS CONNECT</h1>

        {/* Desktop Navigation */}

        <nav className="hidden h-full items-center gap-8 md:flex">
          {navLinks.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="text-xs font-bold tracking-wider text-gray-600 transition hover:text-black"
            >
              LOGOUT
            </button>
          )}
        </nav>

        {/* Desktop Right */}

        <div className="hidden items-center gap-5 md:flex">
          <Bell className="size-5 cursor-pointer" />

          <div className="bg-brand-lavender flex h-10 w-10 items-center justify-center rounded-xl">
            <User />
          </div>
        </div>

        {/* Mobile */}

        <button className="md:hidden" onClick={() => setIsOpen(true)}>
          <Menu className="size-6" />
        </button>
      </div>

      <MobileMenu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        navLinks={navLinks}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
    </header>
  );
};

export default Navbar;
