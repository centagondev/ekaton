import AuthHeader from "../auth-components/AuthHeader";
import EmailField from "./EmailField";
import LoginButton from "./LoginButton";
import LoginFooter from "./LoginFooter";
import PasswordField from "./PasswordField";

const LoginForm = ({
  register,
  handleSubmit,
  onSubmit,
  errors,
  showPassword,
  togglePassword,
  isSubmitting,
}) => {
console.log(isSubmitting)
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <AuthHeader header="Login" />
      <EmailField register={register} error={errors.email} />

      <PasswordField
        register={register}
        error={errors.password}
        showPassword={showPassword}
        onToggleVisibility={togglePassword}
      />

      <LoginButton loading={isSubmitting} />

      <LoginFooter />
    </form>
  );
};

export default LoginForm;
