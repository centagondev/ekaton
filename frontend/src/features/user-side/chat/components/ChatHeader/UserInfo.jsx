import { UserCircle2 } from "lucide-react";

const UserInfo = ({ name = "Stranger", online = true }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-white">
        <UserCircle2 size={22} />
      </div>

      <div>
        <h2 className="text-lg font-bold">{name}</h2>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />

          <span className="text-xs text-gray-500">
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
