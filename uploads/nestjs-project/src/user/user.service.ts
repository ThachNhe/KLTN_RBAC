import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { User } from '@/db/entities';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: EntityRepository<User>,
  ) {}

  /**
   * Tìm người dùng theo ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ id });

    if (!user) {
      throw new NotFoundException(`Người dùng có ID ${id} không tồn tại`);
    }

    // Loại bỏ password trước khi trả về
    delete user.password;

    return user;
  }

  /**
   * Tìm người dùng theo username
   */
  async findByUsername(username: string) {
    return this.userRepository.findOne({ username });
  }
}
