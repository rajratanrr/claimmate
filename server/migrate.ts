import { db } from './db.ts';
console.log('Applied migrations:',db.prepare('SELECT name FROM migrations').all());db.close();
