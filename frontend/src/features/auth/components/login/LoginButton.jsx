import { ArrowRight } from "lucide-react";
import Button from "@/shared/components/app-components/Button";

const LoginButton = ({ loading }) => {
  return (
    <Button
      type="submit"
      title={loading ? "Logging in..." : "Login"}
      icon={<ArrowRight />}
      className="w-full"
      disabled={loading}
    />
  );
};

export default LoginButton;
