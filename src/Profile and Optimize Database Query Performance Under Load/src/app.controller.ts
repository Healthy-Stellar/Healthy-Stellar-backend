import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): { message: string; status: string } {
    return this.appService.getHello();
  }

  @Get("health")
  health(): { status: string; timestamp: string } {
    return this.appService.health();
  }
}
