import { createBrowserRouter } from "react-router-dom";

import { publicRoutes } from "./public-routes";
import { chatRoutes } from "./chat-routes";
import { authRoutes } from "./auth.routes";
import { profileRoutes } from "./profile-routes";
import { eventRoutes } from "./event-routes";
import { miscRoutes } from "./misc-routes";

export const router = createBrowserRouter([
  publicRoutes,
  chatRoutes,
  authRoutes,
  profileRoutes,
  eventRoutes,
  miscRoutes,
]);

