import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ROUTES } from "./rootPaths";

const GuestRoute = () => {
	const user= useAuthStore((state)=> state.user)

  const isAuthenticated = !!user;

  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
