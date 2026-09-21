import axios from "axios";
import toast from "react-hot-toast";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 20000,
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/auth") &&
      !error.config?.url?.startsWith("/public")
    )
      window.dispatchEvent(new Event("cf-session-expired"));
    return Promise.reject(error);
  },
);
export const message = (e) =>
  e.response?.data?.error || e.message || "Something went wrong";
export async function action(fn, success) {
  try {
    const result = await fn();
    if (success) toast.success(success);
    return result;
  } catch (e) {
    toast.error(message(e));
    throw e;
  }
}
