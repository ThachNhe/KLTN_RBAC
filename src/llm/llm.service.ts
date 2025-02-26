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

  async getResourceName(serviceFunction: string): Promise<string> {
    try {
      const prompt = `Xác định Entity chính được thao tác trực tiếp trong các hàm create, update, và find trong mã dưới đây.
Trả về tên Entity dưới dạng danh sách ngắn gọn, không kèm theo bất kỳ giải thích hoặc văn bản nào khác.
Format kết quả chính xác như sau:
create: [tên Entity]
update: [tên Entity]
find: [tên Entity]
Mã nguồn:
"""
import { Note, NoteViewer, ShareAccess, User } from '@/db/entities'
import { MediaService } from '@/media/media.service'
import {
  NoteCreateDto,
  NoteUpdateDto,
  PinCreateDto,
  PinUpdateDto,
} from '@/note/note.dto'
import { decrypt, encrypt } from '@/shared/crypto'
import { MetaDto, PaginationDto } from '@/shared/dto'
import { AccessTypeNum, NoteTypeEnum } from '@/shared/enum'
import { VaultService } from '@/vault/vault.service'
import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { InjectRepository } from '@mikro-orm/nestjs'
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { isNotEmpty } from 'class-validator'
import { FastifyReply } from 'fastify'
import _ from 'lodash'

const { SALT } = process.env

@Injectable()
export class NoteService {
  constructor(
    private vaultService: VaultService,
    private mediaService: MediaService,

    private em: EntityManager,

    @InjectRepository(Note) private noteRepo: EntityRepository<Note>,
  ) {}

  public async findOne(id: string) {
    const note = await this.noteRepo.findOne(
      { id, deletedAt: null },
      { populate: ['resourceFile', 'noteViewers'] },
    )

    if (!note) {
      throw new NotFoundException()
    }

    return note
  }

  public async create(
    userId: string,
    body: NoteCreateDto,
    file: MemoryStorageFile,
  ) {
    this.validateShareNote(body)
    const resourceFile =
      body.type === NoteTypeEnum.FILE
        ? await this.mediaService.save(
            userId,
            { bucketType: body.bucketType, filename: body.filename },
            file,
          )
        : null

    // body.noteViewers = ['651058939479326720']

    const note = this.noteRepo.create({
      ...body,
      user: await this.findOneUser(userId),
      resourceFile,
    })

    let viewers = []

    if (body.shareAccessIds) {
      viewers = await this.addNoteViewers(body.shareAccessIds)
    }

    const user = await this.findOneUser(userId)
    note.user = user
    note.setNoteViewers(viewers)

    await this.em.persistAndFlush(note)

    return this.noteToJson(note)
  }

  public async update(
    userId: string,
    id: string,
    body: NoteUpdateDto,
    file: MemoryStorageFile,
  ) {
    this.validateShareNote(body)
    const note = await this.findOne(id)

    const resourceFile =
      body.type === NoteTypeEnum.FILE
        ? await this.mediaService.update(
            userId,
            note?.resourceFile?.id,
            { bucketType: body.bucketType, filename: body.filename },
            file,
          )
        : note.resourceFile

    this.em.assign(note, body)
    let viewers = []

    if (body.isPublic) {
      note.setIsPublic(true)
    }

    if (body.isPrivate) {
      note.setIsPrivate(true)
    }

    // body.noteViewers = ['651058940938944513']

    if (body.shareAccessIds) {
      viewers = await this.addNoteViewers(body.shareAccessIds)
      note.noteViewers.add(viewers)
      note.isPublic = false
      note.isPrivate = false
    }

    note.noteViewers.add(viewers)
    note.resourceFile = resourceFile

    await this.em.persistAndFlush(note)
    return this.noteToJson(note)
  }

  public validateShareNote(
    data: Pick<
      Partial<NoteCreateDto>,
      'isPrivate' | 'isPublic' | 'shareAccessIds'
    >,
  ) {
    const { isPrivate, isPublic, shareAccessIds } = data
    const isPrivateHasData = Boolean(isPrivate)
    const isPublicHasData = Boolean(isPublic)
    const isShareAccessesHasData =
      isNotEmpty(shareAccessIds) && shareAccessIds.length

    if (!isPrivateHasData && !isPublicHasData && !isShareAccessesHasData) {
      throw new BadRequestException(
        'A share access request must valuable: isPrivate, isPublic, or shareAccessIds.',
      )
    }

    if (isPrivateHasData && (isPublicHasData || isShareAccessesHasData)) {
      throw new BadRequestException(
        'A share access request can only have one of the three fields: isPrivate, isPublic, or shareAccessIds.',
      )
    }
    if (isPublicHasData && (isPrivateHasData || isShareAccessesHasData)) {
      throw new BadRequestException(
        'A share access request can only have one of the three fields: isPrivate, isPublic, or shareAccessIds.',
      )
    }
    if (isShareAccessesHasData && (isPrivateHasData || isPublicHasData)) {
      throw new BadRequestException(
        'A share access request can only have one of the three fields: isPrivate, isPublic, or shareAccessIds.',
      )
    }

    if (isPrivateHasData) {
      delete data.isPublic
      delete data.shareAccessIds
    }

    if (isPublicHasData) {
      delete data.isPrivate
      delete data.shareAccessIds
    }

    if (isShareAccessesHasData) {
      delete data.isPublic
      delete data.isPrivate
    }
  }

  public async delete(id: string) {
    const note = await this.findOne(id)

    note.deletedAt = new Date()

    await this.em.persistAndFlush(note)
  }

  public async find(
    email: string,
    sharedId: string,
    ownerId: string,
    pagination: PaginationDto,
    search: string,
  ) {
    const { limit, offset } = new PaginationDto(pagination)
    const baseFilter = {
      user: { id: ownerId },
      deletedAt: null,
    }

    const baseOptions = {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
      populate: [
        'resourceFile',
        'noteViewers',
        'noteViewers.shareAccess',
        'noteViewers.shareAccess.user',
      ] as const,
    }

    const [notes, count] = await this.noteRepo.findAndCount(
      baseFilter,
      baseOptions,
    )

    if (sharedId === ownerId) {
      const meta = new MetaDto(pagination, count)

      return {
        notes: await Promise.all(
          notes.map(async (note) => {
            const noteJson = await this.noteToJson(note)
            return noteJson
          }),
        ),
        meta,
      }
    }

    const access = await this.em.findOne(ShareAccess, {
      email,
      user: { id: ownerId },
    })

    if (access.role === AccessTypeNum.ADMIN) {
      const meta = new MetaDto(pagination, count)
      return {
        notes,
        meta,
      }
    }

    if (access.role === AccessTypeNum.VIEWER) {
      const viewerFilter = {
        user: { id: ownerId },
        deletedAt: null,
        $or: [
          { isPublic: true },
          {
            isPublic: false,
            isPrivate: false,
            noteViewers: {
              shareAccess: {
                user: { id: sharedId },
              },
            },
          },
        ],
      }
      const [notes, count] = await this.noteRepo.findAndCount(
        viewerFilter,
        baseOptions,
      )
      const meta = new MetaDto(pagination, count)

      // const newNotes = await Promise.all(
      //   notes.map(async (note) => {
      //     const noteJson = await this.noteToJson(note)
      //     return noteJson
      //   }),
      // )
      return {
        notes: await Promise.all(
          notes.map(async (note) => {
            const noteJson = await this.noteToJson(note)
            return noteJson
          }),
        ),
        meta,
      }
    }

    return []
  }

  public async createPin(
    userId: string,
    body: PinCreateDto,
    response: FastifyReply,
  ) {
    const vaultData = await this.vaultService.read(userId)

    await this.vaultService.write(userId, {
      notePin: body.pin,
      passwordPin: vaultData?.passwordPin || '',
    })

    const hashNotePin = await bcrypt.hash(body.pin, Number(SALT))
    const oneDay = 24 * 60 * 60 * 1000

    response.setCookie('hashNotePin', hashNotePin, {
      httpOnly: true,
      sameSite: 'none',
      maxAge: oneDay,
    })
  }

  public async updatePin(userId: string, body: PinUpdateDto) {
    const vaultData = await this.vaultService.read(userId)

    if (!vaultData?.notePin) {
      throw new ForbiddenException('Create pin first')
    }

    if (vaultData.notePin !== body.oldPin) {
      throw new ForbiddenException()
    }

    const notes = await this.noteRepo.find({
      user: { id: userId },
      deletedAt: null,
    })

    // this is needed to test again
    await this.updatePasswordsWithNewPin(vaultData?.notePin, body.newPin, notes)

    await this.vaultService.write(userId, {
      notePin: body.newPin,
      passwordPin: vaultData?.passwordPin,
    })
  }

  private async updatePasswordsWithNewPin(
    oldPin: string,
    newPin: string,
    notes: Note[],
  ) {
    for (const note of notes) {
      const plainTextPass = decrypt(note.content, oldPin)
      const encryptedNoteContent = encrypt(plainTextPass, newPin)
      note.content = encryptedNoteContent
      this.em.persist(note)
    }
    await this.em.flush()
  }

  private async findOneUser(userId: string) {
    const user = await this.em.findOne(User, { id: userId, deletedAt: null })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  private async getShareAccess(noteViewers: NoteViewer[]) {
    const shareAccess = await Promise.all(
      noteViewers.map(async (viewer) => ({
        ...viewer.shareAccess,
        user:
          (await this.findOneUserByEmail(viewer?.shareAccess?.email)) || null,
        // password: viewer.password?.id,
      })),
    )

    return shareAccess
  }

  public async noteToJson(note: Note) {
    delete note.resourceFile?.note
    return {
      ...note,
      shareAccess: await this.getShareAccess(
        (note.noteViewers as any).toJSON(),
      ),
    }
  }

  private async addNoteViewers(shareAccessIds: string[]) {
    return Promise.all(
      shareAccessIds.map(async (shareAccessId) => {
        const shareAccess = await this.em.findOneOrFail(ShareAccess, {
          id: shareAccessId,
        })
        const noteViewer = this.em.create(NoteViewer, {
          shareAccess,
        })
        return noteViewer
      }),
    )
  }

  private findOneUserByEmail(email: string) {
    return this.em.findOne(User, { email })
  }
}

"""

`

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
