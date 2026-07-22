import { useLocation } from "react-router-dom";
import LoginForm from "../components/login/LoginForm";
import useLogin from "../hooks/useLogin";

const LoginPage = () => {
    const { state } = useLocation();
    const email= state?.email
  
  const loginForm = useLogin(email);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F3EF] px-4 py-8">
      <section className="w-full max-w-lg border-2 border-black bg-white px-6 py-8 shadow-[5px_5px_0px_black] sm:px-10 sm:py-12">
        <LoginForm {...loginForm} />
      </section>
    </main>
  );
};

export default LoginPage;
