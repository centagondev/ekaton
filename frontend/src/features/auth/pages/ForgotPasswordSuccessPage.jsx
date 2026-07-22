import AuthCard from "@/shared/components/app-components/AuthCard";
import AuthHeader from "../components/auth-components/AuthHeader";
import CheckMailBanner from "../components/forgot-password-success/CheckMailBanner";
import CheckMailButton from "../components/forgot-password-success/CheckMailButton";
import ResendEmail from "../components/forgot-password-success/ResendEmail";
import useForgotPasswordSuccess from "../hooks/useForgotPasswordSuccess";

const ForgotPasswordSuccessPage = () => {
  const { seconds, canResend, handleResend, handleOpenMail } =
    useForgotPasswordSuccess();

  return (
    <AuthCard>
      <div className="space-y-10">
        <AuthHeader title="Campus Connect" subtitle="Forgot Password" />

        <CheckMailBanner
          title="Check Your Email"
          description="We have sent a verification email to your registered email address to help you reset your password. Please check your inbox and follow the instructions."
        />

        <CheckMailButton onClick={handleOpenMail} />

        <ResendEmail
          seconds={seconds}
          canResend={canResend}
          onResend={handleResend}
        />
      </div>
    </AuthCard>
  );
};

export default ForgotPasswordSuccessPage;
