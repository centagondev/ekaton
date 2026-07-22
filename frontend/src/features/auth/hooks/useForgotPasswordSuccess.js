import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

const useForgotPasswordSuccess = () => {
  const [seconds, setSeconds] = useState(60);
  const resendPasswordReset= useAuthStore((state)=> state.resendPasswordReset)
const {state}= useLocation()
console.log("forg", state)

  useEffect(() => {
    if (seconds === 0) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const canResend = seconds === 0;

  const handleResend = async() => {
    console.log("Resend Email");

    try{
      setSeconds(10);
      await resendPasswordReset(state);
      toast.success("Email sent successfully")
    }catch(err){
      toast.error(err?.response?.data?.message || "Resend failed")
    }

    
  };

  const handleOpenMail = () => {
    window.open("https://mail.google.com", "_blank");
  };

  return {
    seconds,
    canResend,
    handleResend,
    handleOpenMail,
  };
};

export default useForgotPasswordSuccess;
