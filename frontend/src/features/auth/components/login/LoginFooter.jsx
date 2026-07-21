import { Link, useNavigate } from "react-router-dom";

const LoginFooter = () => {
  return (
    <div className="space-y-4 text-center">
      <Link to="/forgot-password" className="block text-sm font-medium underline">
        Forgot Password?
      </Link>

      <p className="text-sm">
        Don't have an account?{" "}
        <Link to="/verify-email" className="font-bold underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
};

export default LoginFooter;
