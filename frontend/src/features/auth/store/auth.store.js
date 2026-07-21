import { create } from "zustand";
import { setPasswordApi, verifyEmailApi } from "../api/auth.api";

export const useAuthStore=create(()=>({
loading: false,


verifyEmail: async(email)=>{
	try{
		const result= await verifyEmailApi(email)
		console.log("verify-email", result)
		return result.data
	}catch(err){
		console.log(err)
throw err
	}
},

setPassword: async(payload)=>{
try{
const result= await setPasswordApi(payload)
console.log("setpassword", result)
return result.data
}catch(err){
console.log(err)
throw err
}
}

}))