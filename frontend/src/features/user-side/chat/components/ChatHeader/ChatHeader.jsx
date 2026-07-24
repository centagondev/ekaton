import BackButton from "./BackButton";
import UserInfo from "./UserInfo";
import RevealButton from "./RevealButton";
import ReportButton from "./ReportButton";

const ChatHeader = ({ user, onBack, onReveal, onReport }) => {
  return (
    <header className="flex items-center justify-between border-b-2 border-black bg-[#FBF9F5] px-3 py-2 sm:px-4 sm:py-3">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <BackButton onClick={onBack} />
        <UserInfo name={user.name} online={user.online} />
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <RevealButton onClick={onReveal} />
        <ReportButton onClick={onReport} />
      </div>
    </header>
  );
};

export default ChatHeader;
