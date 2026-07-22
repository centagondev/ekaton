import { createAxiosInstance } from "./createAxiosInstance";
import { setupInterceptors } from "./interceptors";

const userApi= createAxiosInstance()
setupInterceptors(userApi);
export default userApi