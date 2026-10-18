import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './db.ts';
export interface PrivateStorage { put(key:string,data:Buffer):Promise<void>;get(key:string):Promise<Buffer>;delete(key:string):Promise<void>; }
export class VolumeStorage implements PrivateStorage {
 root=path.resolve(process.env.UPLOAD_DIR || path.join(dataDir,'uploads'));
 private file(key:string){if(!/^[a-f0-9-]{36}$/.test(key))throw Error('Invalid storage key');return path.join(this.root,key);}
 async put(key:string,data:Buffer){await mkdir(this.root,{recursive:true,mode:0o700});await writeFile(this.file(key),data,{mode:0o600,flag:'wx'});}
 async get(key:string){return readFile(this.file(key));}
 async delete(key:string){await unlink(this.file(key)).catch((e)=>{if(e.code!=='ENOENT')throw e;});}
}
export const storage:PrivateStorage=new VolumeStorage();
