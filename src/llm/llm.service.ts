import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { catchError, firstValueFrom, map, throwError } from 'rxjs'

@Injectable()
export class LlmService {
  private readonly openAIKey: string
  private readonly baseUrl: string
  private readonly model: string

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('OPEN_AI_URL')
    this.openAIKey = this.configService.get('OPEN_AI_KEY')
    this.model = this.configService.get<string>('OPEN_AI_MODEL')

    if (!this.openAIKey) {
      throw new Error('OPEN_AI_KEY is not set')
    }
  }

  async getResourceName(
    serviceFunctions: any,
    serviceFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `Identify the main Entity directly manipulated in the functions ${serviceFunctions?.join(', ')} in the code below. Return the Entity name as a concise list, without any explanations or additional text. Format the result exactly as follows:
${serviceFunctions.map((action) => `${action}: entityName`).join(',')}
If no Entity is affected, return an empty string. Source code: """ ${serviceFileContent} """`

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
      const prompt = `Identify the constraints in the functions and their corresponding policies ${constraintPolicies} in the code below. Return the constraints as a concise list, without any explanations or additional text. The constraint of each policy is the string inside super('this is the constraint I'm looking for'). Format the result exactly as follows:
${controllerOperations.map((action) => `${action}: entityName`).join(',')}
If there are no constraints, return an empty string. Source code: """ ${policyFileContent} """`

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
              max_tokens: this.configService.get<number>('MAX_TOKENS'),
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
}
