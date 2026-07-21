export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
