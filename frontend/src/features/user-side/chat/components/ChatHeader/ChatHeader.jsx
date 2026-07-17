import BackButton from "./BackButton";
import UserInfo from "./UserInfo";
import RevealButton from "./RevealButton";
import ReportButton from "./ReportButton";

const ChatHeader = ({ user, onBack, onReveal, onReport }) => {
  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-4">
      {/* Left */}

      <div className="flex items-center gap-4">
        <BackButton onClick={onBack} />

        <UserInfo name={user.name} online={user.online} />
      </div>

      {/* Right */}

      <div className="flex items-center gap-3">
        <RevealButton onClick={onReveal} />

        <ReportButton onClick={onReport} />
      </div>
    </header>
  );
};

export default ChatHeader;
