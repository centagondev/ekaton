import AuthProgress from "../components/auth-components/AuthProgress";
import VerifyEmailBanner from "../components/auth-components/VerifyEmailBanner";
import AuthHeader from "../components/verify-email/AuthHeader";
import EmailInput from "../components/verify-email/EmailInput";
const VerifyEmailPage = () => {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F3EF] px-4 py-8">
      <section className="w-full max-w-xl border-[3px] border-black bg-white px-6 py-8 shadow-[6px_6px_0px_black] sm:px-8 sm:py-10">
        <AuthHeader />

        <div className="mt-8">
          <VerifyEmailBanner />
        </div>
        <div className="mt-6">
          <EmailInput />
        </div>

        <div className="mt-10 flex justify-center">
          <AuthProgress />
        </div>
      </section>
    </main>
  );
};


export default VerifyEmailPage;
