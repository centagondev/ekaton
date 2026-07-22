
import EmailField from "./EmailField";
import ForgotPasswordBanner from "./ForgotPasswordBanner";
import ForgotPasswordButton from "./ForgotPasswordButton";
import ForgotPasswordFooter from "./ForgotPasswordFooter";
import ForgotPasswordHeader from "./ForgotPasswordHeader";

const ForgotPasswordForm = ({
  register,
  handleSubmit,
  onSubmit,
  errors,
  isSubmitting,
}) => {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <ForgotPasswordHeader />

      <ForgotPasswordBanner />

      <EmailField register={register} error={errors.email} />

      <ForgotPasswordButton loading={isSubmitting} />

      <ForgotPasswordFooter />
    </form>
  );
};

export default ForgotPasswordForm;
