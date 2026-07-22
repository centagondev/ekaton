import { NavLink } from "react-router-dom";

const NavItem = ({ label, path }) => {
  return (
    <NavLink
      to={path}
      end={path === "/"}
      className={({ isActive }) =>
        `relative flex h-full items-center px-1 text-xs font-bold tracking-wider transition-colors duration-200 ${
          isActive ? "text-black" : "text-gray-600 hover:text-black"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}

          {isActive && (
            <span className="bg-brand-yellow absolute bottom-0 left-0 h-[3px] w-full rounded-t" />
          )}
        </>
      )}
    </NavLink>
  );
};

export default NavItem;
