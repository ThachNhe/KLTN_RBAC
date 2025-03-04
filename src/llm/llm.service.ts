import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { catchError, firstValueFrom, map, throwError } from 'rxjs'

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name)
  private readonly openAIKey: string
  private readonly baseUrl: string
  private readonly model: string

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('HUGGING_FACE_API_URL')
    this.openAIKey = this.configService.get('HUGGING_FACE_API_KEY')
    this.model = this.configService.get<string>('HUGGINGFACE_MODEL')

    if (!this.openAIKey) {
      throw new Error('HUGGING_FACE_API_KEY is not set')
    }
  }

  async getResourceName(
    serviceFunctions: any,
    serviceFileContent: string,
  ): Promise<string> {
    try {
      const prompt = `Xác định Entity chính được thao tác trực tiếp trong các hàm ${serviceFunctions?.join(', ')} trong mã dưới đây. Trả về tên Entity dưới dạng danh sách ngắn gọn, không kèm theo bất kỳ giải thích hoặc văn bản nào khác. Format kết quả chính xác như sau: 
${serviceFunctions.map((action) => `${action}: entityName`).join('\n')}
Nếu không tác động lên Entity nào, hãy trả về chuỗi rỗng. Mã nguồn: """ ${serviceFileContent} """`

      console.log('Prompt:====: ', prompt)
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.baseUrl}/${this.model}`,
            {
              inputs: prompt,
              parameters: {
                max_new_tokens: 100,
                temperature: 0.1,
                top_p: 0.5,
                do_sample: false,
                return_full_text: false,
              },
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
              this.logger.error(
                `Lỗi khi gọi API: ${JSON.stringify(error.response?.data || error.message)}`,
              )
              return throwError(() => new Error('Không thể kết nối với API'))
            }),
          ),
      )

      console.log('Response:====', response)

      return response[0].generated_text
    } catch (error) {
      this.logger.error(`Lỗi trong getCalculationResult: ${error.message}`)
      return `Lỗi: ${error.message}`
    }
  }
}
