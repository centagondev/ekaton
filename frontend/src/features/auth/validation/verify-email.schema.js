import * as yup from "yup";

export const verifyEmailSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required("Email is required.")
    .email("Please enter a valid email address.")
    .max(254, "Email is too long."),
});
