import Navbar from "@/shared/layout/components/Navbar";
import { Outlet } from "react-router-dom";

const links = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Events",
    href: "/events",
  },
  {
    label: "Complaint Box",
    href: "/complaints",
  },
];

export const RootLayout= () =>{
  return (
    <>
      <Navbar links={links} notifications={2} avatar="/avatar.png" />

      <main>
        <Outlet />
      </main>
    </>
  );
}
