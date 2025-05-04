import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { catchError, firstValueFrom, map } from 'rxjs'

@Injectable()
export class LlmService {
  private readonly openAIKey: string
  private readonly baseUrl: string
  private readonly model: string

  // Hugging Face properties
  private readonly huggingFaceKey: string
  private readonly huggingFaceBaseUrl: string
  private readonly huggingFaceModel: string

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    // Initialize the OpenAI API key and base URL
    this.baseUrl = this.configService.get('OPEN_AI_URL')
    this.openAIKey = this.configService.get('OPEN_AI_KEY')
    this.model = this.configService.get<string>('OPEN_AI_MODEL_4o')

    // Initialize the HUGGING API key and base URL
    this.huggingFaceBaseUrl = this.configService.get('HUGGING_FACE_URL')
    // Khôi phục cách lấy key từ config thay vì hardcode
    this.huggingFaceKey = this.configService.get('HUGGING_FACE_KEY2')
    // this.huggingFaceKey = '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'

    this.huggingFaceModel = this.configService.get('HUGGINGFACE_MODEL3')

    if (!this.openAIKey) {
      throw new Error('OPEN_AI_KEY is not set')
    }

    if (!this.huggingFaceKey) {
      throw new Error('HUGGING_FACE_KEY is not set')
    }
  }

  // OpenAI implementation
  async getResourceName(
    controllerMapServiceMethodArr: any,
    serviceMethods: any,
    serviceFileContent: string,
  ) {
    try {
      const prompt = `Identify the main Entity directly manipulated in the functions 
${serviceMethods?.join(', ')} in the code below.

Return the Entity name as a concise list, without any 
explanations or additional text.

Format the result exactly as follows:
${serviceMethods.map((action) => `${action}: entityName`).join(',')}

If no Entity is affected, return an empty string.

Source code:
"""
${serviceFileContent}
"""
      `

      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.baseUrl}`,
            {
              model: this.model,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              max_tokens: Number(this.configService.get<number>('MAX_TOKENS')),
              temperature: Number(
                this.configService.get<number>('TEMPERATURE'),
              ),
              top_p: Number(this.configService.get<number>('TOP_P')),
            },
            {
              headers: {
                Authorization: `Bearer ${this.openAIKey}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              throw new Error(
                `Error from calling API: ${JSON.stringify(error)}`,
              )
            }),
          ),
      )

      const MethodResourceArray = this.convertLlmStringToArray(
        response.choices[0].message.content,
      )

      // console.log('MethodResourceArray: ', MethodResourceArray)

      const controllerMethodResourceArray = this.combineArrays(
        controllerMapServiceMethodArr,
        MethodResourceArray,
      )

      return controllerMethodResourceArray
    } catch (error) {
      throw new Error(`Error from getResourceName: ${error.message}`)
    }
  }

  async getConstraint(
    controllerMethodMappingArr: any,
    policyMethods: any,
    policyFileContent: string,
  ) {
    try {
      const prompt = `Identify the constraints in the functions ${policyMethods} in the code below.

Return the constraints as a concise list, without any 
explanations or additional text.

The constraint of each function is the string inside 
super('this is the constraint I'm looking for').

Format the result exactly as follows:
${policyMethods.map((policy) => `${policy}: constraint`).join(',')}

If there are no constraints, return an empty string.

Source code:
"""
${policyFileContent}
"""
`

      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.baseUrl}`,
            {
              model: this.model,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              max_tokens: Number(this.configService.get<number>('MAX_TOKENS')),
              temperature: Number(
                this.configService.get<number>('TEMPERATURE'),
              ),
              top_p: Number(this.configService.get<number>('TOP_P')),
            },
            {
              headers: {
                Authorization: `Bearer ${this.openAIKey}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              throw new Error(
                `Error from calling API: ${JSON.stringify(error)}`,
              )
            }),
          ),
      )

      const MethodPolicyArray = this.convertLlmStringToArray(
        response.choices[0].message.content,
      )

      // console.log('controllerMethodMappingArr: ', controllerMethodMappingArr)
      // console.log('MethodPolicyArray: ', MethodPolicyArray)

      const controllerMethodPolicyArray = this.combineArrays(
        controllerMethodMappingArr,
        MethodPolicyArray,
      )

      // console.log('controllerMethodPolicyArray: ', controllerMethodPolicyArray)

      // return controllerMethodResourceArray

      // return response?.choices[0]?.message?.content
      return controllerMethodPolicyArray
    } catch (error) {
      throw new Error(`Error from getConstraint: ${error.message}`)
    }
  }

  // Hugging Face implementation
  async getResourceNameHuggingFace(
    controllerMapServiceMethodArr: any,
    serviceMethods: any,
    serviceFileContent: string,
  ) {
    try {
      const prompt = `<s>[INST] Identify the single main Entity directly manipulated in each of the functions 
${serviceMethods?.join(', ')} in the code below.

IMPORTANT: For each method, assign EXACTLY ONE entity name, even if multiple entities are manipulated.
Choose the most primary/dominant entity for each method.

Return ONLY the entity names in this EXACT format with NO additional text, explanation or whitespace:
${serviceMethods.map((action) => `${action}: entityName`).join(',')}

Example output format:
method1: Entity1,method2: Entity2

No additional text, no introduction, no explanation. Just the direct answer in the format above.
If no Entity is affected by a method, use "-" as the entity name.

Source code:
"""
${serviceFileContent}
"""
[/INST]</s>`

      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.huggingFaceBaseUrl}/${this.huggingFaceModel}`,
            {
              inputs: prompt,
              parameters: {
                max_new_tokens: Number(
                  this.configService.get<number>('MAX_TOKENS') || 500,
                ),
                temperature: Number(
                  this.configService.get<number>('TEMPERATURE') || 0.1,
                ),
                top_p: Number(this.configService.get<number>('TOP_P') || 0.95),
                return_full_text: false,
              },
            },
            {
              headers: {
                Authorization: `Bearer ${this.huggingFaceKey}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              throw new Error(
                `Error from calling API TO GET RESOURCE HUGGING FACE ${JSON.stringify(error)}`,
              )
            }),
          ),
      )

      // console.log('HUGGING response:', response)

      let generatedText = ''
      if (Array.isArray(response) && response.length > 0) {
        if (response[0].hasOwnProperty('generated_text')) {
          generatedText = response[0].generated_text
        } else {
          generatedText = Array.isArray(response) ? response[0] : response
        }
      }

      console.log('Generated text:', generatedText)

      const cleanedModelOutput = this.filterLlmOutput(generatedText)
      console.log('Cleaned model output:', cleanedModelOutput)

      const MethodResourceArray =
        this.convertLlmStringToArray(cleanedModelOutput)

      const controllerMethodResourceArray = this.combineArrays(
        controllerMapServiceMethodArr,
        MethodResourceArray,
      )

      // console.log('Final result:', controllerMethodResourceArray)

      return controllerMethodResourceArray
    } catch (error) {
      console.error('Error details:', error)
      throw new Error(`Error from getResourceNameHuggingFace: ${error.message}`)
    }
  }

  async getConstraintHuggingFace(
    controllerMethodMappingArr: any,
    policyMethods: any,
    policyFileContent: string,
  ) {
    try {
      const prompt = `<s>[INST] 
      Identify the constraints in the functions ${policyMethods} in the code below.

Return the constraints as a concise list, without any 
explanations or additional text.

The constraint of each function is the string inside 
super('this is the constraint I'm looking for').

Format the result exactly as follows:
${policyMethods.map((policy) => `${policy}: constraint`).join(',')}

If there are no constraints, return an empty string.

Source code:
"""
${policyFileContent}
"""
[/INST]</s>`

      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.huggingFaceBaseUrl}/${this.huggingFaceModel}`,
            {
              inputs: prompt,
              parameters: {
                max_new_tokens: Number(
                  this.configService.get<number>('MAX_TOKENS') || 500,
                ),
                temperature: Number(
                  this.configService.get<number>('TEMPERATURE') || 0.1,
                ),
                top_p: Number(this.configService.get<number>('TOP_P') || 0.95),
                return_full_text: false,
              },
            },
            {
              headers: {
                Authorization: `Bearer ${this.huggingFaceKey}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              throw new Error(
                `Error from calling API: ${JSON.stringify(error)}`,
              )
            }),
          ),
      )

      // console.log('HUGGING response:', response)

      let generatedText = ''
      if (Array.isArray(response) && response.length > 0) {
        if (response[0].hasOwnProperty('generated_text')) {
          generatedText = response[0].generated_text
        } else {
          generatedText = Array.isArray(response) ? response[0] : response
        }
      }

      console.log('Generated text:', generatedText)

      const MethodPolicyArray = this.convertLlmStringToArray(generatedText)

      const controllerMethodPolicyArray = this.combineArrays(
        controllerMethodMappingArr,
        MethodPolicyArray,
      )

      // console.log('Final result:', controllerMethodPolicyArray)

      return controllerMethodPolicyArray
    } catch (error) {
      console.error('Error details:', error)
      throw new Error(`Error from getConstraintHuggingFace: ${error.message}`)
    }
  }

  async getResourceNameOllama(
    controllerMapServiceMethodArr: any,
    serviceMethods: any,
    serviceFileContent: string,
  ) {
    try {
      const requestId = Date.now().toString()

      const prompt = `Identify the main Entity directly manipulated in the functions 
${serviceMethods?.join(', ')} in the code below.

Return the Entity name as a concise list, without any 
explanations or additional text.

Format the result exactly as follows:
${serviceMethods.map((action) => `${action}: entityName`).join(',')}

If no Entity is affected, return an empty string.

Source code:
"""
${serviceFileContent}
"""`

      try {
        await firstValueFrom(
          this.httpService
            .post(
              'http://localhost:11434/api/generate',
              {
                model: 'mistral',
                prompt: `This is a new conversation with ID ${requestId}. Forget all previous context.`,
                stream: false,
                options: {
                  num_predict: 1,
                },
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Request-ID': requestId,
                },
              },
            )
            .pipe(catchError(() => [])),
        )
      } catch (e) {
        console.error('Error in firstValueFrom:', e)
      }

      const response = await firstValueFrom(
        this.httpService
          .post(
            'http://localhost:11434/api/generate',
            {
              model: 'mistral',
              prompt: prompt,
              stream: false,
              options: {
                temperature: 0.1,
                num_predict: 50,
                seed: Date.now(),
                repeat_penalty: 1.2,
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId,
                'Cache-Control': 'no-cache',
              },
              timeout: 15000,
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              console.error(`Lỗi trong request ${requestId}:`, error.message)
              throw error
            }),
          ),
      )

      let generatedText = ''
      if (response && response.response) {
        generatedText = response.response.trim()
      }

      console.log(`Generated text (${requestId}):`, generatedText)

      const cleanedModelOutput = this.filterLlmOutput(generatedText)
      console.log('Cleaned model output:', cleanedModelOutput)

      if (!cleanedModelOutput) {
        throw new Error('No entity found in the response')
      }
    } catch (error) {
      console.error('Error details:', error)
      throw new Error(`Error from getResourceNameOllama: ${error.message}`)
    }
  }

  async getConstraintOllama(
    controllerMethodMappingArr: any,
    policyMethods: any,
    policyFileContent: string,
  ) {
    try {
      const prompt = `Identify the constraints in the functions ${policyMethods.join(', ')} in the code below.

Return ONLY the constraints as a JSON object without any explanations or additional text.
Each function constraint is the string inside super('...').

Example of expected response format:
{
  "PolicyName1": "constraint1",
  "PolicyName2": "constraint2"
}

Source code:
${policyFileContent}`

      console.log('Sending request to Ollama with Mistral model...')

      const response = await firstValueFrom(
        this.httpService
          .post(
            'http://localhost:11434/api/generate',
            {
              model: 'mistral',
              prompt: prompt,
              stream: false,
              options: {
                num_ctx: 2048,
                num_predict: 100,
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              console.error('API Error:', error.message)
              throw error
            }),
          ),
      )

      const generatedText = response.response || ''
      console.log('Generated text:', generatedText)

      const MethodPolicyArray = this.convertLlmStringToArray(generatedText)

      const controllerMethodPolicyArray = this.combineArrays(
        controllerMethodMappingArr,
        MethodPolicyArray,
      )

      return controllerMethodPolicyArray
    } catch (error) {
      console.error('Error in getConstraintOllama:', error)
      throw new Error(`Failed to get constraints from Ollama: ${error.message}`)
    }
  }

  private convertLlmStringToArray(LlmResponse: string) {
    const pairs = LlmResponse.split(',')

    const resultObject = {}

    pairs.forEach((pair) => {
      const [method, resource] = pair.split(':').map((item) => item.trim())

      resultObject[method] = resource
    })

    return [resultObject]
  }

  private combineArrays(
    arr1: Array<Record<string, string>>,
    arr2: Array<Record<string, string>>,
  ): Array<Record<string, string>> {
    const result: Record<string, string>[] = []

    // Duyệt qua mảng thứ nhất
    for (const obj1 of arr1) {
      const key = Object.keys(obj1)[0] // Lấy key của object (ví dụ: 'getAccount')
      const value = obj1[key] // Lấy giá trị tương ứng (ví dụ: 'getAccountDetails')

      // Duyệt qua mảng thứ hai để tìm giá trị tương ứng
      for (const obj2 of arr2) {
        if (value in obj2) {
          // Nếu tìm thấy, thêm vào kết quả một object mới
          result.push({ [key]: obj2[value] })
          break
        }
      }
    }

    return result
  }

  private filterLlmOutput(llmOutput: string): string {
    if (!llmOutput) return ''

    // Bước 1: Tìm các pattern phù hợp với "method: entity"
    const methodEntityPattern = /(\w+):\s*(\w+)/g
    const matches = [...llmOutput.matchAll(methodEntityPattern)]

    if (matches.length === 0) return ''

    // Bước 2: Xây dựng chuỗi kết quả theo định dạng yêu cầu
    const filteredPairs = matches.map((match) => {
      const method = match[1].trim()
      const entity = match[2].trim()
      return `${method}: ${entity}`
    })

    // Bước 3: Kết hợp tất cả các cặp với dấu phẩy
    return filteredPairs.join(',')
  }
}
