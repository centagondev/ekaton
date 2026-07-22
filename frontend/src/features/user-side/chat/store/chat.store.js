import { create } from "zustand";
import { startChatApi } from "../api/chat.api";

export const useChatStore= create(()=>({
	loading: null,


	startChat: async()=>{
		try{
			const result= await startChatApi()

			console.log(result)
			return result
		}catch(err){
			console.log(err)
		}
	}
}))