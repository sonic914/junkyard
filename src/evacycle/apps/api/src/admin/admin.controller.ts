import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, OrgType } from '@prisma/client';
import { AdminService } from './admin.service';
import { CreateOrganizationDto } from './dto/create-org.dto';
import { UpdateOrganizationDto } from './dto/update-org.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/organizations')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async create(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  @Get()
  async findAll(
    @Query('type') type?: OrgType,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take?: number,
  ) {
    return this.adminService.findAllOrganizations(type, skip, take);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.adminService.findOneOrganization(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.adminService.updateOrganization(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.adminService.deleteOrganization(id);
  }
}
