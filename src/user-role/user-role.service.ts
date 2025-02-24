import { DatabaseService } from '@/database/database.service'
import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as papa from 'papaparse'

@Injectable()
export class UserRoleService {
  constructor(private databaseService: DatabaseService) {}

  async check(file: MemoryStorageFile) {
    console.log('Starting CSV processing...')
    console.log('check file : ', file)
    const csvString = file.buffer.toString()

    return new Promise((resolve, reject) => {
      papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            console.log('Parsed CSV data:', results.data[0])
            console.log('Total rows:', results.data.length)

            // Validate data structure
            if (results.data.length === 0) {
              throw new Error('CSV file is empty')
            }

            // Validate required columns
            const requiredColumns = ['User', 'role', 'username', 'password']
            const missingColumns = requiredColumns.filter(
              (col) => !results.meta.fields.includes(col),
            )

            console.log(
              'check csv data: ===================== ',
              missingColumns,
            )

            await this.retrieveDBData()

            // await this.insertData(results.data)
            resolve({ message: 'Data processed successfully' })
          } catch (error) {
            console.error('Error in processCSV:', error)
            reject(error)
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error)
          reject(error)
        },
      })
    })
  }

  private async retrieveDBData() {
    const connectionKey = await this.databaseService.getConnectionKey()

    const pool = this.databaseService.getPool(connectionKey)
    if (!pool) {
      throw new InternalServerErrorException('No database connection')
    }

    const connection = await pool.getConnection()
    console.log('Database connection established =====')

    try {
      const [rows] = await connection.query('SELECT * FROM users')
      console.log('Retrieved data:', rows)
    } catch (error) {
      console.error('Database error:', error)
      throw new Error(`Failed to retrieve data: ${error.message}`)
    } finally {
      connection.release()
      console.log('Database connection released')
    }

    try {
      await connection.beginTransaction()
      console.log('Transaction started')

      await connection.commit()
      console.log('Transaction committed successfully')
    } catch (error) {
      console.error('Database error:', error)
      await connection.rollback()
      throw new Error(`Failed to process data: ${error.message}`)
    } finally {
      connection.release()
      console.log('Database connection released')
    }
  }
}
