import { Bell, User, X } from "lucide-react";
import { NavLink } from "react-router-dom";

const MobileMenu = ({
  isOpen,
  onClose,
  navLinks,
  isAuthenticated,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
      <div className="flex h-full flex-col bg-white">
        {/* Header */}

        <div className="flex h-16 items-center justify-between border-b px-6">
          <h1 className="text-lg font-extrabold">CAMPUS CONNECT</h1>

          <div className="flex items-center gap-5">
            <Bell className="size-5" />

            <button onClick={onClose}>
              <X className="size-6" />
            </button>
          </div>
        </div>

        {/* Navigation */}

        <div className="space-y-3 p-4">
          {navLinks.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-3 font-bold tracking-wide uppercase transition ${
                  isActive
                    ? "bg-brand-yellow/15 text-amber-600"
                    : "hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {isAuthenticated && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="block w-full rounded-xl px-4 py-3 text-left font-bold tracking-wide uppercase hover:bg-gray-100"
            >
              LOGOUT
            </button>
          )}
        </div>

        {/* Profile */}

        <div className="mt-auto border-t">
          <button className="flex w-full items-center gap-4 p-5 text-left">
            <div className="bg-brand-lavender flex h-12 w-12 items-center justify-center rounded-xl">
              <User />
            </div>

            <div>
              <h3 className="font-bold">User Profile</h3>
              <p className="text-sm text-gray-500">Manage account</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
