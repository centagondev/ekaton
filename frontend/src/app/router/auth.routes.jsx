
import CreatePasswordPage from "@/features/auth/pages/CreatePasswordPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import ForgotPasswordSuccessPage from "@/features/auth/pages/ForgotPasswordSuccessPage";
import LoginPage from "@/features/auth/pages/LoginPage";
import VerifyEmailPage from "@/features/auth/pages/VerifyEmailPage";
import GuestRoute from "./GuestRouter";

export const authRoutes = {
  element: <GuestRoute />,
  children: [
    {
      path: "/verify-email",
      element: <VerifyEmailPage />,
    },
    {
      path: "/set-password",
      element: <CreatePasswordPage />,
    },
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/forgot-password",
      element: <ForgotPasswordPage />,
    },
    {
      path: "/forgot-password-success",
      element: <ForgotPasswordSuccessPage />,
    },
  ],
};
