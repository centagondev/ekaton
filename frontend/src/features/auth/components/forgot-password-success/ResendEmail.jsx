import { TimerReset } from "lucide-react";
import CountdownTimer from "./CountdownTimer";

const ResendEmail = ({ canResend, seconds, onResend }) => {
  return (
    <div className="flex items-center justify-between">
      <button
        disabled={!canResend}
        onClick={onResend}
        className={`font-bold uppercase ${
          canResend ? "text-black hover:underline" : "text-gray-400"
        }`}
      >
        RESEND EMAIL
      </button>

      {!canResend && (
        <div className="flex items-center gap-2">
          <TimerReset className="size-4" />

          <CountdownTimer seconds={seconds} />
        </div>
      )}
    </div>
  );
};

export default ResendEmail;
