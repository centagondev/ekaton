import MessageBubble from "./MessageBubble";

const ChatMessages = ({ messages }) => {
  return (
    <section className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </section>
  );
};

export default ChatMessages;
