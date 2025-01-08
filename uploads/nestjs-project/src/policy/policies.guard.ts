import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHECK_POLICIES_KEY, PolicyHandler } from './policy.decorator'; // Giả định service này tồn tại
import { EntityAssigner } from '@mikro-orm/core';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private em: EntityAssigner,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Kiểm tra người dùng đã xác thực chưa
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Lấy resourceId từ params
    const resourceId = request.params.id;

    // Nếu có resourceId, lấy resource từ database thay vì từ request body
    let resource;
    if (resourceId) {
      resource = await this.em.fi;
      if (!resource) {
        return false; // Hoặc throw một exception phù hợp
      }
    } else {
      // Nếu không có resourceId (ví dụ: tạo mới), sử dụng body nhưng cẩn thận
      resource = request.body;
    }

    // Thực hiện kiểm tra policy
    const canAccess = policyHandlers.every((handler) =>
      handler.handle(user, resource),
    );
    if (!canAccess) {
      throw new ForbiddenException('Access denied by policy');
    }

    return true;
  }
}
