import { ArrowRight } from "lucide-react";

export default function VerifyButton() {
  return (
    <button className="mt-8 flex h-14 w-full items-center justify-center gap-2 border-2 border-black bg-yellow-400 font-black uppercase transition hover:bg-yellow-500">
      Verify
      <ArrowRight size={18} />
    </button>
  );
}
