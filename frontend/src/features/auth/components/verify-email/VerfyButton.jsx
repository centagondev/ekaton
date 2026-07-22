import { ArrowRight } from "lucide-react";
import Button from "@/shared/components/app-components/Button";

const VerifyButton = ({ loading = false, ...props }) => {
  return (
    <Button
      type="submit"
      title={loading ? "Verifying..." : "Verify"}
      icon={<ArrowRight size={18} />}
      className="w-full"
      disabled={loading}
      {...props}
    />
  );
};

export default VerifyButton;
