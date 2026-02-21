import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): { message: string; status: string } {
    return {
      message: "Welcome to NestJS Query Optimization Service",
      status: "running",
    };
  }

  health(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
