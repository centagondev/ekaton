
import { Label } from "@/shared/components/ui/label";
import { AtSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { verifyEmailSchema } from "../../validation/verify-email.schema";
import InputError from "@/shared/components/app-components/InputError";
import VerifyButton from "./VerfyButton";
import { useAuthStore } from "../../store/auth.store";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
export default function EmailInput() {
  const navigate= useNavigate()
  const verifyEmail= useAuthStore((state)=> state.verifyEmail)
 const {
   register,
   handleSubmit,
   formState: { errors, isSubmitting },
 } = useForm({
   resolver: yupResolver(verifyEmailSchema),
   mode: "onBlur",
 });

   const onSubmit = async (data) => {
     console.log(data);

     try{
      const res= await verifyEmail(data)
      const { is_verified} = res.data
    console.log("1",res.data)
    console.log("2",res)
      if (is_verified) {
        toast.success(res.message || "Account is verified")
        navigate("/login", { state: { email: data.email } });
      }
     }catch(err){
      const errorData = err.response?.data;
       const errorMessage = Array.isArray(errorData)
         ? errorData[0]
         : errorData?.message ||
           Object.values(errorData || {})[0]?.[0] ||
           "Something went wrong";

       toast.error(errorMessage);
     }

     
   };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email">Your Email</Label>

        <div className="relative">
          <input
            id="email"
            type="email"
            placeholder="student@gmail.com"
            className="h-14 w-full border-2 border-black px-4 pr-12 outline-none"
            {...register("email")}
          />

          <AtSign
            className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-600"
            size={20}
          />
        </div>

        {errors.email && <InputError errors={errors.email.message} />}
      </div>

      <VerifyButton loading={isSubmitting} />
    </form>
  );
}
