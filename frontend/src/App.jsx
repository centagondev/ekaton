import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { Toaster } from "sonner";

const App = () => {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton duration={3000} />
    </>
  );
}

export default App
