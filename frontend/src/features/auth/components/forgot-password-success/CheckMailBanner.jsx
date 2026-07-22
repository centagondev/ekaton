import { MailCheck } from "lucide-react";

const CheckMailBanner = ({ title, description }) => {
  return (
    <div className="bg-brand-lavender border-3 border-black p-6">
      <div className="flex items-start gap-4">
        <MailCheck className="mt-1 size-10 shrink-0" />

        <div>
          <h2 className="text-lg font-bold uppercase">{title}</h2>

          <p className="mt-3 leading-8 text-gray-700">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default CheckMailBanner;
