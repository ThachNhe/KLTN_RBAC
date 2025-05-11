import { DatabaseService } from '@/database/database.service'
import { RolePermission } from '@/user-role/user-role.interface'
import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import * as papa from 'papaparse'

@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name)

  constructor(private readonly databaseService: DatabaseService) {}

  async checkUserRoleViolation(file: MemoryStorageFile) {
    try {
      const connectionKey = await this.databaseService.getConnectionKey()
      const pool = this.databaseService.getPool(connectionKey)

      if (!(await this.databaseService.testConnection(pool))) {
        throw new InternalServerErrorException('Connect Db first!!!')
      }

      const [userRoleDbData, userRoleCsvData] = await Promise.all([
        this.retrieveDBData(),
        this.retrieveDataFromCSVFile(file),
      ])

      if (!userRoleDbData?.length || !userRoleCsvData?.length) {
        this.logger.warn('Empty data from DB or CSV')
        throw new InternalServerErrorException('Empty data from DB or CSV')
      }

      const dbCopy = [...userRoleDbData]
      const csvCopy = [...userRoleCsvData]

      // console.log('csvCopy: ', csvCopy)
      // console.log('dbCopy: ', dbCopy)

      this.compareTwoRolePermission(dbCopy, csvCopy)

      const newArray = dbCopy.map((item) => {
        const { first_name, last_name, ...rest } = item as any

        return {
          ...rest,
          firstName: first_name,
          lastName: last_name,
        }
      })

      const result = {
        lackingPermissions: csvCopy,
        redundantPermissions: newArray,
      }

      return result
    } catch (error) {
      this.logger.error(
        `Error in checking user role violation: ${error.message}`,
        error.stack,
      )
      throw new InternalServerErrorException(
        `Failed to check role violations: ${error.message}`,
      )
    }
  }

  async retrieveDataFromCSVFile(
    file: MemoryStorageFile,
  ): Promise<RolePermission[]> {
    const csvString = file.buffer.toString()

    return new Promise((resolve, reject) => {
      papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: async (results) => {
          try {
            if (!results.data.length) {
              this.logger.warn('CSV file is empty')
              return resolve([])
            }

            this.logger.debug(`CSV parsed: ${results.data.length} rows found`)

            const normalizedData = results.data.map((item) => ({
              username: item.username || item.user || '',
              role: item.description || item.role || '',
              firstName: item.firstName || item.first_name || '',
              lastName: item.lastName || item.last_name || '',
            }))

            resolve(normalizedData)
          } catch (error) {
            this.logger.error(
              `Error parsing CSV: ${error.message}`,
              error.stack,
            )
            reject(error)
          }
        },
        error: (error) => {
          this.logger.error(`CSV parsing error: ${error.message}`, error.stack)
          reject(error)
        },
      })
    })
  }

  private async retrieveDBData(): Promise<RolePermission[]> {
    let connection = null

    try {
      const connectionKey = await this.databaseService.getConnectionKey()
      const pool = this.databaseService.getPool(connectionKey)

      if (!pool) {
        this.logger.error('No database connection available')
        return []
      }

      connection = await pool.connect()

      const query = `
SELECT u.username as username , u.first_name, u.last_name , r."name" as role
FROM users u
LEFT JOIN users_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id;
      `
      const result = await connection.query(query)

      // const normalizedData = result?.rows?.data?.map((item) => ({
      //   username: item.username || item.user || '',
      //   role: item.description || item.role || '',
      //   firstName: item.firstName || item.first_name || '',
      //   lastName: item.lastName || item.last_name || '',
      // }))

      return result?.rows
    } catch (error) {
      this.logger.error(`Database error: ${error.message}`, error.stack)
      return []
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }

  private compareTwoRolePermission(
    rolePermissionsDb: RolePermission[],
    rolePermissionsCsv: RolePermission[],
  ): void {
    const dbMap = new Map<string, RolePermission>()

    rolePermissionsDb.forEach((item) => {
      const key = this.createComparisonKey(item)
      dbMap.set(key, item)
    })

    const duplicateCsvIndices: number[] = []
    const duplicateDbKeys: string[] = []

    rolePermissionsCsv.forEach((csvItem, index) => {
      const key = this.createComparisonKey(csvItem)
      if (dbMap.has(key)) {
        duplicateCsvIndices.push(index)
        duplicateDbKeys.push(key)
      }
    })

    for (let i = duplicateCsvIndices.length - 1; i >= 0; i--) {
      rolePermissionsCsv.splice(duplicateCsvIndices[i], 1)
    }

    for (let i = rolePermissionsDb.length - 1; i >= 0; i--) {
      const key = this.createComparisonKey(rolePermissionsDb[i])
      if (duplicateDbKeys.includes(key)) {
        rolePermissionsDb.splice(i, 1)
      }
    }
  }

  private createComparisonKey(item: RolePermission): string {
    return `${item.username?.toLowerCase() || ''}_${item.role?.toLowerCase() || ''}`
  }
}
