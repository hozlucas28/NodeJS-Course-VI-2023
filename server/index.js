import { createClient } from '@libsql/client'
import dotenv from 'dotenv'
import express from 'express'
import logger from 'morgan'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)

const io = new Server(server, {
	connectionStateRecovery: {},
})

const db = createClient({
	url: 'libsql://nodejs-course-vi-2023-hozlucas28.turso.io',
	authToken: process.env.TURSO_DB_TOKEN,
})

await db.execute(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT
)`)

io.on('connection', async (socket) => {
	socket.on('message', async (msg) => {
		const result = await db.execute({
			sql: `INSERT INTO messages (content) VALUES (:msg)`,
			args: { msg },
		})

		io.emit('message', msg, result.lastInsertRowid.toString())
	})

	if (socket.recovered) return

	const results = await db.execute({
		sql: 'SELECT id, content FROM messages WHERE id > :id',
		args: {
			id: socket.handshake.auth.serverOffset ?? 0,
		},
	})

	results.rows.forEach((row) => {
		socket.emit('message', row.content, row.id.toString())
	})
})

app.use(logger('dev'))

app.get('/', (_, res) => {
	res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
	console.log(`http://localhost:${port}`)
})
