import { AtSign } from "lucide-react";

export default function EmailInput() {
  return (
    <div className="mt-10">
      <label className="mb-2 block text-sm font-bold uppercase">
        University Email
      </label>

      <div className="relative">
        <input
          type="email"
          placeholder="student@university.edu"
          className="h-14 w-full border-2 border-black px-4 pr-12 outline-none"
        />

        <AtSign
          className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-600"
          size={20}
        />
      </div>
    </div>
  );
}
