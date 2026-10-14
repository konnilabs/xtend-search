export async function savePreferences({values},{signal},fetchPreferences=fetch){
 const body=new URLSearchParams(values);
 const response=await fetchPreferences('/preferences',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'},body,signal});
 if(!response.ok)throw Error('save');
 const check=await fetchPreferences('/preferences',{credentials:'same-origin',cache:'no-store',signal});
 if(!check.ok)throw Error('verify');const {preferences}=await check.json(),cleared=body.get('preferenceAction')==='delete';
 if(cleared?preferences!==null:!['language','time_range','safesearch'].every(key=>preferences?.[key]===body.get(key)))throw Error('cookie blocked');
 return {message:cleared?'Gespeicherter Standard gelöscht. Die aktuelle Suche bleibt unverändert.':'Standard für diesen Browser gespeichert.'};
}
