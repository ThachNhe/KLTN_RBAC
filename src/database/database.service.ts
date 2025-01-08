import { DatabaseConnectionDto } from '@/database/database.dto'
import { Injectable } from '@nestjs/common'
import * as mysql from 'mysql2/promise'

@Injectable()
export class DatabaseService {
  private pools: Map<string, mysql.Pool> = new Map()
  private connectionKey: string

  private generateConnectionKey(body: DatabaseConnectionDto): string {
    const { ipAddress, username, database } = body
    return `${ipAddress}_${username}_${database}`
  }

  private async testConnection(pool: mysql.Pool) {
    try {
      await pool.query('SELECT * FROM  `User` u2 ')
      return true
    } catch {
      return false
    }
  }

  async connectToDatabase(body: DatabaseConnectionDto) {
    try {
      const { ipAddress, username, password, database } = body
      this.connectionKey = this.generateConnectionKey(body)

      if (this.pools.has(this.connectionKey)) {
        const existingPool = this.pools.get(this.connectionKey)
        if (await this.testConnection(existingPool)) {
          return 'Now using existing connection'
        }
        await this.closeConnection(this.connectionKey)
      }

      // Create a new connection pool
      const pool = mysql.createPool({
        host: ipAddress,
        user: username,
        password: password,
        database: database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      })

      // Test the connection
      if (await this.testConnection(pool)) {
        this.pools.set(this.connectionKey, pool)
        return 'Connected to MySQL successfully'
      }

      await pool.end()
      throw new Error('Could not connect to MySQL')
    } catch (error) {
      return 'Could not connect to MySQL'
    }
  }

  async closeConnection(connectionKey: string) {
    const pool = this.pools.get(connectionKey)
    if (pool) {
      await pool.end()
      this.pools.delete(connectionKey)
    }
  }

  getPool(connectionKey: string) {
    return this.pools.get(connectionKey)
  }

  async closeAllConnections() {
    const closePromises = Array.from(this.pools.entries()).map(([key]) =>
      this.closeConnection(key),
    )
    await Promise.all(closePromises)
  }

  async getData() {
    const pool = this.getPool(this.connectionKey)

    if (!pool) {
      throw new Error('No connection to MySQL')
    }

    const [rows] = await pool?.query('SELECT * FROM  `User` u2 ')
    return rows
  }
}
