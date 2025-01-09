import { DatabaseConnectionDto } from '@/database/database.dto'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as mysql from 'mysql2/promise'

@Injectable()
export class DatabaseService {
  private pools: Map<string, mysql.Pool> = new Map()
  private connectionKey: string

  // connectToDatabase method
  async connectToDatabase(body: DatabaseConnectionDto) {
    try {
      const { ipAddress, username, password, database } = body
      this.connectionKey = this.generateConnectionKey(body)

      // Check if a connection pool already exists
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
    } catch (error) {
      console.log('connectToDatabase -> error', error)
      return 'Could not connect to MySQL'
    }
  }

  // closeConnection method
  async closeConnection(connectionKey: string) {
    const pool = this.pools.get(connectionKey)
    if (pool) {
      await pool.end()
      this.pools.delete(connectionKey)
    }
  }

  // getPool method
  getPool(connectionKey: string) {
    return this.pools.get(connectionKey)
  }

  // closeAllConnections method
  async closeAllConnections() {
    const closePromises = Array.from(this.pools.entries()).map(([key]) =>
      this.closeConnection(key),
    )
    await Promise.all(closePromises)
  }

  // Test the connection by running a simple query
  async getData() {
    const pool = this.getPool(this.connectionKey)

    if (!pool) {
      console.log('No connection to MySQL')
      throw new InternalServerErrorException('No connection to MySQL')
    }

    const [rows] = await pool?.query('SELECT  * from users u')
    return rows
  }

  async getConnectionKey() {
    return this.connectionKey
  }

  // generateConnectionKey method
  private generateConnectionKey(body: DatabaseConnectionDto): string {
    const { ipAddress, username, database } = body
    return `${ipAddress}_${username}_${database}`
  }

  // testConnection method
  private async testConnection(pool: mysql.Pool) {
    try {
      await pool.query('SELECT  * from users u')
      return true
    } catch {
      return false
    }
  }
}
