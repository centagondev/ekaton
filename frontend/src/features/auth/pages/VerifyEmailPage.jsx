import AuthHeader from "../components/AuthHeader";
import AuthLayout from "../components/AuthLayout";
import EmailInput from "../components/EmailInput";
import VerifyButton from "../components/VerfyButton";

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <AuthHeader />

      <EmailInput />

      <VerifyButton />
    </AuthLayout>
  );
}
