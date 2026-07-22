const CountdownTimer = ({ seconds }) => {
  const minutes = Math.floor(seconds / 60);

  const remainingSeconds = seconds % 60;

  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;

  return (
    <span className="text-sm font-medium">
      Resend available in {formattedTime}
    </span>
  );
};

export default CountdownTimer;
