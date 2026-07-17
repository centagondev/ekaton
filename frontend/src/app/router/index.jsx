import { createBrowserRouter } from "react-router-dom";

import { publicRoutes } from "./public-routes";
import { chatRoutes } from "./chat-routes";

export const router = createBrowserRouter([
  publicRoutes, 
  chatRoutes,
  ]);
