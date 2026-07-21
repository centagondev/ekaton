import * as yup from "yup";

export const loginSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required("Email is required.")
    .email("Please enter a valid email address."),

  password: yup.string().required("Password is required."),
});
