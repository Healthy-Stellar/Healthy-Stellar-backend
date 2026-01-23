import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('staff')
  createStaff(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createStaff(createUserDto);
  }

  @Post('patients')
  createPatient(@Body() createPatientDto: CreatePatientDto) {
    return this.usersService.createPatient(createPatientDto);
  }

  @Patch(':id/verify-license')
  verifyLicense(@Param('id') id: string, @Body('verifiedBy') verifiedBy: string) {
    return this.usersService.verifyMedicalLicense(id, verifiedBy);
  }

  @Patch(':id/revoke-access')
  revokeAccess(@Param('id') id: string, @Body('reason') reason: string) {
    return this.usersService.revokeAccess(id, reason);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
