import * as yup from "yup";

export const setPasswordSchema = yup.object({
  password: yup
    .string()
    .required("Password is required.")
    .min(8, "Password must be at least 8 characters.")
    .matches(/[A-Z]/, "Must contain an uppercase letter.")
    .matches(/[a-z]/, "Must contain a lowercase letter.")
    .matches(/[0-9]/, "Must contain a number.")
    .matches(/[!@#$%^&*(),.?":{}|<>]/, "Must contain a special character."),

  confirm_password: yup
    .string()
    .required("Please confirm your password.")
    .oneOf([yup.ref("password")], "Passwords do not match."),
});
