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
          (entry.entryName.startsWith('src/') || entry.entryName === 'src') &&
          !entry.entryName.includes('src/auth/') &&
          entry.entryName !== 'src/auth',
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
  try {
    const parser = new xml2js.Parser({ explicitArray: false })
    return new Promise((resolve, reject) => {
      parser.parseString(xmlFileData, (err, result) => {
        if (err) {
          reject('Error parsing XML')
        }
        resolve(result.Policys.Module)
      })
    })
  } catch (error) {
    console.error('Error parsing XML:', error)
    return null
  }
}

export const getServiceContentFromControllerContent = async (
  fileContent: string,
  extractPath: string,
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
                // console.log('element:', element)
                const importName = element.name.text
                // console.log('importName:', importName)
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

    // console.log('serviceImports:', serviceImports)

    if (serviceImports.length === 0) {
      throw new Error('Cannot find any service imports')
    }

    const firstServiceImport = serviceImports[0]

    let servicePath = firstServiceImport.path
    if (!path.extname(servicePath)) {
      servicePath += '.ts'
    }

    console.log('servicePath:', servicePath)

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

    // console.log('possiblePaths:=====', possiblePaths)

    try {
      const potentialServiceFiles = await findAllServiceFiles(
        path.join(extractPath, 'src'),
      )
      possiblePaths.push(...potentialServiceFiles)
    } catch (error) {
      console.error('Error when get service file:', error)
    }
    // console.log('possiblePaths 2:=====', possiblePaths)

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

export const getPolicyContentFromControllerContent = async (
  fileContent: string,
  extractPath: string,
) => {
  try {
    const sourceFile = ts.createSourceFile(
      'controller.ts',
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const policyImports = []

    function findPolicyImports(node) {
      if (ts.isImportDeclaration(node)) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text

          if (node.importClause && node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              const elements = node.importClause.namedBindings.elements

              for (const element of elements) {
                const importName = element.name.text
                if (importName.includes('Policy')) {
                  policyImports.push({
                    name: importName,
                    path: importPath,
                  })
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, findPolicyImports)
    }

    findPolicyImports(sourceFile)

    // console.log('policyImports:', policyImports)

    if (policyImports.length === 0) {
      throw new Error('Cannot find any policy imports')
    }

    // Group imports by path
    const importsByPath = {}
    for (const policyImport of policyImports) {
      if (!importsByPath[policyImport.path]) {
        importsByPath[policyImport.path] = []
      }
      importsByPath[policyImport.path].push(policyImport.name)
    }

    let results = []

    for (const importPath in importsByPath) {
      const policyNames = importsByPath[importPath]
      let policyPath = importPath
      if (!path.extname(policyPath)) {
        policyPath += '.ts'
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

      const possiblePaths = []

      if (policyPath.startsWith('./')) {
        const relativePath = policyPath.substring(2)
        if (moduleName) {
          possiblePaths.push(
            path.join(extractPath, 'src', moduleName, relativePath),
          )
        }

        possiblePaths.push(path.join(extractPath, 'src', relativePath))
      } else if (policyPath.startsWith('../')) {
        const relativePath = policyPath.substring(3)
        possiblePaths.push(path.join(extractPath, 'src', relativePath))
      } else if (policyPath.startsWith('@/')) {
        // Handle absolute imports with @ alias
        const relativePath = policyPath.substring(2)
        possiblePaths.push(path.join(extractPath, 'src', relativePath))
      } else {
        possiblePaths.push(path.join(extractPath, 'src', policyPath))
        possiblePaths.push(path.join(extractPath, policyPath))
      }

      if (moduleName) {
        possiblePaths.push(
          path.join(extractPath, 'src', moduleName, policyPath),
        )

        possiblePaths.push(
          path.join(
            extractPath,
            'src',
            moduleName,
            'policies',
            path.basename(policyPath),
          ),
        )
      }

      // Add general paths
      const policyFileName = path.basename(policyPath)
      possiblePaths.push(
        path.join(extractPath, 'src', 'policies', policyFileName),
      )

      // Try to guess more policy paths based on module name
      if (moduleName) {
        possiblePaths.push(
          path.join(extractPath, 'src', moduleName, 'policy', policyFileName),
        )
        possiblePaths.push(
          path.join(extractPath, 'src', moduleName, 'policies', policyFileName),
        )
        possiblePaths.push(
          path.join(
            extractPath,
            'src',
            moduleName,
            'policy',
            `${moduleName}.policy.ts`,
          ),
        )
        possiblePaths.push(
          path.join(
            extractPath,
            'src',
            moduleName,
            'policies',
            `${moduleName}.policy.ts`,
          ),
        )
      }

      try {
        const potentialPolicyFiles = await findAllPolicyFiles(
          path.join(extractPath, 'src'),
        )
        possiblePaths.push(...potentialPolicyFiles)
      } catch (error) {
        console.error('Error when finding policy files:', error)
      }

      const uniquePaths = [...new Set(possiblePaths)]

      // First try to find exact class matches
      let foundPolicy = false
      for (const possiblePath of uniquePaths) {
        try {
          if (fs.existsSync(possiblePath)) {
            const policyContent = fs.readFileSync(possiblePath, 'utf8')

            // Check if policy content contains all the classes we're looking for
            let allPoliciesFound = true
            for (const policyName of policyNames) {
              if (!policyContent.includes(`class ${policyName}`)) {
                allPoliciesFound = false
                break
              }
            }

            if (allPoliciesFound) {
              results.push({
                path: possiblePath,
                content: policyContent,
              })
              foundPolicy = true
              break
            }
          }
        } catch (error) {
          console.error(`Error when get policy content ${possiblePath}:`, error)
        }
      }

      // If we haven't found the policy yet, try case-insensitive class name match
      if (!foundPolicy) {
        for (const possiblePath of uniquePaths) {
          try {
            if (fs.existsSync(possiblePath)) {
              const policyContent = fs.readFileSync(possiblePath, 'utf8')

              let anyPolicyFound = false
              for (const policyName of policyNames) {
                const classRegex = new RegExp(`class\\s+${policyName}\\b`, 'i')
                if (classRegex.test(policyContent)) {
                  anyPolicyFound = true
                  break
                }
              }

              if (anyPolicyFound) {
                results.push({
                  path: possiblePath,
                  content: policyContent,
                })
                foundPolicy = true
                break
              }
            }
          } catch (error) {
            console.error(
              `Error when get policy content ${possiblePath}:`,
              error,
            )
          }
        }
      }

      if (!foundPolicy) {
        // results.push({
        //   error: `Cannot find policy content for ${policyNames.join(', ')}`,
        //   importPath: importPath,
        //   checkedPaths: uniquePaths,
        // })
        results = []
      }
    }

    // If at least one policy was found
    if (results.some((r) => !r.error)) {
      return results.length > 0 ? results : ''
    } else {
      return {
        success: false,
        errors: results.map((r) => r.error),
        policies: results,
      }
    }
  } catch (error) {
    return ''
  }
}

export const findAllPolicyFiles = async (dir) => {
  const policyFiles = []

  async function scanDir(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (
          entry.name.endsWith('.policy.ts') ||
          (entry.name.includes('policy') && entry.name.endsWith('.ts'))
        ) {
          policyFiles.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error)
    }
  }

  await scanDir(dir)
  return policyFiles
}

// Helper function to extract policy constraints
export const extractPolicyConstraints = (policyContent, policyNames) => {
  const constraints = {}

  for (const policyName of policyNames) {
    const regex = new RegExp(
      `export\\s+class\\s+${policyName}[\\s\\S]*?constructor\\s*\\(\\)\\s*{[\\s\\S]*?super\\s*\\(\\s*['"]([^'"]*)['"](\\s*\\)|[^;]*)`,
      'i',
    )

    const match = regex.exec(policyContent)
    if (match && match[1]) {
      constraints[policyName] = match[1]
    } else {
      constraints[policyName] = null
    }
  }

  return constraints
}

// Extract operations and their policy usage from controller
export const extractPolicyUsageFromController = (controllerContent) => {
  const operations = []

  // Find controller base path
  const controllerMatch = controllerContent.match(
    /@Controller\(\s*['"]([^'"]+)['"]\s*\)/,
  )
  const controllerBasePath = controllerMatch ? controllerMatch[1] : ''

  // Find methods with policy decorators
  const methodRegex =
    /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]?([^'"]*?)['"]?\s*\)[^]*?@CheckPolicies\s*\(\s*new\s+(\w+)\s*\(\s*\)\s*\)[^]*?(\w+)\s*\(/g
  let match

  while ((match = methodRegex.exec(controllerContent)) !== null) {
    const httpMethod = match[1].toUpperCase()
    const endpoint = match[2] || controllerBasePath
    const policyName = match[3]
    const methodName = match[4]

    operations.push({
      method: httpMethod,
      endpoint,
      methodName,
      policyName,
    })
  }

  return operations
}

// Extract operations from resource name string
export const extractResourceNames = (resourceNameString: string) => {
  const pairs = resourceNameString.split(',')

  const entities = pairs
    .map((pair) => {
      const match = pair.trim().match(/:\s*(\w+)/)
      return match && match[1] ? match[1] : null
    })
    .filter((entity) => entity !== null)

  return entities
}

// Extract constraints from a string
export const extractConstraints = (constraintString: string) => {
  if (!constraintString || typeof constraintString !== 'string') {
    return []
  }

  const regex = /:\s*([^,]+)/g
  const matches = [...constraintString.matchAll(regex)]
  return matches.map((match) => match[1].trim())
}
