import { Navigate, Outlet } from "react-router-dom";
import { ROUTES } from "./rootPaths";
import { useAuthStore } from "@/features/auth/store/auth.store";

const ProtectedRoute = () => {

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
