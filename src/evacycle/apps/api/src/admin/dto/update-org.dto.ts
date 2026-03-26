import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-org.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
