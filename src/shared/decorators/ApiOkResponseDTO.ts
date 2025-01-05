/* eslint-disable @typescript-eslint/ban-types */
import { MetaDto, ResponseDto } from '@/shared/dto'
import { applyDecorators } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponseOptions,
  getSchemaPath,
  OmitType,
} from '@nestjs/swagger'
import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

class ApiResponseDto extends OmitType(ResponseDto, ['meta', 'data'] as const) {}

export const ApiOkResponseDto = ({
  data,
  ...options
}: ApiResponseOptions & {
  data: Function | [Function]
}) => {
  const isArray = Array.isArray(data)
  const dataType = isArray ? data[0] : data
  const dataSchema = isArray
    ? {
        type: 'array',
        items: { $ref: getSchemaPath(dataType as Function) },
      }
    : {
        $ref: getSchemaPath(dataType),
      }

  const schemaObjects: (SchemaObject | ReferenceObject)[] = [
    { $ref: getSchemaPath(ApiResponseDto) },
  ]

  if (isArray) {
    schemaObjects.push({
      properties: {
        meta: {
          type: 'object',
          $ref: getSchemaPath(MetaDto as Function),
        },
      },
    })
  }

  schemaObjects.push({
    properties: {
      data: dataSchema,
    },
  })

  return applyDecorators(
    ApiExtraModels(ResponseDto, dataType),
    ApiExtraModels(ApiResponseDto, dataType),
    ApiOkResponse({
      ...options,
      schema: {
        allOf: schemaObjects,
      },
    }),
  )
}
