import { ShieldCheck } from "lucide-react";

const VerifyEmailBanner = () => {
  return (
    <div className="border-2 border-black bg-[#ECE8F8] p-4">
      <div className="flex gap-3">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" />

        <div>
          <h3 className="font-bold">Verify Your Official Email</h3>

          <p className="mt-2 text-sm leading-6 text-gray-700">
            Please enter the email address you registered with the BootCamp
            authorities. We'll send a verification link to this email. After
            verification, you'll be able to create your password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailBanner;
