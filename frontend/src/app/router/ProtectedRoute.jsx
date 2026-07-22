import { Navigate, Outlet } from "react-router-dom";
import { ROUTES } from "./routes";

const ProtectedRoute = () => {

  const isAuthenticated = false;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
