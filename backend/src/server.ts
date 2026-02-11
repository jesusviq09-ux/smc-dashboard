import http from 'http'
import { Server as SocketServer } from 'socket.io'
import dotenv from 'dotenv'
import app from './app'
import { connectDB } from './config/database'
import { syncModels } from './models/index'
import { seedDatabase } from './seeds/run'

dotenv.config()

const PORT = parseInt(process.env.PORT || '3001')

async function bootstrap() {
  try {
    // Connect to DB
    await connectDB()
    await syncModels()
    await seedDatabase()

    // Create HTTP server
    const server = http.createServer(app)

    // Socket.io for real-time chat
    // CORS_ORIGIN se configura como variable de entorno en Railway/producción
    const io = new SocketServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    })

    // Make io available in routes
    app.set('io', io)

    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`)

      socket.on('join-channel', (channelId: string) => {
        socket.join(channelId)
      })

      socket.on('send-message', (data) => {
        io.to(data.channelId || 'general').emit('new-message', data)
      })

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })

    server.listen(PORT, () => {
      console.log(`SMC Dashboard API running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

bootstrap()
