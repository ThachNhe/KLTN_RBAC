import { DatabaseService } from '@/database/database.service'
import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as papa from 'papaparse'

@Injectable()
export class UserRolePermissionService {
  constructor(private databaseService: DatabaseService) {}

  async processCSV(file: MemoryStorageFile) {
    console.log('Starting CSV processing...')
    console.log('check file : ', file)
    const csvString = file.buffer.toString()

    return new Promise((resolve, reject) => {
      papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            console.log('Parsed CSV data:', results.data[0]) // Log first row as sample
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
            if (missingColumns.length > 0) {
              throw new Error(
                `Missing required columns: ${missingColumns.join(', ')}`,
              )
            }

            await this.insertData(results.data)
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

  private async insertData(data: any[]) {
    const connectionKey = await this.databaseService.getConnectionKey()
    const pool = this.databaseService.getPool(connectionKey)
    if (!pool) {
      throw new InternalServerErrorException('No database connection')
    }

    const connection = await pool.getConnection()
    console.log('Database connection established')

    try {
      await connection.beginTransaction()
      console.log('Transaction started')

      for (const row of data) {
        try {
          // Log current row being processed
          console.log('Processing row for user:', row.username)

          // 1. Insert or find role
          const [rows] = (await connection.query(
            'SELECT id FROM roles WHERE name = ?',
            [row.role], // Thêm tham số vào đây
          )) as any[]

          const roles = rows as any[]

          let roleId
          if (roles.length === 0) {
            const [rows] = await connection.query(
              'INSERT INTO roles (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
              [row.role],
            )

            const roleResult = rows as any

            roleId = roleResult.insertId
            console.log('New role created with ID:', roleId)
          } else {
            roleId = roles[0].id
            console.log('Existing role found with ID:', roleId)
          }

          // 2. Insert user
          const userSql = `INSERT INTO users (username, password, created_at, updated_at) 
                         VALUES (?, ?, NOW(), NOW())`
          const userParams = [row.username, row.password]
          console.log('User SQL:', userSql)
          console.log('User Params:', userParams)

          const [userRows] = await connection.query(userSql, userParams)
          const userResult = userRows as any

          const userId = userResult.insertId
          console.log('User inserted with ID:', userId)

          // 3. Insert user_role
          await connection.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, roleId],
          )

          console.log('User-Role relationship created')

          // 4. If role is PATIENT, insert patient record
          if (row.role === 'PATIENT') {
            const patientSql = `INSERT INTO patients 
              (user_id, full_name, address, age, phone_number, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, NOW(), NOW())`
            const patientParams = [
              userId,
              row.full_name,
              row.address,
              parseInt(row.age) || null,
              row.phone_number,
            ]
            console.log('Patient SQL:', patientSql)
            console.log('Patient Params:', patientParams)

            await connection.query(patientSql, patientParams)
            console.log('Patient record created')
          }
        } catch (rowError) {
          console.error('Error processing row:', row)
          console.error('Error details:', rowError)
          throw rowError
        }
      }

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
