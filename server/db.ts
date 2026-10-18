import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const dataDir = path.resolve(process.env.DATA_DIR || './data');
mkdirSync(dataDir,{recursive:true,mode:0o700});
export const db = new DatabaseSync(path.join(dataDir,'claimmate.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec('CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)');
for(const name of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort()) {
 if(!db.prepare('SELECT name FROM migrations WHERE name=?').get(name)) {
  db.exec('BEGIN'); try { db.exec(readFileSync(path.join('migrations',name),'utf8')); db.prepare('INSERT INTO migrations VALUES(?)').run(name); db.exec('COMMIT'); } catch(e){db.exec('ROLLBACK');throw e;}
 }
}
export function one(sql:string,...args:any[]):any{return db.prepare(sql).get(...args)}
export function all(sql:string,...args:any[]):any[]{return db.prepare(sql).all(...args)}
export function run(sql:string,...args:any[]){return db.prepare(sql).run(...args)}
export function transaction<T>(fn:()=>T):T {db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
