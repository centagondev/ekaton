import CreatePasswordPage from "@/features/auth/pages/CreatePasswordPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import LoginPage from "@/features/auth/pages/LoginPage";
import VerifyEmailPage from "@/features/auth/pages/VerifyEmailPage";

export const authRoutes = [
	{ 
	path: "/verify-email", 
	element: <VerifyEmailPage /> 
	},
	{
		path:"/create-password",
		element: <CreatePasswordPage/>
	},
	{
		path: "/login",
		element: <LoginPage/>
	},
	{
		path: "/forgot-password",
		element: <ForgotPasswordPage/>
	}
	
	];
