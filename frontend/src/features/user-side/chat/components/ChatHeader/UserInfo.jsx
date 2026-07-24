import { UserCircle2 } from "lucide-react";

const UserInfo = ({ name = "Stranger", online = true }) => {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      {/* Avatar box — slightly smaller on mobile */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-white sm:h-10 sm:w-10">
        <UserCircle2 size={18} className="sm:hidden" />
        <UserCircle2 size={22} className="hidden sm:block" />
      </div>

      {/* Name + status — truncate long names on tiny screens */}
      <div className="min-w-0">
        <h2 className="truncate text-base font-bold leading-tight sm:text-lg">
          {name}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              online ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-xs text-gray-500">
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
