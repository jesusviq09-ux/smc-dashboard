import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

// Railway inyecta DATABASE_URL automáticamente al añadir el plugin de PostgreSQL.
// En desarrollo local se usan las variables individuales DB_HOST, DB_PORT, etc.
export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false, // Necesario para el certificado self-signed de Railway
        },
      },
      logging: false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    })
  : new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'smc_dashboard',
      username: process.env.DB_USER || 'smc_user',
      password: process.env.DB_PASSWORD || 'smc_password',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    })

export async function connectDB(): Promise<void> {
  await sequelize.authenticate()
  console.log('PostgreSQL connected')
}
