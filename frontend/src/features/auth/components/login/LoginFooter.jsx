import { Link } from "react-router-dom";

const LoginFooter = () => {
  return (
    <div className="space-y-4 text-center">
      <Link
        to="/forgot-password"
        className="block text-sm font-medium underline"
      >
        Forgot Password?
      </Link>

      <p className="text-sm">
        New to Campus Connect?{" "}
        <Link to="/verify-email" className="font-bold underline">
          Verify your email
        </Link>
      </p>
    </div>
  );
};

export default LoginFooter;
