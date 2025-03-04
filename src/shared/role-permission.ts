import * as fs from 'fs'
import * as path from 'path'
import * as xml2js from 'xml2js'
import * as ts from 'typescript'

export const extractNestJsProject = async (
  zipBuffer: Buffer,
  extractPath: string,
) => {
  if (fs.existsSync(extractPath)) {
    fs.rmSync(extractPath, { recursive: true, force: true })
  }

  // Create extract directory
  fs.mkdirSync(extractPath, { recursive: true })

  return new Promise((resolve, reject) => {
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipBuffer)
      const entries = zip.getEntries()

      // Filter src entries
      const srcEntries = entries.filter(
        (entry) =>
          entry.entryName.startsWith('src/') || entry.entryName === 'src',
      )

      // Only extract src entries
      for (const entry of srcEntries) {
        if (entry.isDirectory) {
          const targetDir = path.join(extractPath, entry.entryName)
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
          }
        } else {
          const fileData = entry.getData()
          const targetPath = path.join(extractPath, entry.entryName)

          const parentDir = path.dirname(targetPath)
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true })
          }

          fs.writeFileSync(targetPath, fileData)
        }
      }

      resolve('Extraction completed - src only')
    } catch (error) {
      console.error('Failed to extract:', error)
      reject(error)
    }
  })
}

export const parseXML = async (xmlFileData: string) => {
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

export const getServiceContentFromControllerContent = async (
  fileContent,
  extractPath,
) => {
  try {
    const sourceFile = ts.createSourceFile(
      'controller.ts',
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const serviceImports = []

    function findServiceImports(node) {
      if (ts.isImportDeclaration(node)) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text

          if (node.importClause && node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              const elements = node.importClause.namedBindings.elements

              for (const element of elements) {
                const importName = element.name.text
                if (importName.includes('Service')) {
                  serviceImports.push({
                    name: importName,
                    path: importPath,
                  })
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, findServiceImports)
    }

    findServiceImports(sourceFile)

    if (serviceImports.length === 0) {
      throw new Error('Cannot find any service imports')
    }

    const firstServiceImport = serviceImports[0]

    let servicePath = firstServiceImport.path
    if (!path.extname(servicePath)) {
      servicePath += '.ts'
    }

    let moduleName = ''

    const controllerMatch = fileContent.match(
      /@Controller\(\s*['"]([^'"]+)['"]\s*\)/,
    )

    if (controllerMatch && controllerMatch[1]) {
      const controllerPath = controllerMatch[1]
      const parts = controllerPath.split('/')
      if (parts.length > 0) {
        moduleName = parts[0]
      }
    }

    if (!moduleName) {
      const moduleMatch = fileContent.match(/@Module\(\s*\{/)

      if (moduleMatch) {
        const controllersMatch = fileContent.match(
          /controllers\s*:\s*\[([\s\S]*?)\]/,
        )

        if (controllersMatch) {
          const controllersList = controllersMatch[1]
          const controllerNameMatch = controllersList.match(/(\w+)Controller/)
          if (controllerNameMatch && controllerNameMatch[1]) {
            moduleName = controllerNameMatch[1].toLowerCase()
          }
        }
      }
    }

    const possiblePaths = []

    if (servicePath.startsWith('./')) {
      const relativePath = servicePath.substring(2)
      if (moduleName) {
        possiblePaths.push(
          path.join(extractPath, 'src', moduleName, relativePath),
        )
      }

      possiblePaths.push(path.join(extractPath, 'src', relativePath))
    } else if (servicePath.startsWith('../')) {
      const relativePath = servicePath.substring(3)
      possiblePaths.push(path.join(extractPath, 'src', relativePath))
    } else {
      possiblePaths.push(path.join(extractPath, 'src', servicePath))
      possiblePaths.push(path.join(extractPath, servicePath))
    }

    if (moduleName) {
      possiblePaths.push(path.join(extractPath, 'src', moduleName, servicePath))

      possiblePaths.push(
        path.join(
          extractPath,
          'src',
          moduleName,
          'services',
          path.basename(servicePath),
        ),
      )

      const serviceFileName = `${moduleName}.service.ts`
      possiblePaths.push(
        path.join(extractPath, 'src', moduleName, serviceFileName),
      )
      possiblePaths.push(
        path.join(extractPath, 'src', moduleName, 'services', serviceFileName),
      )
    }

    const serviceFileName = path.basename(servicePath)
    possiblePaths.push(
      path.join(extractPath, 'src', 'services', serviceFileName),
    )

    const suggestedServiceName = firstServiceImport.name
      .replace(/Service$/, '')
      .toLowerCase()
    possiblePaths.push(
      path.join(extractPath, 'src', `${suggestedServiceName}.service.ts`),
    )
    if (moduleName) {
      possiblePaths.push(
        path.join(
          extractPath,
          'src',
          moduleName,
          `${suggestedServiceName}.service.ts`,
        ),
      )
    }

    try {
      const potentialServiceFiles = await findAllServiceFiles(
        path.join(extractPath, 'src'),
      )
      possiblePaths.push(...potentialServiceFiles)
    } catch (error) {
      console.error('Error when get service file:', error)
    }

    const uniquePaths = [...new Set(possiblePaths)]

    for (const possiblePath of uniquePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          const serviceContent = fs.readFileSync(possiblePath, 'utf8')

          if (serviceContent.includes(`class ${firstServiceImport.name}`)) {
            return {
              success: true,
              path: possiblePath,
              content: serviceContent,
              name: firstServiceImport.name,
            }
          }
        }
      } catch (error) {
        console.error(`Error when get service content ${possiblePath}:`, error)
      }
    }

    for (const possiblePath of uniquePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          const serviceContent = fs.readFileSync(possiblePath, 'utf8')
          const className = firstServiceImport.name
          const classRegex = new RegExp(`class\\s+${className}\\b`, 'i')

          if (classRegex.test(serviceContent)) {
            return {
              success: true,
              path: possiblePath,
              content: serviceContent,
              name: firstServiceImport.name,
            }
          }
        }
      } catch (error) {
        console.error(`Error when get service content ${possiblePath}:`, error)
      }
    }

    return {
      success: false,
      error: `Cannot find service content for ${firstServiceImport.name}`,
      serviceInfo: firstServiceImport,
      checkedPaths: uniquePaths,
    }
  } catch (error) {
    return {
      success: false,
      error: `Error when analyzing controller file: ${error.message}`,
    }
  }
}

export const findAllServiceFiles = async (dir) => {
  const serviceFiles = []

  async function scanDir(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (
          entry.name.endsWith('.service.ts') ||
          (entry.name.includes('service') && entry.name.endsWith('.ts'))
        ) {
          serviceFiles.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`error ${currentDir}:`, error)
    }
  }

  await scanDir(dir)
  return serviceFiles
}
