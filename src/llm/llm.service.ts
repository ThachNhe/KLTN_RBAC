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
    this.model = this.configService.get<string>('OPEN_AI_MODEL_4o_MINI')

    // Initialize the HUGGING API key and base URL
    this.huggingFaceBaseUrl = this.configService.get('HUGGING_FACE_URL')
    this.huggingFaceKey = this.configService.get('HUGGING_FACE_KEY2')
    this.huggingFaceModel = this.configService.get('HUGGINGFACE_MODEL')

    if (!this.openAIKey) {
      throw new Error('OPEN_AI_KEY is not set')
    }

    if (!this.huggingFaceKey) {
      throw new Error('HUGGING_FACE_KEY is not set')
    }
  }

  // OpenAI implementation
  async getResourceName(
    controllerOperations,
    serviceMethodPolices,
    serviceFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `Analyze the service methods ${serviceMethodPolices} in the provided code and identify the main data entity each method operates on.

For each controller operation, determine which database entity (like Account, User, Transaction, etc.) is being directly manipulated in the corresponding service method.

Return ONLY the entity names without any explanations, comments or additional text.

Format the result exactly as follows:
${controllerOperations.map((action) => `${action}: EntityName`).join(',')}

For example, if getAccountDetails method primarily works with Account entities, return "getAccount: Account".
If a method doesn't clearly operate on any specific entity, use "Unknown".

Source code:
"""
${serviceFileContent}
"""`

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

      return response.choices[0].message.content
    } catch (error) {
      throw new Error(`Error from getResourceName: ${error.message}`)
    }
  }

  async getConstraint(
    controllerOperations: any,
    constraintPolicies: any,
    policyFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `Identify the constraints in the functions and their corresponding 
policies ${constraintPolicies} in the code below.

Return the constraints as a concise list, without any 
explanations or additional text.

The constraint of each policy is the string inside 
super('this is the constraint I'm looking for').

Format the result exactly as follows:
${controllerOperations.map((action) => `${action}: constraint`).join(',')}

If there are no constraints, return an empty string.

Source code:
"""
${policyFileContent}
"""`

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

      return response?.choices[0]?.message?.content
    } catch (error) {
      throw new Error(`Error from getConstraint: ${error.message}`)
    }
  }

  // Hugging Face implementation
  async getResourceNameHuggingFace(
    serviceFunctions: any,
    serviceFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `<s>[INST] Identify the main Entity directly manipulated in the functions ${serviceFunctions?.join(', ')} in the code below. Return the Entity name as a concise list, without any explanations or additional text. Format the result exactly as follows:
${serviceFunctions.map((action) => `${action}: entity name`).join(',')}
If no Entity is affected, return an empty string. Source code: """ ${serviceFileContent} """ [/INST]</s>`

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

      console.log('check hg face resource name: ', response[0])

      // Hugging Face returns an array with generated text
      return Array.isArray(response) && response.length > 0
        ? response[0].generated_text
        : ''
    } catch (error) {
      throw new Error(`Error from getResourceNameHuggingFace: ${error.message}`)
    }
  }

  async getConstraintHuggingFace(
    controllerOperations: any,
    constraintPolicies: any,
    policyFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `<s>[INST] Identify the constraints in the functions and their corresponding policies ${constraintPolicies} in the code below. Return the constraints as a concise list, without any explanations or additional text. The constraint of each policy is the string inside super('this is the constraint I'm looking for'). Format the result exactly as follows:
${controllerOperations.map((action) => `${action}: constraint`).join(',')}
If there are no constraints, return an empty string. Source code: """ ${policyFileContent} """ <s>[INST]`

      // console.log('check prompt: ', prompt)

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

      console.log('response==============', response[0])

      // Hugging Face returns an array with generated text
      return Array.isArray(response) && response.length > 0
        ? response[0].generated_text
        : ''
    } catch (error) {
      throw new Error(`Error from getConstraintHuggingFace: ${error.message}`)
    }
  }
}
