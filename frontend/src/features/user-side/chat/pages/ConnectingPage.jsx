import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import ChatBanner from "../components/ChatBanner";

const ConnectingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate finding a stranger
    const timer = setTimeout(() => {
      navigate("/chat");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FBF9F5] px-4">
      <div className="flex w-full max-w-xl flex-col items-center">
        {/* Logo */}

        <h1 className="mb-12 text-center text-xl font-black tracking-wide">
          CAMPUS CONNECT
        </h1>

        {/* Animation */}

        <div className="relative flex h-52 w-52 items-center justify-center">
          <div className="absolute h-52 w-52 animate-spin rounded-full border-2 border-dashed border-black [animation-duration:8s]" />

          <div className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-black bg-white">
            <div className="bg-brand-yellow flex h-16 w-16 rotate-45 items-center justify-center border-2 border-black">
              😊
            </div>
          </div>

          <div className="bg-brand-yellow absolute top-2 -right-6 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0px_black]">
            Searching...
          </div>
        </div>

        {/* Title */}

        <h2 className="mt-12 text-center text-4xl font-black">
          Finding another student...
        </h2>

        <p className="mt-4 max-w-md text-center text-gray-600">
          Matching you with someone based on shared campus interests and
          academic goals.
        </p>

        {/* Status */}

        <div className="mt-10 w-full">
          <ChatBanner title="Initializing connection..." variant="info" />
        </div>

        {/* Progress */}

        <div className="mt-6 w-full">
          <div className="mb-2 flex justify-between text-xs font-bold uppercase">
            <span>Status</span>

            <span>Searching</span>
          </div>

          <div className="h-3 border-2 border-black bg-white">
            <div className="bg-brand-lime h-full w-1/3 animate-pulse" />
          </div>
        </div>

        {/* Cancel */}

        <button
          onClick={() => navigate("/")}
          className="mt-12 border-2 border-black bg-white px-8 py-4 font-bold uppercase shadow-[4px_4px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black]"
        >
          Cancel Search
        </button>
      </div>
    </main>
  );
};

export default ConnectingPage;
