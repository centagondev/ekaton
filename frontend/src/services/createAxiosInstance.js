import axios from "axios"

export const createAxiosInstance= ()=>{
	return axios.create({
		baseURL:"",
		withCredentials: true,
		headers:{
			"Content-Type": "application/json"
		}
	})
}