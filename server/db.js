import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { existsSync, mkdirSync } from 'fs'

if (!existsSync('./data')) mkdirSync('./data')

const db = new Database('./data/app.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

// Seed default user if none exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('jason')
if (!existing) {
  const hash = bcrypt.hashSync('jobhunt2026', 10)
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('jason', hash)
  console.log('Default user created: jason / jobhunt2026')
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username)
}

export function createSession(token, userId) {
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now())
}

export function getSession(token) {
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function updatePassword(userId, newHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId)
}

export default db
