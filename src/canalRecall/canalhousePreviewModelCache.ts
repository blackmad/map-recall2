/** One request per model; a failed request remains retryable. */
export class CanalhousePreviewModelCache<Model> {
 private readonly pending=new Map<string,Promise<Model>>();
 constructor(private readonly load:(id:string)=>Promise<Model>){ }
 get(id:string):Promise<Model>{
  let request=this.pending.get(id);
  if(!request){
   request=this.load(id).catch(error=>{this.pending.delete(id);throw error;});
   this.pending.set(id,request);
  }
  return request;
 }
}
