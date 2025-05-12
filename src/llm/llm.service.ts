import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { catchError, firstValueFrom, map } from 'rxjs'

@Injectable()
export class LlmService {
  private readonly openAIKey: string
  private readonly openAIUrl: string
  private readonly openAIModel: string

  // Hugging Face properties
  private readonly huggingFaceKey: string
  private readonly huggingFaceBaseUrl: string
  private readonly huggingFaceModel: string

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    // Initialize the OpenAI API key and base URL
    this.openAIUrl = this.configService.get('OPEN_AI_URL')
    this.openAIKey = this.configService.get('OPEN_AI_KEY')
    // this.openAIModel = this.configService.get<string>('OPEN_AI_MODEL_4_1')
    // this.openAIModel = this.configService.get<string>('OPEN_AI_MODEL_4_1_MINI')
    // this.openAIModel = this.configService.get<string>('OPEN_AI_MODEL_4o')
    this.openAIModel = this.configService.get<string>('OPEN_AI_MODEL_4o_MINI')

    // Initialize the HUGGING API key and base URL
    this.huggingFaceBaseUrl = this.configService.get('HUGGING_FACE_URL')
    this.huggingFaceKey = this.configService.get('HUGGING_FACE_KEY')

    // Hugging Face model
    this.huggingFaceModel = this.configService.get(
      'HUGGINGFACE_MISTRALAI_MISTRAL_INSTRUC_V3',
    )

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
      const prompt = `
      Extract the SINGLE most important entity being directly
      manipulated in each of these functions from the provided:
      ${serviceMethods?.join('\n')}

      Instructions:
      1. For each function, identify exactly ONE entity name that is
       the primary data object being manipulated.
      2. If multiple entities exist, choose only the most dominant one
       that is central to the function's purpose.
      3. Focus on the data model/object that is most essential to the
      core operation.

      Format your response exactly as follows:
      ${serviceMethods.map((action) => `${action}: entityName`).join(',')}

      The response should contain ONLY the entity names in the
      specified format - no introduction, explanation, or additional
      text.

      Source code:
      """
      ${serviceFileContent}
      """`

      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.openAIUrl}`,
            {
              model: this.openAIModel,
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
            `${this.openAIUrl}`,
            {
              model: this.openAIModel,
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

      const controllerMethodPolicyArray = this.combineArrays(
        controllerMethodMappingArr,
        MethodPolicyArray,
      )
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
      const prompt = `
      <s>[INST] 
      Extract the SINGLE most important entity being directly
      manipulated in each of these functions from the provided:
      ${serviceMethods?.join('\n')}

      Instructions:
      1. For each function, identify exactly ONE entity name that is
       the primary data object being manipulated.
      2. If multiple entities exist, choose only the most dominant one
       that is central to the function's purpose.
      3. Focus on the data model/object that is most essential to the
      core operation.

      Format your response exactly as follows:
      ${serviceMethods.map((action) => `${action}: entityName`).join(',')}

      The response should contain ONLY the entity names in the
      specified format - no introduction, explanation, or additional
      text.

      Source code:
      """
      ${serviceFileContent}
      """[/INST]</s>`

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

    for (const obj1 of arr1) {
      const controllerMethod = Object.keys(obj1)[0] // (ex: 'getAccount')
      const serviceMethod = obj1[controllerMethod] // (ex: 'getAccountDetails')

      // Iterate through the second array to find the matching key
      for (const obj2 of arr2) {
        if (serviceMethod in obj2) {
          result.push({ [controllerMethod]: obj2[serviceMethod] })
          break
        }
      }
    }

    return result
  }

  private filterLlmOutput(llmOutput: string): string {
    if (!llmOutput) return ''

    // find suitable pattern "method: entity"
    const methodEntityPattern = /(\w+):\s*(\w+)/g
    const matches = [...llmOutput.matchAll(methodEntityPattern)]

    if (matches.length === 0) return ''

    // Built a new array of strings with the format "method: entity"
    const filteredPairs = matches.map((match) => {
      const method = match[1].trim()
      const entity = match[2].trim()
      return `${method}: ${entity}`
    })

    return filteredPairs.join(',')
  }
}
