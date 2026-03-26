import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CaseAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // ADMIN은 모든 Case 접근 가능
    if (user.role === UserRole.ADMIN) return true;

    const caseId = request.params.id;
    if (!caseId) return true;

    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });

    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }

    // 사용자의 orgId가 Case의 관련 조직 중 하나와 일치하는지 확인
    const allowedOrgIds = [
      vehicleCase.orgId,
      vehicleCase.intakeOrgId,
      vehicleCase.hubOrgId,
    ].filter(Boolean);

    if (!allowedOrgIds.includes(user.orgId)) {
      throw new ForbiddenException('이 케이스에 대한 접근 권한이 없습니다.');
    }

    // Guard에서 조회한 case를 request에 저장 (서비스에서 재조회 방지)
    request.vehicleCase = vehicleCase;
    return true;
  }
}
