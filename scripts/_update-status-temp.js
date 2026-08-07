'use strict'
const Database = require('better-sqlite3')
const db = new Database('./data/megag-pmo.db')
// Descubrir colunas da tabela usuarios
const cols = db.prepare('PRAGMA table_info(usuarios)').all()
console.log('Colunas:', cols.map(c => c.name).join(', '))
const users = db.prepare('SELECT * FROM usuarios WHERE ativo=1 LIMIT 3').all()
users.forEach(u => console.log(u))
