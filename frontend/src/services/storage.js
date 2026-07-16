export const storage={
	get: (key)=>{
		const value= localStorage.getItem(key)
		if(!value) return null

		try{
			return JSON.parse(value)
		}catch(err){
			console.log(err)
			return null
		}
	},

	set: (key, value)=>{
		localStorage.setItem(key, JSON.stringify(value))
	},

	remove: (key)=> {
		localStorage.removeItem(key)
	},
}