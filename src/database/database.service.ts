import { DatabaseConnectionDto } from '@/database/database.dto'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { Pool } from 'pg'

@Injectable()
export class DatabaseService {
  private pools: Map<string, Pool> = new Map()
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
      const pool = new Pool({
        host: ipAddress,
        user: username,
        password: password,
        database: database,
        port: 5436,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })

      // Test the connection
      if (await this.testConnection(pool)) {
        this.pools.set(this.connectionKey, pool)
        return 'Connected to PostgreSQL successfully'
      } else {
        throw new InternalServerErrorException(
          'Could not connect to PostgreSQL',
        )
      }

      await pool.end()
      throw new Error('Could not connect to MySQL')
    } catch (error) {
      console.log('connectToDatabase -> error', error)
      return 'Could not connect to PostgreSQL'
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
      console.log('No connection to PostgreSQL')
      throw new InternalServerErrorException('No connection to PostgreSQL')
    }

    const result = await pool.query('SELECT * FROM users u')
    return result.rows
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
  public async testConnection(pool: Pool) {
    try {
      await pool.query('SELECT * FROM users u')
      return true
    } catch {
      return false
    }
  }
}
