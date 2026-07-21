import { ArrowRight } from "lucide-react";
import Button from "@/shared/components/app-components/Button";

const ForgotPasswordButton = ({ loading }) => {
  return (
    <Button
      type="submit"
      title={loading ? "Sending..." : "Send Verification Email"}
      icon={<ArrowRight />}
      className="w-full"
      disabled={loading}
    />
  );
};

export default ForgotPasswordButton;
