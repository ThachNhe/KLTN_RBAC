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

    const possiblePaths = []

    // console.log('possiblePaths:=====', possiblePaths)

    try {
      const potentialServiceFiles = await findAllServiceFiles(
        path.join(extractPath, 'src'),
      )
      possiblePaths.push(...potentialServiceFiles)
    } catch (error) {
      console.error('Error when get service file:', error)
    }

    // console.log('5.2 possiblePaths:', possiblePaths)

    const uniquePaths = [...new Set(possiblePaths)]

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

export const extractServiceContent = (
  serviceContent: string,
  methodsToExtract: string[],
) => {
  try {
    const sourceFile = ts.createSourceFile(
      'service.ts',
      serviceContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const extractedMethodsArray = []

    function findMethods(node) {
      if (ts.isMethodDeclaration(node) && node.name) {
        const methodName = node.name.getText(sourceFile)

        // Chỉ trích xuất các phương thức được yêu cầu
        if (methodsToExtract.includes(methodName)) {
          const start = node.getStart(sourceFile)
          const end = node.getEnd()
          const methodText = serviceContent.substring(start, end)

          // Tìm JSDoc comment
          let jsDocComment = ''
          const leadingComments = ts.getLeadingCommentRanges(
            serviceContent,
            node.getFullStart(),
          )
          if (leadingComments && leadingComments.length > 0) {
            const jsDocStart = leadingComments[0].pos
            const jsDocEnd = leadingComments[leadingComments.length - 1].end
            jsDocComment = serviceContent.substring(jsDocStart, jsDocEnd)
          }

          // Thêm JSDoc và nội dung phương thức vào mảng
          if (jsDocComment) {
            extractedMethodsArray.push(jsDocComment)
          }
          extractedMethodsArray.push(methodText)
        }
      }

      ts.forEachChild(node, findMethods)
    }

    findMethods(sourceFile)

    // Kiểm tra xem đã tìm được tất cả các phương thức yêu cầu chưa
    const foundMethods = []
    const methodRegex = /async\s+(\w+)\s*\(/g
    let match

    for (const content of extractedMethodsArray) {
      while ((match = methodRegex.exec(content)) !== null) {
        foundMethods.push(match[1])
      }
    }

    const notFoundMethods = methodsToExtract.filter(
      (method) => !foundMethods.includes(method),
    )

    // Tạo nội dung file mới chỉ chứa các phương thức đã trích xuất
    const newFileContent = extractedMethodsArray.join('\n\n')

    return {
      success: true,
      content: newFileContent,
      notFound: notFoundMethods.length > 0 ? notFoundMethods : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: `Error when extracting methods: ${error.message}`,
    }
  }
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

    // Get all policy imports
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

    console.log('importsByPath:', importsByPath)

    let results = []

    for (const importPath in importsByPath) {
      console.log('importPath:', importPath)
      const policyNames = importsByPath[importPath]
      let policyPath = importPath
      if (!path.extname(policyPath)) {
        policyPath += '.ts'
      }

      const possiblePaths = []

      try {
        const potentialPolicyFiles = await findAllPolicyFiles(
          path.join(extractPath, 'src'),
        )
        possiblePaths.push(...potentialPolicyFiles)
      } catch (error) {
        console.error('Error when finding policy files:', error)
      }

      const uniquePaths = [...new Set(possiblePaths)]

      console.log('policyNames:', policyNames)

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

      if (!foundPolicy) {
        results = []
      }
    }

    // If at least one policy was found
    if (results.some((r) => !r.error)) {
      return results.length > 0 ? results : ''
    } else {
      return {
        success: false,
        errors: "Policy files don't exist",
        policies: results,
      }
    }
  } catch (error) {
    return ''
  }
}

export const findAllPolicyFiles = async (srcDirPath) => {
  const policyFiles = []

  console.log('dir:', srcDirPath)

  async function scanDir(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (entry.name.endsWith('.policy.ts')) {
          policyFiles.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error)
    }
  }

  await scanDir(srcDirPath)
  return policyFiles
}
