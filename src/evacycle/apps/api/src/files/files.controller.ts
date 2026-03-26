import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { PresignFileDto } from './dto/presign-file.dto';
import { CaseAccessGuard } from '../cases/guards/case-access.guard';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('cases/:id/files')
@UseGuards(CaseAccessGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  async presign(
    @Param('id') caseId: string,
    @Body() dto: PresignFileDto,
    @Request() req: any,
  ) {
    return this.filesService.presign(caseId, dto, req.user.sub);
  }

  @Post(':fileId/confirm')
  async confirm(
    @Param('id') caseId: string,
    @Param('fileId') fileId: string,
    @Request() req: any,
  ) {
    return this.filesService.confirmUpload(caseId, fileId, req.user.sub);
  }

  @Get()
  async list(@Param('id') caseId: string) {
    return this.filesService.listFiles(caseId);
  }

  @Delete(':fileId')
  async remove(
    @Param('id') caseId: string,
    @Param('fileId') fileId: string,
    @Request() req: any,
  ) {
    return this.filesService.deleteFile(caseId, fileId, req.user.sub, req.user.role);
  }
}
