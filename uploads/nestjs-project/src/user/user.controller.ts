import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Lấy thông tin của người dùng đang đăng nhập
   */
  @Get('profile')
  async getProfile(@Req() req) {
    return this.userService.findOne(req.user.id);
  }
}
