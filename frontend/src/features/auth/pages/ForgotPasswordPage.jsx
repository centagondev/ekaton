import ForgotPasswordForm from "../components/forgot-password/ForgotPasswordForm";
import useForgotPassword from "../hooks/useForgotPassword";

const ForgotPasswordPage = () => {
  const forgotPassword = useForgotPassword();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F3EF] px-4 py-8">
      <section className="w-full max-w-xl border-2 border-black bg-white px-6 py-8 shadow-[5px_5px_0px_black] sm:px-10 sm:py-12">
        <ForgotPasswordForm {...forgotPassword} />
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
