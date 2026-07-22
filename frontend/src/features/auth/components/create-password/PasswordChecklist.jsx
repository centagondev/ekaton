import PasswordRequirement from "./PasswordRequirement";

const PasswordChecklist = ({ password }) => {
  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  return (
    <div className="grid grid-cols-2 gap-y-4 pt-8">
      <PasswordRequirement label="8+ Characters" passed={rules.length} />

      <PasswordRequirement label="1+ Number" passed={rules.number} />

      <PasswordRequirement label="Uppercase Letter" passed={rules.uppercase} />
      <PasswordRequirement label="Lowercase Letter" passed={rules.lowercase} />
      <PasswordRequirement label="Special Symbol" passed={rules.symbol} />
    </div>
  );
};

export default PasswordChecklist;
