import { Injectable } from '@nestjs/common'
import * as xml2js from 'xml2js'
import { Module } from './role-permission.interface'

@Injectable()
export class RolePermissionService {
  async checkProjectPermissions(xmlFileData: string) {
    const modules = await this.parseXML(xmlFileData)

    let result = 'Permissions check result:\n'

    result += `Checked permissions for modules: ${modules.length}`

    return result
  }

  async parseXML(xmlFileData: string): Promise<Module[]> {
    const parser = new xml2js.Parser({ explicitArray: false })
    return new Promise((resolve, reject) => {
      parser.parseString(xmlFileData, (err, result) => {
        if (err) {
          reject('Error parsing XML')
        }
        resolve(result.Policys.Module)
      })
    })
  }
}
