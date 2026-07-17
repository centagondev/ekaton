import { useState } from "react";
import { Menu, Bell, User } from "lucide-react";

import NavItem from "./NavItem";
import MobileMenu from "./MobileMenu";
import { NAV_LINKS } from "./nav-links";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <h1 className="text-lg font-extrabold">CAMPUS CONNECT</h1>

        {/* Desktop */}

        <nav className="hidden h-full items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
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
        navLinks={NAV_LINKS}
        onClose={() => setIsOpen(false)}
      />
    </header>
  );
};

export default Navbar;
